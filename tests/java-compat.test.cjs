'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync,spawnSync}=require('node:child_process');
const {encrypt,decrypt}=require('../app/api-client.cjs');
test('与后端原版 AesCrypto.java 双向互操作',t=>{
 const available=spawnSync('javac',['-version'],{encoding:'utf8',timeout:5000});
 if(available.error||available.status!==0){t.skip('当前环境未提供 JDK，需在有 JDK 的环境执行互操作验证');return;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xunjian-java-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'CryptoRunner.java'),`import java.util.Base64;import java.nio.charset.StandardCharsets;import com.torhang.labelimg.common.util.AesCrypto;public class CryptoRunner{public static void main(String[] a){byte[] key=Base64.getDecoder().decode(a[1]);if(a[0].equals("encrypt")){String plain=new String(Base64.getDecoder().decode(a.length>2?a[2]:""),StandardCharsets.UTF_8);System.out.print(AesCrypto.encrypt(plain,key));}else{System.out.print(Base64.getEncoder().encodeToString(AesCrypto.decrypt(a[2],key).getBytes(StandardCharsets.UTF_8)));}}}`);
 execFileSync('javac',['-encoding','UTF-8','-d',dir,path.join(__dirname,'fixtures/AesCrypto.java'),path.join(dir,'CryptoRunner.java')],{timeout:15000,stdio:'pipe'});
 const key=require('node:crypto').randomBytes(32);
 for(const plain of ['', 'a'.repeat(16), JSON.stringify({username:'测试用户',machineCode:'XJ1-TEST',img_name:'线路_#001_杆塔-异物.JPG'})]){
  const javaCipher=execFileSync('java',['-cp',dir,'CryptoRunner','encrypt',key.toString('base64'),Buffer.from(plain).toString('base64')],{encoding:'utf8',timeout:5000});
  assert.equal(decrypt(javaCipher,key),plain);
  const javaPlain=execFileSync('java',['-cp',dir,'CryptoRunner','decrypt',key.toString('base64'),encrypt(plain,key)],{encoding:'utf8',timeout:5000});
  assert.equal(Buffer.from(javaPlain,'base64').toString('utf8'),plain);
 }
});
