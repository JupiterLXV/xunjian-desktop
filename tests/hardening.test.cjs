'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {hardenRuntime}=require('../app/hardening.cjs');
const {checkHtml}=require('../scripts/check-html.cjs');
test('发布版移除远程调试入口，开发版仍可调试',()=>{
 const removed=[];const app={isPackaged:false,commandLine:{removeSwitch:name=>removed.push(name)}};
 hardenRuntime(app);assert.deepEqual(removed,[]);app.isPackaged=true;hardenRuntime(app);
 assert.deepEqual(removed,['remote-debugging-port','remote-debugging-pipe','remote-allow-origins','auto-open-devtools-for-tabs']);
});
test('构建拒绝未混淆内联逻辑，当前 HTML 仅引用受保护脚本',()=>{
 for(const html of ['<script>alert(1)</script>','<button onclick="login()">','<a href="javascript:login()">','<script src="a.js">login()</script>'])assert.throws(()=>checkHtml(html));
 const root=path.join(__dirname,'..');checkHtml(fs.readFileSync(path.join(root,'app/index.html'),'utf8'));
 const main=fs.readFileSync(path.join(root,'app/main.cjs'),'utf8');assert.match(main,/sessions\.authorize\(op,args\)/);assert.match(main,/devTools:!app.isPackaged/);
 const config=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).build.electronFuses;
 assert.deepEqual(config,{runAsNode:false,enableNodeOptionsEnvironmentVariable:false,enableNodeCliInspectArguments:false,enableEmbeddedAsarIntegrityValidation:true,onlyLoadAppFromAsar:true});
});
