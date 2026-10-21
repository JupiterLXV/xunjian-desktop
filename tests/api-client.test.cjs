'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {encrypt,decrypt,decodeKey,createApiClient}=require('../app/api-client.cjs');
const key=crypto.randomBytes(32),config={baseUrl:'http://local.test',paths:{login:'/login',save:'/save'},timeout:100,keyBase64:key.toString('base64')};
function response(data,status=200){return {ok:status>=200&&status<300,status,json:async()=>({code:0,data:encrypt(JSON.stringify(data),key)})};}
test('CBC 密钥、随机 IV、中文与边界长度往返',()=>{
 assert.equal(decodeKey(config.keyBase64).length,32);
 for(const text of ['', 'a'.repeat(16),'中文线路 #001'])assert.equal(decrypt(encrypt(text,key),key),text);
 assert.notEqual(encrypt('same',key),encrypt('same',key));
 assert.throws(()=>decodeKey('bad'),/密钥/);assert.throws(()=>decrypt('%%%!',key),/格式/);assert.throws(()=>decrypt(Buffer.alloc(16).toString('base64'),key),/长度/);
});
test('登录请求整体加密，机器码由主进程取得；响应还原内层 token',async()=>{
 const request=createApiClient(config,{getMachineCode:async()=>'real-machine',fetchImpl:async(url,options)=>{
  assert.equal(url,'http://local.test/login');assert.equal(options.headers['Content-Type'],'application/json');
  const encoded=JSON.parse(options.body);assert.equal(typeof encoded,'string');assert.ok(!options.body.includes('secret'));
  assert.deepEqual(JSON.parse(decrypt(encoded,key)),{username:'user',password:'secret',machineCode:'real-machine'});
  return response({code:0,data:{username:'user',access_token:'token'}});
 }});
 const result=await request({operation:'login',body:{username:'user',password:'secret',machineCode:'forged'}});
 assert.equal(result.data.data.access_token,'token');
});
test('保存 header 不变；外层成功、内层失败不能视为成功',async()=>{
 const request=createApiClient(config,{fetchImpl:async(url,options)=>{
  assert.equal(url,'http://local.test/save');assert.equal(options.headers['x-auth-token'],'token');
  assert.deepEqual(JSON.parse(decrypt(JSON.parse(options.body),key)),{line_name:'线路',tower_no:'#001',img_name:'照片_缺陷.JPG'});
  return response({code:403,message:'权限不足'});
 }});
 const result=await request({operation:'save',token:'token',body:{line_name:'线路',tower_no:'#001',img_name:'照片_缺陷.JPG',extra:'discard'}});
 assert.equal(result.data.code,403);
 await assert.rejects(request({operation:'unknown'}),/操作无效/);
});
test('拒绝明文成功和错误密文，保留 HTTP 401 与业务 401',async()=>{
 const args={operation:'save',token:'token',body:{line_name:'l',tower_no:'t',img_name:'i'}};
 for(const data of [{code:0,data:{code:0}},{code:0,data:'invalid'},{code:0,data:encrypt('not json',key)}]){
  const request=createApiClient(config,{fetchImpl:async()=>({ok:true,status:200,json:async()=>data})});
  await assert.rejects(request(args));
 }
 const raw401=createApiClient(config,{fetchImpl:async()=>({ok:false,status:401,json:async()=>{throw Error('empty');}})});
 assert.equal((await raw401(args)).status,401);
 const inner401=createApiClient(config,{fetchImpl:async()=>response({code:401})});assert.equal((await inner401(args)).data.code,401);
});
test('网络异常与超时统一失败，读取机器码失败不发请求',async()=>{
 const args={operation:'save',token:'token',body:{line_name:'l',tower_no:'t',img_name:'i'}};
 const timeout=createApiClient({...config,timeout:5},{fetchImpl:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))))});
 await assert.rejects(timeout(args),/权限校验失败/);
 const offline=createApiClient(config,{fetchImpl:async()=>{throw TypeError('fetch failed');}});await assert.rejects(offline(args),/权限校验失败/);
 let called=false;const machineFailure=createApiClient(config,{getMachineCode:async()=>{throw Error('机器码读取失败');},fetchImpl:async()=>{called=true;}});
 await assert.rejects(machineFailure({operation:'login',body:{username:'u',password:'p'}}),/机器码/);assert.equal(called,false);
});
