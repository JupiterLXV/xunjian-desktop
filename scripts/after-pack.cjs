'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
// 发行时保留 Electron 与 Chromium 随附的第三方许可声明。
module.exports=async function afterPack(context){
 if(context.electronPlatformName!=='win32')return;
 for(const name of ['LICENSE.electron.txt','LICENSES.chromium.html']){
  await fs.access(path.join(context.appOutDir,name));
 }
};
