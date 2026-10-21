'use strict';

// 在主进程处理，避免登录遮罩、保存等待等页面键盘拦截影响退出全屏。
function installFullscreenKeys(win){
  const toggle=()=>{if(!win.isDestroyed())win.setFullScreen(!win.isFullScreen());};
  win.webContents.on('before-input-event',(event,input)=>{
    if(win.isDestroyed()||input.control||input.alt||input.meta||input.shift)return;
    const key=input.key||input.code;
    if(key!=='F11'&&(key!=='Escape'||!win.isFullScreen()))return;
    // 同时取消菜单快捷键，防止一次 F11 切换两次；长按只处理首次按下。
    event.preventDefault();
    if(input.type!=='keyDown'||input.isAutoRepeat)return;
    if(key==='F11')toggle();else win.setFullScreen(false);
  });
  return toggle;
}

module.exports={installFullscreenKeys};
