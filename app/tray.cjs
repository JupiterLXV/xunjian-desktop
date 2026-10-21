'use strict';
// 托盘退出沿用窗口关闭流程，确保等待保存并保留失败任务保护。
function createTray({Tray,Menu,icon,getWindow}){
 const tray=new Tray(icon);
 const show=()=>{
  const win=getWindow();if(!win||win.isDestroyed())return;
  if(win.isMinimized())win.restore();win.show();win.focus();
 };
 tray.setToolTip('图像标注软件');
 tray.setContextMenu(Menu.buildFromTemplate([
  {label:'显示主窗口',click:show},
  {type:'separator'},
  {label:'退出',click:()=>{const win=getWindow();if(win&&!win.isDestroyed()){show();win.close();}}}
 ]));
 tray.on('click',show);tray.on('double-click',show);
 return tray;
}
module.exports={createTray};
