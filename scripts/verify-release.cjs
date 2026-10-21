'use strict';
// 静态读取最终 Windows EXE 与 ASAR，验证发布保护确实进入产物。
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),asar=require('@electron/asar');
const {getCurrentFuseWire,FuseV1Options}=require('@electron/fuses');
const {checkHtml}=require('./check-html.cjs');
async function verify(){
 const root=path.resolve(__dirname,'..'),out=path.join(root,'dist/win-unpacked');
 const exe=path.join(out,'图像标注软件.exe'),archive=path.join(out,'resources/app.asar');
 const icon=fs.readFileSync(path.join(out,'resources/icon.ico'));
 if(!icon.equals(fs.readFileSync(path.join(root,'build/icon.ico'))))throw Error('Windows 任务栏图标缺失或不符');
 const wire=await getCurrentFuseWire(exe);
 for(const [name,enabled] of Object.entries({RunAsNode:false,EnableNodeOptionsEnvironmentVariable:false,EnableNodeCliInspectArguments:false,EnableEmbeddedAsarIntegrityValidation:true,OnlyLoadAppFromAsar:true})){
  if(wire[FuseV1Options[name]]!==(enabled?49:48))throw Error('发布开关不符：'+name);
 }
 const {NtExecutable,NtExecutableResource}=await import('resedit');
 const entry=NtExecutableResource.from(NtExecutable.from(fs.readFileSync(exe))).entries.find(e=>String(e.type).toUpperCase()==='INTEGRITY'&&String(e.id).toUpperCase()==='ELECTRONASAR');
 if(!entry)throw Error('EXE 缺少 ASAR 完整性资源');
 const integrity=JSON.parse(Buffer.from(entry.bin).toString('utf8').replace(/\0+$/,''));
 const hash=crypto.createHash('sha256').update(asar.getRawHeader(archive).headerString).digest('hex');
 if(!integrity.some(item=>String(item.alg).toLowerCase()==='sha256'&&item.file.replace(/\\/g,'/')==='resources/app.asar'&&item.value===hash))throw Error('ASAR 完整性摘要不符');
 checkHtml(asar.extractFile(archive,'app/index.html').toString());
 const publicConfig={module:{exports:{}}};
 require('node:vm').runInNewContext(asar.extractFile(archive,'app/api-config.cjs').toString(),publicConfig,{timeout:1000});
 if(Object.keys(publicConfig.module.exports).length)throw Error('公开安装包不应内置服务配置');
 for(const file of asar.listPackage(archive))if(/api-config\.local|session\.bin|api-config\.bin|\.map$|[\\/]tests[\\/]/.test(file))throw Error('发布包出现私有或测试文件：'+file);

 const report=JSON.parse(fs.readFileSync(path.join(root,'.build/protection-report.json')));
 for(const item of report){
  const data=asar.extractFile(archive,'app/'+item.file.replace(/\\/g,'/'));
  if(crypto.createHash('sha256').update(data).digest('hex')!==item.outputSha256)throw Error('包内混淆文件不符：'+item.file);
 }
 console.log('发布校验通过：5 个 Fuses、EXE/ASAR 完整性摘要、HTML 脚本保护、'+report.length+' 个混淆文件，且无内置服务密钥。');
}
if(require.main===module)verify().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={verify};
