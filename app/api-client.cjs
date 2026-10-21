'use strict';
const crypto=require('node:crypto');
const ERROR_TEXT='温馨提示：权限校验失败，请确保网络正常重新保存或重新登录';
function decodeKey(value){
 if(typeof value!=='string'||!value||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error('接口加密密钥配置无效');
 const key=Buffer.from(value,'base64');
 if(![16,24,32].includes(key.length))throw Error('接口加密密钥长度无效');
 return key;
}
function encrypt(plain,key){
 const iv=crypto.randomBytes(16),cipher=crypto.createCipheriv('aes-'+key.length*8+'-cbc',key,iv);
 return Buffer.concat([iv,cipher.update(plain,'utf8'),cipher.final()]).toString('base64');
}
function decrypt(value,key){
 if(typeof value!=='string'||!value||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error('接口响应密文格式错误');
 const raw=Buffer.from(value,'base64');
 if(raw.length<=16||(raw.length-16)%16!==0)throw Error('接口响应密文长度错误');
 try{const decipher=crypto.createDecipheriv('aes-'+key.length*8+'-cbc',key,raw.subarray(0,16));return Buffer.concat([decipher.update(raw.subarray(16)),decipher.final()]).toString('utf8');}
 catch{throw Error('接口响应解密失败');}
}
function createApiClient(config,{fetchImpl=globalThis.fetch,getMachineCode}={}){
 const key=decodeKey(config.keyBase64);
 return async function request(args){
  const op=args?.operation;
  if(!['login','save'].includes(op))throw Error('接口操作无效');
  let payload;
  if(op==='login'){
   if(typeof args.body?.username!=='string'||!args.body.username.trim()||typeof args.body?.password!=='string'||!args.body.password)throw Error('请输入用户名和密码');
   // 不信任页面传入的机器码，在主进程重新取得真实标识。
   const machineCode=await getMachineCode();if(typeof machineCode!=='string'||!machineCode.trim())throw Error('机器码读取失败');
   payload={username:args.body.username,password:args.body.password,machineCode};
  }else{
   if(typeof args.token!=='string'||!args.token)throw Error(ERROR_TEXT);
   const {line_name,tower_no,img_name}=args.body||{};
   if(![line_name,tower_no,img_name].every(v=>typeof v==='string'&&v.trim()))throw Error('保存字段不完整');
   payload={line_name,tower_no,img_name};
  }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),config.timeout);
  try{
   const response=await fetchImpl(config.baseUrl+config.paths[op],{
    method:'POST',headers:{'Content-Type':'application/json',...(op==='save'?{'x-auth-token':args.token}:{})},
    // Java 请求处理器允许 JSON 字符串引号，使用合法的 JSON 字符串作为请求体。
    body:JSON.stringify(encrypt(JSON.stringify(payload),key)),signal:controller.signal,redirect:'error',cache:'no-store'
   });
   // 认证过滤器可能在 ControllerAdvice 前返回空体 401。
   if(response.status===401)return {ok:false,status:401,data:{code:401}};
   const envelope=await response.json();
   if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))throw Error(ERROR_TEXT);
   let data;
   if(envelope.code===0){
    // 外层成功不代表业务成功；缺少加密数据时禁止降级为明文成功。
    data=JSON.parse(decrypt(envelope.data,key));
    if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.code!=='number')throw Error('接口解密后的业务响应格式错误');
   }else{
    // 网关或认证过滤器可能返回未加密错误，仅允许错误结果透传。
    if(typeof envelope.code!=='number')throw Error(ERROR_TEXT);
    data={code:envelope.code,message:typeof envelope.message==='string'?envelope.message:ERROR_TEXT};
   }
   return {ok:response.ok,status:response.status,data};
  }catch(e){
   if(e.name==='AbortError'||e.name==='TimeoutError'||e instanceof TypeError||e instanceof SyntaxError)throw Error(ERROR_TEXT);
   throw e;
  }finally{clearTimeout(timer);}
 };
}
module.exports={decodeKey,encrypt,decrypt,createApiClient};
