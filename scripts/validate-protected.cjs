'use strict';
// 把现有行为测试放到隔离目录，令相对 require 指向真正的混淆产物。
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),area=path.join(root,'.build/validation'),tests=path.join(area,'tests');
fs.mkdirSync(tests,{recursive:true});
const app=path.join(area,'app');
if(!fs.existsSync(app))fs.symlinkSync(path.join(root,'.build/protected/app'),app,process.platform==='win32'?'junction':'dir');
const selected=['api-client.test.cjs','fs.test.cjs','output-ops.test.cjs','java-compat.test.cjs','auth.test.cjs','machine.test.cjs','fullscreen.test.cjs','session.test.cjs','tray.test.cjs','desktop-integration.test.cjs','api-settings.test.cjs'];
for(const name of selected){
 let content=fs.readFileSync(path.join(root,'tests',name),'utf8');
 // 只运行行为测试：混淆后内部函数名和原始源码文本不再适合源码提取断言。
 if(name==='auth.test.cjs'){
  content=content.replace(/test\('重名后的最终名称[\s\S]*?(?=test\('机器码读取失败)/,'');
  content=content.replace(/test\('保存队列在离线[\s\S]*$/,'');
 }
 if(name==='machine.test.cjs')content=content.replace(/test\('桌面入口保留适配[\s\S]*$/,'');
 fs.writeFileSync(path.join(tests,name),content);
}
fs.cpSync(path.join(root,'tests/fixtures'),path.join(tests,'fixtures'),{recursive:true});
const result=spawnSync(process.execPath,['--test',...selected.map(name=>path.join(tests,name))],{stdio:'inherit',timeout:60000});
if(result.error)throw result.error;
process.exitCode=result.status||0;
