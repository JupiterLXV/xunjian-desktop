const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const script = fs.readFileSync(path.join(__dirname,'../app/renderer.js'),'utf8');
const authSource = fs.readFileSync(path.join(__dirname,'../app/auth.js'),'utf8');
async function setup(saved) {
  const elements=new Map();
  function get(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,disabled:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},focus(){},contains(){return false;}});return elements.get(id);}
  const storage=new Map(saved?[['xunjian_auth_v2',JSON.stringify(saved)]]:[]);
  const context={console,Event,navigator:{onLine:true},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{body:{classList:{toggle(){}}},getElementById:get,addEventListener(){}},window:{setInterval(fn){this.tick=fn;},desktopAPI:{getSession:async()=>saved&&Number.isFinite(saved.loginAt)&&Date.now()>=saved.loginAt&&Date.now()-saved.loginAt<86400000?{username:saved.username,loginAt:saved.loginAt,expiresAt:saved.loginAt+86400000,id:'session'}:null,logout:async()=>{saved=null;},getMachineCode:async()=>'XJ1-test-machine',apiRequest:async()=>({ok:true,status:200,data:{code:0,data:{username:'admin',id:'session',loginAt:Date.now(),expiresAt:Date.now()+86400000}}})},addEventListener(){},dispatchEvent(){}},alert(){}};
  vm.createContext(context);vm.runInContext(authSource,context);await context.XunjianAuth.ready;
  return {context,get,storage,auth:context.XunjianAuth};
}
const job={username:'admin',file:{relPath:'输入目录/线路/#001/照片.JPG'}};
test('页面篡改旧 localStorage 无法恢复授权，主进程到期通知锁定页面',async()=>{
  const s=await setup();
  s.storage.set('xunjian_auth_v2',JSON.stringify({username:'admin',token:'fake',loginAt:Date.now()}));
  assert.equal(s.auth.current(),null);
  s.context.window.desktopAPI.getSession=async()=>({username:'admin',id:'session',loginAt:Date.now(),expiresAt:Date.now()+10000});
  await s.context.window.tick();assert.ok(s.auth.current());
  s.context.window.desktopAPI.getSession=async()=>null;
  await s.context.window.tick();assert.equal(s.auth.current(),null);
  assert.equal(s.get('authLogin').hidden,false);assert.match(s.get('authError').textContent,/登录已过期/);
});
test('桌面业务与登录脚本语法有效',()=>{new vm.Script(script);new vm.Script(authSource);});
test('登录通过桥接提交机器码，保存会话并支持恢复、退出',async()=>{
  const s=await setup();
  s.context.window.desktopAPI.apiRequest=async args=>{
    assert.equal(args.operation,'login');
    assert.deepEqual(JSON.parse(JSON.stringify(args.body)),{username:'admin',password:'123456',machineCode:'XJ1-test-machine'});
    return {ok:true,status:200,data:{code:0,data:{username:'admin',id:'session',loginAt:Date.now(),expiresAt:Date.now()+86400000}}};
  };
  s.get('authUsername').value='admin';s.get('authPassword').value='123456';
  await s.get('authForm').handlers.submit({preventDefault(){}});
  assert.equal(s.auth.current().id,'session');assert.equal(s.auth.current().token,undefined);assert.equal(s.get('authPassword').value,'');
  assert.equal(s.storage.has('xunjian_auth_v2'),false);
  const restored=await setup(s.auth.current());
  assert.equal(restored.get('authLogin').hidden,true);
  restored.auth.isBusy=()=>true;await restored.get('authLogout').handlers.click();assert.ok(restored.auth.current());
  restored.auth.isBusy=()=>false;await restored.get('authLogout').handlers.click();assert.equal(restored.auth.current(),null);
});
test('保存只提交三个字段和 token，离线与失败阻止后续保存',async()=>{
  const s=await setup({username:'admin',token:'token',loginAt:Date.now()});let calls=0;
  s.context.window.desktopAPI.apiRequest=async args=>{
    calls++;assert.equal(args.operation,'save');assert.equal(args.token,undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(args.body)),{line_name:'线路',tower_no:'#001',img_name:'照片_异物（2）.JPG'});
    return {ok:true,status:200,data:{code:0,data:''}};
  };
  await s.auth.save(job,'照片_异物（2）.JPG');assert.equal(calls,1);
  s.context.navigator.onLine=false;await assert.rejects(s.auth.save(job,'x.JPG'),/权限校验失败/);assert.equal(calls,1);
  s.context.navigator.onLine=true;
  s.context.window.desktopAPI.apiRequest=async()=>({ok:true,status:200,data:{code:403,message:'无权保存'}});
  await assert.rejects(s.auth.save(job,'x.JPG'),/无权保存/);
  s.context.window.desktopAPI.apiRequest=async()=>{throw new Error('接口响应解密失败');};
  await assert.rejects(s.auth.save(job,'x.JPG'),/解密失败/);
  s.context.window.desktopAPI.apiRequest=async()=>({ok:false,status:401,data:{code:401}});
  await assert.rejects(s.auth.save(job,'x.JPG'),/权限校验失败/);assert.equal(s.auth.current(),null);
});
test('重名后的最终名称先校验再写入，校验拒绝则不执行图片事务', async () => {
  const source = script.slice(script.indexOf('  async function commitArtifacts('), script.indexOf('  async function deleteExistingDefectOutputs('));
  const order = [], root = {}, context = { output: { mainHandle: root }, outputLock: async (r, fn) => fn(), rawReadOutputIndex42: async () => ({ records: [], garbage: [], revision: 0 }), legacyRecords: async () => [], artifactParent: async (r,a) => ({ name:a.path,dir: { getFileHandle: async name => { if (name === '照片.JPG') return {}; throw Object.assign(new Error(), { name: 'NotFoundError' }); } } }), indexChange42: () => ({}), transaction42: async () => order.push('write'), cleanGarbage: async () => {}, legacyCache46: new WeakMap(), projectId: 'project' };
  vm.createContext(context);vm.runInContext(source, context);
  await context.commitArtifacts({ id:'id' }, [{ dir:'圈示图',path:'照片.JPG',blob:{} }], () => false, true, async items => { assert.equal(items[0].path,'照片（2）.JPG');order.push('check'); });
  assert.deepEqual(order,['check','write']);order.length=0;
  await assert.rejects(context.commitArtifacts({id:'id'},[{dir:'圈示图',path:'照片.JPG',blob:{}}],()=>false,true,async()=>{throw new Error('拒绝');}),/拒绝/);
  assert.deepEqual(order,[]);
});

