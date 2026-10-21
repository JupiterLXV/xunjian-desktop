'use strict';
// Linux-only build adapter: extract NSIS's compiled uninstaller using the
// reader shipped with the pinned electron-builder version, without running Wine.
// The application, its permissions and the installed uninstaller are unchanged.
const path=require('node:path'),builder=require('electron-builder'),{Arch}=require('builder-util');
const {WineVmManager}=require('app-builder-lib/out/vm/WineVm');
const {UninstallerReader}=require('app-builder-lib/out/targets/nsis/nsisUtil');
const output=path.resolve(process.argv[2]||'dist');
if(process.platform!=='linux')throw Error('此辅助脚本仅用于 Linux 交叉构建；Windows 请运行 npm run dist。');
const original=WineVmManager.prototype.exec;
WineVmManager.prototype.exec=async function(file,args,options,...rest){
 if(path.resolve(file)===path.join(output,'图像标注软件-安装程序.exe')&&(!args||args.length===0)){
  await UninstallerReader.exec(file,file.slice(0,-3)+'__uninstaller.exe');
  return '';
 }
 return original.call(this,file,args,options,...rest);
};
builder.build({targets:builder.Platform.WINDOWS.createTarget(['nsis'],Arch.x64),config:{directories:{output,app:'.build/protected'}}}).catch(e=>{console.error(e);process.exitCode=1;});
