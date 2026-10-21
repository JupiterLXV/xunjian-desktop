'use strict';
const {app,BrowserWindow,dialog,ipcMain,Menu,protocol,net,shell,screen,safeStorage,Tray}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {FileService,normalizeError}=require('./fs-service.cjs');
const {readMachineCode}=require('./machine.cjs');
const {installFullscreenKeys}=require('./fullscreen.cjs');
const {createTray}=require('./tray.cjs');
const {ApiSettings}=require('./api-settings.cjs');
const {SessionService}=require('./session.cjs');
const {hardenRuntime}=require('./hardening.cjs');hardenRuntime(app);
protocol.registerSchemesAsPrivileged([{scheme:'xunjian-file',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
// 保留内部应用名以沿用旧 userData；对外名称由 productName、窗口标题和菜单指定。
app.setName('巡检缺陷工具');
app.setAppUserModelId('local.xunjian.desktop');
let win,tray,service,allowClose=false,closing=false,statePath,closeTimer;
const entry=pathToFileURL(path.join(__dirname,'index.html')).href;
let machineTask;
function deviceInfo(){if(!machineTask)machineTask=readMachineCode().then(machine=>({machine})).catch(error=>{machineTask=null;throw error;});return machineTask;}
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
app.whenReady().then(async()=>{
 const dataDir=app.getPath('userData');statePath=path.join(dataDir,'window.json');service=new FileService(dataDir);await service.init();
 const settings=new ApiSettings({dataDir,safeStorage,defaults:require('./api-config.cjs'),getMachineCode:async()=>(await deviceInfo()).machine});settings.load();
 const sessions=new SessionService({dataDir,safeStorage,getMachineCode:async()=>(await deviceInfo()).machine,apiRequest:args=>settings.request(args)});await sessions.load();
 async function importConfiguration(){
  if(sessions.current())throw Error('请先退出登录，再导入新的服务配置');
  const result=await dialog.showOpenDialog(win,{title:'导入登录服务配置',properties:['openFile'],filters:[{name:'服务配置 JSON',extensions:['json']}]});
  if(result.canceled)return null;
  const handle=await fs.open(result.filePaths[0],'r');let value;
  try{if((await handle.stat()).size>16384)throw Error('服务配置文件过大');value=JSON.parse(await handle.readFile('utf8'));}finally{await handle.close();}
  sessions.logout();return settings.save(value);
 }
 service.onFilesChanged=()=>{if(win&&!win.isDestroyed())win.webContents.send('desktop:files-changed');};
 service.onProgress=p=>{if(win&&!win.isDestroyed())win.webContents.send('desktop:progress',p);};
 protocol.handle('xunjian-file',async request=>{try{const u=new URL(request.url);if(request.method!=='GET')return new Response('',{status:405});const rel=u.pathname.slice(1).split('/').map(decodeURIComponent).join('/');const file=await service.locate({root:u.hostname,rel});const response=await net.fetch(pathToFileURL(file).href);const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin','*');return new Response(response.body,{status:response.status,headers});}catch{return new Response('文件无法访问',{status:404});}});
 ipcMain.handle('desktop:request',async(event,op,args={})=>{try{if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==entry)throw Error('来源无效');let value;
 if(op==='device-info')return {ok:true,value:await deviceInfo()};
 if(op==='api-settings')return {ok:true,value:settings.status()};
 if(op==='api-import')return {ok:true,value:await importConfiguration()};
 if(op==='auth-state')return {ok:true,value:sessions.current()};
 if(op==='auth-logout'){sessions.logout();return {ok:true,value:true};}
 if(op==='api-request')return {ok:true,value:await sessions.api(args)};
 sessions.authorize(op,args);
 if(op==='pick'){let defaultPath;if(args.startIn)defaultPath=await service.locate(args.startIn).catch(()=>undefined);const result=await dialog.showOpenDialog(win,{title:args.id?.includes('output')?'选择输出总目录（包含缺陷圈示图、缺陷原图）':'选择图片文件夹',defaultPath,properties:['openDirectory','createDirectory']});if(result.canceled)throw Object.assign(Error('已取消选择'),{name:'AbortError'});value=await service.grant(result.filePaths[0]);}
 else if(op==='reveal'){const p=await service.locate(args.h);if(args.h.kind==='directory'){const error=await shell.openPath(p);if(error)throw Error(error);}else shell.showItemInFolder(p);value=true;}
 else if(op==='diagnostics'){const result=await dialog.showSaveDialog(win,{title:'保存诊断信息',defaultPath:'巡检诊断.json',filters:[{name:'JSON',extensions:['json']}]});if(result.canceled)return {ok:true,value:false};const report={version:app.getVersion(),electron:process.versions.electron,platform:process.platform,arch:process.arch,time:new Date().toISOString(),details:args.details};await fs.writeFile(result.filePath,JSON.stringify(report,null,2));value=true;}
 else value=await service.call(op,args);
 return {ok:true,value};}catch(e){return {ok:false,error:normalizeError(e)};}});
 ipcMain.on('desktop:close-ready',async(event,result)=>{if(event.sender!==win?.webContents||!closing)return;clearTimeout(closeTimer);if(result?.ok){allowClose=true;win.close();return;}closing=false;win.webContents.send('desktop:action','close-cancelled');await dialog.showMessageBox(win,{type:'warning',title:'还有内容未保存',message:result?.message||'请先完成或重试保存任务，再关闭窗口。',buttons:['返回检查']});});
 let saved={};try{saved=JSON.parse(await fs.readFile(statePath,'utf8'));}catch{}
 const area=screen.getPrimaryDisplay().workArea;const bounds={width:Math.min(saved.width||1440,area.width),height:Math.min(saved.height||960,area.height)};if(Number.isFinite(saved.x)&&Number.isFinite(saved.y)&&screen.getAllDisplays().some(d=>saved.x>=d.workArea.x&&saved.y>=d.workArea.y&&saved.x<d.workArea.x+d.workArea.width-100&&saved.y<d.workArea.y+d.workArea.height-100)){bounds.x=saved.x;bounds.y=saved.y;}
 // Windows Shell 需要真实文件路径，避免从 ASAR 内查找任务栏图标。
 const windowIcon=process.platform==='win32'?(app.isPackaged?path.join(process.resourcesPath,'icon.ico'):path.join(__dirname,'../build/icon.ico')):path.join(__dirname,'icon.png');
 win=new BrowserWindow({...bounds,minWidth:1000,minHeight:680,show:false,backgroundColor:'#f7f7f6',title:'图像标注软件',icon:windowIcon,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,devTools:!app.isPackaged,backgroundThrottling:false}});
 if(process.platform==='win32')win.setAppDetails({appId:'local.xunjian.desktop',appIconPath:windowIcon,appIconIndex:0,relaunchDisplayName:'图像标注软件'});
 if(process.platform==='win32')tray=createTray({Tray,Menu,icon:windowIcon,getWindow:()=>win});
 const toggleFullscreen=installFullscreenKeys(win);
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(url!==entry)e.preventDefault();});
 win.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
 win.webContents.on('will-prevent-unload',event=>{if(allowClose)event.preventDefault();});
 win.webContents.on('render-process-gone',async()=>{closing=false;clearTimeout(closeTimer);await service.cleanup();const r=await dialog.showMessageBox(win,{type:'error',message:'界面意外退出，已写入的文件保留。重新打开后请检查保存任务。',buttons:['重新打开','退出']});if(r.response===0)await win.loadURL(entry);else{allowClose=true;win.destroy();}});
 let saveTimer;function persistWindow(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>fs.writeFile(statePath,JSON.stringify({...win.getNormalBounds(),maximized:win.isMaximized()})).catch(()=>{}),400);}
 win.on('resize',persistWindow);win.on('move',persistWindow);
 win.on('close',event=>{if(allowClose)return;event.preventDefault();if(closing)return;closing=true;win.webContents.send('desktop:prepare-close');closeTimer=setTimeout(async()=>{closing=false;win.webContents.send('desktop:action','close-cancelled');await dialog.showMessageBox(win,{type:'warning',message:'保存尚未完成，窗口已保持打开。请等待任务结束后再退出。',buttons:['继续等待']});},45000);});
 win.on('closed',()=>{if(tray){tray.destroy();tray=null;}clearTimeout(saveTimer);clearTimeout(closeTimer);win=null;});
 const action=id=>()=>{win?.webContents.send('desktop:action',id);};
 Menu.setApplicationMenu(Menu.buildFromTemplate([
 {label:'文件',submenu:[{label:'打开图片文件夹…',accelerator:'CmdOrCtrl+O',click:action('open')},{label:'选择输出文件夹…',accelerator:'CmdOrCtrl+Shift+O',click:action('output')},{label:'在资源管理器中显示当前图片',accelerator:'CmdOrCtrl+Shift+E',click:action('reveal')},{type:'separator'},{label:'退出',accelerator:'Alt+F4',click:()=>win.close()}]},
 {label:'编辑',submenu:[{role:'undo',label:'撤销文字输入'},{role:'redo',label:'重做文字输入'},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},
 {label:'视图',submenu:[{label:'搜索目录',accelerator:'CmdOrCtrl+F',click:action('search')},{label:'刷新目录',accelerator:'F5',click:action('refresh')},{label:'成果回收站',click:action('trash')},{label:'操作记录',click:action('history')},{label:'设置',accelerator:'CmdOrCtrl+,',click:action('settings')},{type:'separator'},{role:'zoomIn',label:'放大界面'},{role:'zoomOut',label:'缩小界面'},{role:'resetZoom',label:'恢复界面大小'},{label:'切换全屏',accelerator:'F11',click:toggleFullscreen}]},
 {label:'帮助',submenu:[{label:'使用说明',click:action('help')},{label:'导出诊断信息…',click:action('diagnostics')},{label:'导入登录服务配置…',click:async()=>{try{if(await importConfiguration())win.webContents.send('desktop:action','service-configured');}catch(e){await dialog.showMessageBox(win,{type:'error',message:'服务配置未导入',detail:e.message});}}},{label:'本机机器码',click:async()=>{try{const info=await deviceInfo();await dialog.showMessageBox(win,{type:'info',title:'本机机器码',message:'机器码',detail:info.machine});}catch(e){await dialog.showMessageBox(win,{type:'error',message:'机器码读取失败',detail:e.message});}}},{label:'关于',click:()=>dialog.showMessageBox(win,{type:'info',title:'图像标注软件',message:'图像标注软件',detail:'版本 '+app.getVersion()+'\nWindows 桌面版\n本地处理 · 原生目录 · 安全写入\n支持 Windows 10 / 11（64 位）'})}]}
 ]));
 win.once('ready-to-show',()=>{if(saved.maximized)win.maximize();win.show();});await win.loadURL(entry);
}).catch(async e=>{await dialog.showMessageBox({type:'error',message:'启动失败',detail:e.message});app.quit();});
app.on('window-all-closed',async()=>{await service?.cleanup();app.quit();});
}
