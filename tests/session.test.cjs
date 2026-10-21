'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {SessionService,LIFETIME}=require('../app/session.cjs');
function setup(t){
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'xunjian-session-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const key=crypto.randomBytes(32);let time=1792368000000;const calls=[];
 // 用独立测试密钥模拟系统密文存储，真实 Windows DPAPI 留给安装验证。
 const safeStorage={isEncryptionAvailable:()=>true,encryptString(text){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(text),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]);},decryptString(data){const d=crypto.createDecipheriv('aes-256-gcm',key,data.subarray(0,12));d.setAuthTag(data.subarray(12,28));return Buffer.concat([d.update(data.subarray(28)),d.final()]).toString();}};
 const options={dataDir,safeStorage,getMachineCode:async()=>'machine-a',now:()=>time,apiRequest:async args=>{calls.push(args);return {ok:true,status:200,data:{code:0,data:args.operation==='login'?{username:'admin',access_token:'secret-token'}:''}};}};
 const service=new SessionService(options);
 return {service,options,calls,advance:n=>{time+=n;},login:()=>service.api({operation:'login',body:{username:'admin',password:'test'}})};
}
test('主进程只接受登录接口签发会话，密文重启恢复且不返回 token',async t=>{
 const f=setup(t);assert.equal(f.service.current(),null);
 const r=await f.login();assert.equal(r.data.data.username,'admin');assert.equal(r.data.data.token,undefined);assert.equal(r.data.data.access_token,undefined);
 assert.equal(fs.readFileSync(f.service.file).includes(Buffer.from('secret-token')),false);
 const restored=new SessionService(f.options);await restored.load();assert.deepEqual(restored.current(),f.service.current());
 await assert.rejects(f.service.api({operation:'auth-state',token:'fake',loginAt:Date.now()}),/不支持/);
 await f.service.api({operation:'save',body:{img_name:'photo.JPG'},token:'fake'});assert.equal(f.calls.at(-1).token,'secret-token');
});
test('一天边界、时间回拨、密文修改和异机复制均拒绝授权',async t=>{
 assert.equal(LIFETIME,86400000);
 const f=setup(t);await f.login();f.advance(LIFETIME-1);assert.ok(f.service.current());f.advance(1);assert.equal(f.service.current(),null);assert.throws(()=>f.service.authorize('begin'),/重新登录/);
 const g=setup(t);await g.login();g.advance(-1);assert.equal(g.service.current(),null);
 const h=setup(t);await h.login();const other=new SessionService({...h.options,getMachineCode:async()=>'machine-b'});await other.load();assert.equal(other.current(),null);
 const bytes=fs.readFileSync(h.service.file);bytes[bytes.length-1]^=1;fs.writeFileSync(h.service.file,bytes);
 const corrupt=new SessionService(h.options);await corrupt.load();assert.equal(corrupt.current(),null);
});
test('未登录/退出后阻止关键写入，允许既有写入收尾与恢复读取',async t=>{
 const f=setup(t);
 for(const op of ['pick','begin','remove','move','organize','trash-delete','trash-restore'])assert.throws(()=>f.service.authorize(op),/重新登录/);
 assert.throws(()=>f.service.authorize('child',{create:true}),/重新登录/);
 for(const op of ['chunk','commit','abort','list','stat','recover-output'])assert.doesNotThrow(()=>f.service.authorize(op));
 await f.login();f.service.authorize('begin');f.service.logout();
 assert.throws(()=>f.service.authorize('begin'),/重新登录/);assert.equal(fs.existsSync(f.service.file),false);
 const restored=new SessionService(f.options);await restored.load();assert.equal(restored.current(),null);
});
test('系统安全存储不可用不降级明文，退出后迟到登录不得恢复会话',async t=>{
 const f=setup(t);f.options.safeStorage.isEncryptionAvailable=()=>false;await assert.rejects(f.login(),/安全存储/);assert.equal(f.service.current(),null);assert.equal(fs.existsSync(f.service.file),false);
 const g=setup(t);let finish;
 g.service.request=()=>new Promise(resolve=>{finish=resolve;});const login=g.login();g.service.logout();
 finish({ok:true,status:200,data:{code:0,data:{username:'admin',access_token:'late'}}});
 await assert.rejects(login,/状态已变化/);assert.equal(g.service.current(),null);
});
test('后端 401 撤销本地主进程会话',async t=>{
 const f=setup(t);await f.login();f.service.request=async()=>({ok:false,status:401,data:{code:401}});
 await f.service.api({operation:'save'});assert.equal(f.service.current(),null);assert.equal(fs.existsSync(f.service.file),false);
});
test('真实文件写入在到期后可完成既有句柄，新文件写入被阻止',async t=>{
 const f=setup(t),{FileService}=require('../app/fs-service.cjs');
 const files=new FileService(f.options.dataDir);await files.init();t.after(()=>files.cleanup());
 const root=await files.grant(f.options.dataDir);
 const invoke=async(op,args)=>{f.service.authorize(op,args);return files.call(op,args);};
 await f.login();const file=await invoke('child',{h:root,name:'result.JPG',kind:'file',create:true});
 const id=await invoke('begin',{h:file});f.advance(LIFETIME);
 await invoke('chunk',{id,bytes:Buffer.from('existing image')});await invoke('commit',{id});
 assert.equal(fs.readFileSync(path.join(f.options.dataDir,'result.JPG'),'utf8'),'existing image');
 await assert.rejects(invoke('begin',{h:file}),/重新登录/);
 await assert.rejects(invoke('child',{h:root,name:'new.JPG',kind:'file',create:true}),/重新登录/);
 assert.equal(fs.existsSync(path.join(f.options.dataDir,'new.JPG')),false);
});
