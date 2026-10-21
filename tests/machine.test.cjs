'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {machineCode}=require('../app/machine.cjs');
test('机器码保留原有算法，规范化后稳定且按系统身份区分',()=>{
 const expected='XJ1-'+crypto.createHash('sha256').update('xunjian-desktop\0windows:device-a').digest('hex').toUpperCase().match(/.{8}/g).join('-');
 assert.equal(machineCode(' Windows:DEVICE-A '),expected);
 assert.notEqual(machineCode('windows:device-b'),expected);
 assert.match(expected,/^XJ1-(?:[A-F0-9]{8}-){7}[A-F0-9]{8}$/);
});
test('preload 提供专用机器码接口，主进程失败时不返回假机器码',async()=>{
 let api,result={ok:true,value:{machine:'XJ1-test'}};
 const sandbox={require:()=>({contextBridge:{exposeInMainWorld:(name,value)=>{assert.equal(name,'desktopAPI');api=value;}},ipcRenderer:{invoke:async(channel,op)=>{assert.equal(channel,'desktop:request');assert.equal(op,'device-info');return result;}}})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/preload.cjs'),'utf8'),sandbox);
 assert.equal(await api.getMachineCode(),'XJ1-test');
 result={ok:false,error:{message:'读取失败'}};
 await assert.rejects(api.getMachineCode(),/读取失败/);
});
test('桌面入口保留适配与登录，旧离线授权不再参与启动',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../app/main.cjs'),'utf8');
 assert.doesNotMatch(main,/LicenseManager|requireActive|license-import|license-status|activationEntry|activeEntry/);
 assert.match(main,/op==='device-info'/);
 const html=fs.readFileSync(path.join(__dirname,'../app/index.html'),'utf8');
 assert.match(html,/<body class="auth-locked">/);
 assert.match(html,/id="authForm"/);
 assert.match(html,/desktop-fs\.js.*auth\.js.*renderer\.js.*desktop-ui\.js/);
 const renderer=fs.readFileSync(path.join(__dirname,'../app/renderer.js'),'utf8');
 assert.match(renderer,/saveDrafts50/);assert.match(renderer,/restoreDrafts50/);assert.match(renderer,/prepareClose/);assert.match(renderer,/reconcileOutputs51/);
 assert.match(renderer,/retry:retry,dismiss:dismiss/);assert.match(renderer,/retryRecords48/);
});
