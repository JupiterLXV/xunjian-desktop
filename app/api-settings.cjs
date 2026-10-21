'use strict';
const fs=require('node:fs'),path=require('node:path');
const {decodeKey,createApiClient}=require('./api-client.cjs');
function validate(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('服务配置必须为 JSON 对象');
 let url;try{url=new URL(value.baseUrl);}catch{throw Error('服务地址无效，请填写完整的 http:// 或 https:// 地址');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('服务地址不允许账号、查询参数或其他协议');
 decodeKey(value.keyBase64);
 return {baseUrl:url.href.replace(/\/$/,''),keyBase64:value.keyBase64,paths:{login:'/manage/api/v1/login',save:'/manage/api/v1/labelRecord/save'},timeout:10000};
}
class ApiSettings{
 constructor({dataDir,safeStorage,defaults={},getMachineCode,fetchImpl}){
  this.file=path.join(dataDir,'api-config.bin');this.storage=safeStorage;this.options={getMachineCode,fetchImpl};this.config=null;this.client=null;this.error='';
  if(defaults.keyBase64&&defaults.baseUrl)this.activate(defaults);
 }
 available(){return this.storage.isEncryptionAvailable()&&this.storage.getSelectedStorageBackend?.()!=='basic_text';}
 activate(value){const config=validate(value);this.client=createApiClient(config,this.options);this.config=config;this.error='';}
 load(){
  if(!fs.existsSync(this.file))return;
  try{
   if(!this.available())throw Error('系统安全存储不可用');
   if(fs.statSync(this.file).size>65536)throw Error('配置文件大小异常');
   this.activate(JSON.parse(this.storage.decryptString(fs.readFileSync(this.file))));
  }catch{this.client=null;this.config=null;this.error='本机服务配置无法解密，请重新导入管理员提供的配置';}
 }
 status(){return {configured:!!this.config,baseUrl:this.config?.baseUrl||'',error:this.error};}
 save(value){
  const config=validate(value);
  if(!this.available())throw Error('系统安全存储不可用，无法安全保存服务配置');
  const temp=this.file+'.tmp';
  fs.writeFileSync(temp,this.storage.encryptString(JSON.stringify(config)),{mode:0o600});
  fs.renameSync(temp,this.file);this.activate(config);return this.status();
 }
 async request(args){if(!this.client)throw Error('请先点击“导入服务配置”，选择管理员提供的 JSON 文件');return this.client(args);}
}
module.exports={ApiSettings,validate};
