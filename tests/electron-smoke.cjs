'use strict';
// Runs the actual renderer + sandboxed bridge against an isolated encrypted
// loopback backend. The wrapper, profile and images never enter production.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {_electron}=require('playwright');
const {encrypt,decrypt}=require('../app/api-client.cjs');

async function run(){
 const repo=path.resolve(__dirname,'..'),qa=path.join(repo,'.qa');
 const appDir=process.env.XUNJIAN_SMOKE_APP_DIR?path.resolve(repo,process.env.XUNJIAN_SMOKE_APP_DIR):path.join(repo,'app');
 const protectedBuild=appDir!==path.join(repo,'app');
 await fs.mkdir(qa,{recursive:true});
 if(protectedBuild){const build=path.join(appDir,'../build');await fs.mkdir(build,{recursive:true});await fs.copyFile(path.join(repo,'build/icon.ico'),path.join(build,'icon.ico'));}
 const area=await fs.mkdtemp(path.join(qa,'smoke-'));
 const profile=path.join(area,'profile'),input=path.join(area,'输入原图'),output=path.join(area,'输出成果');
 await fs.mkdir(profile);await fs.mkdir(path.join(input,'测试线路','#001'),{recursive:true});await fs.mkdir(output);
 const key=crypto.randomBytes(32),requests=[];
 const server=http.createServer(async(req,res)=>{
  try{
   let body='';for await(const chunk of req)body+=chunk;
   const data=JSON.parse(decrypt(JSON.parse(body),key));
   requests.push({path:req.url,fields:Object.keys(data)});
   assert.equal(req.url,'/manage/api/v1/login');
   assert.equal(data.username,'qa-user');assert.ok(data.machineCode.startsWith('XJ'));
   const result={code:0,data:{username:'qa-user',access_token:'isolated-qa-token'}};
   res.writeHead(200,{'Content-Type':'application/json'});
   res.end(JSON.stringify({code:0,data:encrypt(JSON.stringify(result),key)}));
  }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({code:500,message:error.message}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const configPath=path.join(area,'service.json');
 await fs.writeFile(configPath,JSON.stringify({baseUrl:'http://127.0.0.1:'+server.address().port,keyBase64:key.toString('base64')}));
 const entry=path.join(area,'entry.cjs');
 await fs.writeFile(entry,`
const {app,dialog}=require('electron');
app.setPath('userData',${JSON.stringify(profile)});
const configModule=${JSON.stringify(path.join(appDir,'api-config.cjs'))};
require.cache[configModule]={id:configModule,filename:configModule,loaded:true,exports:{}};
app.on('browser-window-created',(_event,win)=>{win.show=()=>{};});
dialog.showOpenDialog=async(_win,options)=>({canceled:false,filePaths:[options.title.includes('服务')?${JSON.stringify(configPath)}:options.title.includes('输出')?${JSON.stringify(output)}:${JSON.stringify(input)}]});
dialog.showMessageBox=async(...args)=>{console.error('QA native message:',JSON.stringify(args.at(-1)));return {response:0};};
require(${JSON.stringify(path.join(appDir,'main.cjs'))});
`);
 const env={...process.env,XUNJIAN_API_BASE_URL:'http://127.0.0.1:'+server.address().port,XUNJIAN_API_KEY_BASE64:key.toString('base64')};
 delete env.ELECTRON_RUN_AS_NODE;
 let electron,page;const errors=[],checks=[];
 const check=async(label,fn)=>{await fn();checks.push(label);console.log('PASS '+label);};
 async function launch(){
  electron=await _electron.launch({executablePath:require('electron'),args:[entry],env,timeout:45000});
  page=await electron.firstWindow();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.waitForFunction(()=>window.XunjianDesktop&&window.XunjianAuth);
  assert.equal(await electron.evaluate(({app})=>app.getPath('userData')),profile);
 }
 async function settled(){await page.waitForFunction(()=>!window.XunjianDesktop.busy());}
 async function login(){
  await page.locator('#authUsername').fill('qa-user');
  await page.locator('#authPassword').fill('qa-password');
  await page.locator('#authSubmit').click();
  await page.waitForFunction(()=>!!window.XunjianAuth.current());
  if(await page.locator('#noticeClose').isVisible())await page.locator('#noticeClose').click();
 }
 async function close(){
  await settled();
  const result=await page.evaluate(()=>window.XunjianDesktop.prepareClose());
  assert.equal(result.ok,true,result.message);
  await electron.close();electron=null;
 }
 async function countGroups(){return page.evaluate(async()=>{const w=window.XunjianDesktop;return (await w.listOutputGroups(w.currentId())).length;});}
 try{
  await launch();
  await check('未登录显示登录页，主进程拒绝目录选择与成果修改',async()=>{
   assert.equal(await page.locator('#authLogin').isVisible(),true);
   for(const op of ['pick','trash-delete','trash-restore']){
    const r=await page.evaluate(op=>desktopAPI.invoke(op,{}),op);
    assert.equal(r.ok,false);assert.match(r.error.message,/重新登录/);
   }
   await page.screenshot({path:path.join(qa,'login.png')});
  });
  await check('真实 Electron IPC 联网加密登录，页面不持有 token',async()=>{
   assert.equal((await page.evaluate(()=>desktopAPI.getApiSettings())).configured,false);
   await page.locator('#authImportConfig').click();
   await page.waitForFunction(async()=>(await desktopAPI.getApiSettings()).configured);
   await login();
   const current=await page.evaluate(()=>XunjianAuth.current());
   assert.equal(current.username,'qa-user');assert.equal(current.token,undefined);
   assert.equal(requests.length,1);
   assert.deepEqual(requests[0].fields.sort(),['machineCode','password','username']);
   assert.equal((await fs.readFile(path.join(profile,'session.bin'))).includes(Buffer.from('isolated-qa-token')),false);
  });
  const picture=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=1000;c.height=700;const x=c.getContext('2d');
   x.fillStyle='#c6d8e6';x.fillRect(0,0,1000,700);
   x.fillStyle='#829e77';x.fillRect(0,520,1000,180);
   x.strokeStyle='#424b54';x.lineWidth=14;x.beginPath();x.moveTo(500,80);x.lineTo(430,650);x.moveTo(500,80);x.lineTo(570,650);x.moveTo(380,210);x.lineTo(620,210);x.stroke();
   x.lineWidth=3;for(const y of [170,210,250]){x.beginPath();x.moveTo(0,y-40);x.lineTo(1000,y+30);x.stroke();}
   return c.toDataURL('image/png').split(',')[1];
  });
  const original=path.join(input,'测试线路','#001','测试照片.png');
  await fs.writeFile(original,Buffer.from(picture,'base64'));
  const originalHash=crypto.createHash('sha256').update(await fs.readFile(original)).digest('hex');
  await check('选择中文目录并通过原生文件协议读取测试图片',async()=>{
   await page.locator('#btnFolder').click();
   await page.waitForFunction(()=>window.XunjianDesktop.diagnostics().photos===1);
   await settled();await page.locator('#btnOutput').click();
   await page.waitForFunction(()=>!!window.XunjianDesktop.roots().output);
   await settled();
  });
  await check('断开后端仍可圈图、添加标签并保存本地成果',async()=>{
   await new Promise(resolve=>server.close(resolve));
   const canvas=page.locator('canvas').first();
   const box=await canvas.boundingBox();assert.ok(box);
   await page.mouse.move(box.x+box.width*.42,box.y+box.height*.3);
   await page.mouse.down();
   await page.mouse.move(box.x+box.width*.58,box.y+box.height*.57,{steps:8});
   await page.mouse.up();
   const tag=page.locator('.def-item').first();await tag.click();
   await page.locator('#btnBottomSave').click();
   await page.waitForFunction(()=>document.getElementById('confirmModal').classList.contains('show')||XunjianDesktop.diagnostics().queue.completed>0);
   if(await page.locator('#confirmModalConfirm').isVisible())await page.locator('#confirmModalConfirm').click();
   await page.waitForFunction(()=>window.XunjianDesktop.diagnostics().queue.completed===1);
   await settled();assert.equal(await countGroups(),1);
   assert.equal(requests.length,1);
  });
  await check('二次编辑生成独立成果组，保留第一组',async()=>{
   await page.locator('#btnClearSecondary').click();
   await page.locator('.def-item').nth(1).click();
   await page.locator('#btnBottomSave').click();
   if(await page.locator('#confirmModalConfirm').isVisible())await page.locator('#confirmModalConfirm').click();
   await page.waitForFunction(()=>window.XunjianDesktop.diagnostics().queue.completed===2);
   await settled();assert.equal(await countGroups(),2);
   await page.screenshot({path:path.join(qa,'workspace.png')});
  });
  await check('按组删除进入回收站，恢复后两组成果均在',async()=>{
   const info=await page.evaluate(async()=>{const w=window.XunjianDesktop,id=w.currentId();return {id,group:(await w.listOutputGroups(id))[0]};});
   await page.evaluate(({id,group})=>XunjianDesktop.deleteOutputGroup(id,group.key,group.paths),info);
   assert.equal(await countGroups(),1);
   const rows=await page.evaluate(()=>XunjianDesktop.listTrash());assert.equal(rows.length,1);
   await page.evaluate(id=>XunjianDesktop.restoreOutput(id),rows[0].id);
   assert.equal(await countGroups(),2);
   const logs=await page.evaluate(()=>DesktopFS.call('operation-list'));
   assert.ok(logs.some(r=>r.action==='删除成果'));assert.ok(logs.some(r=>r.action==='恢复成果'));
  });
  await check('外部新增图片可同步，已有成果与输入原图保持完整',async()=>{
   await fs.writeFile(path.join(input,'测试线路','#001','新增照片.png'),Buffer.from(picture,'base64'));
   await settled();await page.evaluate(()=>XunjianDesktop.refresh(true));
   assert.equal(await page.evaluate(()=>XunjianDesktop.diagnostics().photos),2);
   assert.equal(crypto.createHash('sha256').update(await fs.readFile(original)).digest('hex'),originalHash);
  });
  await check('离线重启恢复加密会话和目录记忆',async()=>{
   await close();await launch();
   await page.waitForFunction(()=>XunjianAuth.current()&&XunjianDesktop.diagnostics().photos===2);
   await settled();
   assert.equal(await page.locator('#authLogin').isVisible(),false);
   const h=await page.evaluate(()=>XunjianDesktop.roots().output);
   assert.ok(h);assert.equal(requests.length,1);
  });
  await close();assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(qa,protectedBuild?'protected-smoke-report.json':'smoke-report.json'),JSON.stringify({version:'50.4.0',protectedBuild,platform:process.platform,checks,rendererErrors:errors,backend:'isolated encrypted loopback fixture',profile,photos:input},null,2));
  console.log('Electron smoke passed: '+checks.length+' scenarios.');
 }catch(error){
  if(page)await page.screenshot({path:path.join(qa,'smoke-failure.png')}).catch(()=>{});
  console.error('Renderer errors:',errors);
  throw error;
 }finally{
  if(electron)await electron.close().catch(()=>{});
  if(server.listening)await new Promise(resolve=>server.close(resolve));
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
