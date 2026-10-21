'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {ApiSettings,validate}=require('../app/api-settings.cjs');
function fixture(t){
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'xunjian-settings-'));
 t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const key=crypto.randomBytes(32);
 const safeStorage={isEncryptionAvailable:()=>true,encryptString(value){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([c.update(value),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]);},decryptString(value){const d=crypto.createDecipheriv('aes-256-gcm',key,value.subarray(0,12));d.setAuthTag(value.subarray(12,28));return Buffer.concat([d.update(value.subarray(28)),d.final()]).toString();}};
 const options={dataDir,safeStorage,getMachineCode:async()=>'qa-machine'};
 const value={baseUrl:'https://example.test/',keyBase64:crypto.randomBytes(32).toString('base64')};
 return {options,value,settings:new ApiSettings(options)};
}
test('公开版未配置时可启动，登录明确要求导入配置',async t=>{
 const f=fixture(t);f.settings.load();assert.equal(f.settings.status().configured,false);
 await assert.rejects(f.settings.request({operation:'login'}),/导入服务配置/);
});
test('服务配置加密持久化，重启恢复且页面状态不暴露密钥',t=>{
 const f=fixture(t),status=f.settings.save(f.value);
 assert.equal(status.configured,true);assert.equal(status.baseUrl,'https://example.test');
 assert.equal(JSON.stringify(status).includes(f.value.keyBase64),false);
 assert.equal(fs.readFileSync(f.settings.file).includes(Buffer.from(f.value.keyBase64)),false);
 const next=new ApiSettings(f.options);next.load();assert.deepEqual(next.status(),status);
});
test('损坏配置锁定登录，系统安全存储不可用不会明文保存',t=>{
 const f=fixture(t);f.settings.save(f.value);fs.writeFileSync(f.settings.file,'broken');
 const next=new ApiSettings(f.options);next.load();assert.equal(next.status().configured,false);assert.match(next.status().error,/重新导入/);
 const g=fixture(t);g.options.safeStorage.isEncryptionAvailable=()=>false;
 assert.throws(()=>g.settings.save(g.value),/安全存储/);assert.equal(fs.existsSync(g.settings.file),false);
});
test('配置限制网络协议、固定接口路径并校验 AES 密钥',t=>{
 const f=fixture(t);
 for(const baseUrl of ['file:///C:/test','javascript:alert(1)','https://user:pass@example.test','https://example.test/?key=value'])assert.throws(()=>validate({...f.value,baseUrl}));
 assert.throws(()=>validate({...f.value,keyBase64:'invalid'}),/密钥/);
 assert.deepEqual(validate({...f.value,paths:{login:'https://evil.test'}}).paths,{login:'/manage/api/v1/login',save:'/manage/api/v1/labelRecord/save'});
 assert.equal(validate({...f.value,baseUrl:'http://127.0.0.1:1234'}).baseUrl,'http://127.0.0.1:1234');
});