test('机器码读取失败或为空时阻止登录请求', async () => {
  for (const getMachineCode of [async () => { throw new Error('机器码读取失败'); }, async () => '']) {
    const s=await setup();let calls=0;
    s.get('authUsername').value='admin';s.get('authPassword').value='123456';
    s.context.window.desktopAPI.getMachineCode=getMachineCode;
    s.context.fetch=async()=>{calls++;throw new Error('不应发送请求');};
    await s.get('authForm').handlers.submit({preventDefault(){}});
    assert.equal(calls,0);assert.equal(s.auth.current(),null);
    assert.match(s.get('authError').textContent,/机器码读取失败/);
    assert.equal(s.get('authSubmit').disabled,false);
  }
});

test('保存队列在离线和接口不可用时直接写入本地，不调用保存接口',async t=>{
  const os=require('node:os'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'xunjian-local-save-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const source=script.slice(script.indexOf('    async function execute(job){'),script.indexOf('    async function pump(){'));
  const root={},noop=()=>{};let apiCalls=0,completed=0;
  const context={projectId:'project',output:{mainHandle:root},savingPhoto46:null,exportBusy47:false,completed,paint:noop,recordOperation52:noop,cancelDetails38:noop,trimForExport46:noop,schedulePreload:noop,yield46:async()=>{},exportPhoto46:async()=>Buffer.from('boxed'),detail38:noop,state:{index:0},navDirection47:1,uid:()=> 'pair',DIR_BOX:'boxed',DIR_ORIG:'original',DIR_CRIT:'critical',navigator:{onLine:false},XunjianAuth:{save:async()=>{apiCalls++;throw Error('接口不可用');}},makeArtifact:(file,dir,kind,blob)=>({dir,path:'photo.JPG',blob}),commitArtifacts:async(file,additions,removeWhen,direct,beforeWrite)=>{
    assert.equal(beforeWrite,undefined);
    for(const a of additions){fs.mkdirSync(path.join(temp,a.dir),{recursive:true});fs.writeFileSync(path.join(temp,a.dir,a.path),a.blob);}
    return {};
  },setReview:noop,applySavedPhoto46:async()=>{},refreshSavedPreview47:noop,toast:noop,curName:()=> 'photo',flashSaved:noop,renderSide:noop,updateHud:noop,console};
  vm.createContext(context);vm.runInContext(source,context);
  const job={id:'photo',project:'project',root,clean:Buffer.from('original'),mime:'image/jpeg',boxes:[],file:{},tag:'',outputName:{},manual:false,meta:{}};
  await context.execute(job);
  assert.equal(apiCalls,0);assert.equal(job.status,'done');assert.equal(job.meta.saved,true);
  assert.equal(fs.readFileSync(path.join(temp,'boxed/photo.JPG'),'utf8'),'boxed');
  assert.equal(fs.readFileSync(path.join(temp,'original/photo.JPG'),'utf8'),'original');
});
