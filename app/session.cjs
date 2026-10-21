'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const LIFETIME=24*60*60*1000;
const denied=()=>Object.assign(Error('登录已过期或未登录，请重新登录'),{name:'NotAllowedError'});

// 凭据仅由主进程接收、持久化和读取，不接受页面提供的登录时间或 token。
class SessionService{
 constructor({dataDir,safeStorage,getMachineCode,apiRequest,now=Date.now}){
  this.file=path.join(dataDir,'session.bin');this.storage=safeStorage;this.machine=getMachineCode;this.request=apiRequest;this.now=now;this.session=null;this.revision=0;
 }
 available(){return this.storage.isEncryptionAvailable()&&this.storage.getSelectedStorageBackend?.()!=='basic_text';}
 async load(){
  if(!fs.existsSync(this.file)||!this.available())return;
  try{
   const value=JSON.parse(this.storage.decryptString(fs.readFileSync(this.file)));
   if(value.machine!==await this.machine())return;
   this.session=value;this.current();
  }catch{this.session=null;}
 }
 current(){
  const s=this.session,n=this.now();
  if(!s||typeof s.username!=='string'||!s.username||typeof s.token!=='string'||!s.token||!Number.isFinite(s.loginAt)||n<s.loginAt||n-s.loginAt>=LIFETIME){this.session=null;return null;}
  return {username:s.username,loginAt:s.loginAt,expiresAt:s.loginAt+LIFETIME,id:s.id};
 }
 require(){const value=this.current();if(!value)throw denied();return value;}
 logout(){
  this.revision++;this.session=null;
  // 删除失败必须报错，避免用户误以为重启后仍不会恢复会话。
  try{fs.unlinkSync(this.file);}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 authorize(op,args={}){
  // 已经开始的单文件写入允许完成/中止；新写入和目录变更必须重新校验。
  if(['pick','begin','remove','move','organize','trash-delete','trash-restore'].includes(op)||(op==='child'&&args.create))this.require();
 }
 async api(args={}){
  if(args.operation==='login'){
   const revision=++this.revision;
   const response=await this.request({operation:'login',body:args.body});
   if(!response.ok||response.data?.code!==0)return response;
   const result=response.data.data;
   if(typeof result?.access_token!=='string'||!result.access_token)throw Error('登录响应缺少 token');
   if(!this.available())throw Error('系统安全存储不可用，无法保存登录凭据');
   const machine=await this.machine();
   if(revision!==this.revision)throw Error('登录状态已变化，请重试');
   const session={username:result.username||args.body?.username,token:result.access_token,machine,loginAt:this.now(),id:crypto.randomUUID()};
   const temp=this.file+'.tmp';
   fs.writeFileSync(temp,this.storage.encryptString(JSON.stringify(session)),{mode:0o600});fs.renameSync(temp,this.file);
   this.session=session;
   return {...response,data:{...response.data,data:this.require()}};
  }
  if(args.operation!=='save')throw Error('不支持的接口操作');
  this.require();const token=this.session.token,revision=this.revision;
  const response=await this.request({operation:'save',body:args.body,token});
  if((response.status===401||response.data?.code===401)&&revision===this.revision)this.logout();
  return response;
 }
}
module.exports={SessionService,LIFETIME};
