'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {FileService}=require('../app/fs-service.cjs');

async function fixture(t){
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'xunjian-integration-'));
 const input=path.join(base,'输入原图'),output=path.join(base,'输出成果');
 await fs.mkdir(input);await fs.mkdir(output);
 const service=new FileService(path.join(base,'profile'));await service.init();
 t.after(async()=>{await service.cleanup();await fs.rm(base,{recursive:true,force:true});});
 const inputHandle=await service.grant(input),h=await service.grant(output);
 return {base,input,output,service,inputHandle,h};
}
async function outputs(f){
 const dirs=['缺陷圈示图','缺陷原图','危急缺陷'];
 const records=dirs.map((dir,i)=>({dir,path:'线路/#001/照片_异物.JPG',photoId:'photo',pairId:'pair',kind:i===2?'auto':i===1?'original':'boxed',tag:'异物'}));
 const before={version:1,revision:1,records,garbage:[]};
 const after={...before,revision:2,records:[]};
 for(const r of records){
  const file=path.join(f.output,r.dir,r.path);
  await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'image:'+r.dir);
 }
 await fs.writeFile(path.join(f.output,'.xunjian-output-v1.json'),JSON.stringify(before));
 await fs.writeFile(path.join(f.input,'照片.JPG'),'untouched-original');
 return {records,before,after,paths:records.map(r=>r.dir+'/'+r.path)};
}

test('合并版回收三类成果并恢复索引，输入原图不变且操作留痕',async t=>{
 const f=await fixture(t),o=await outputs(f);
 const deleted=await f.service.call('trash-delete',{h:f.h,paths:o.paths,records:o.records,expectedIndex:o.before,nextIndex:o.after,label:'照片'});
 assert.equal(deleted.count,3);
 for(const file of o.paths)await assert.rejects(fs.stat(path.join(f.output,file)),{code:'ENOENT'});
 assert.equal((await f.service.call('trash-list',{h:f.h})).length,1);
 assert.equal((await f.service.call('trash-restore',{h:f.h,id:deleted.id})).count,3);
 for(const r of o.records)assert.equal(await fs.readFile(path.join(f.output,r.dir,r.path),'utf8'),'image:'+r.dir);
 const restored=JSON.parse(await fs.readFile(path.join(f.output,'.xunjian-output-v1.json'),'utf8'));
 assert.deepEqual(restored.records,o.before.records);
 assert.equal(await fs.readFile(path.join(f.input,'照片.JPG'),'utf8'),'untouched-original');
 assert.equal((await f.service.call('trash-list',{h:f.h})).length,0);
 const logs=await f.service.call('operation-list',{});
 assert.deepEqual(logs.map(r=>r.action),['删除成果','恢复成果']);
});

test('回收站恢复拒绝覆盖后来创建的同名文件',async t=>{
 const f=await fixture(t),o=await outputs(f);
 const deleted=await f.service.call('trash-delete',{h:f.h,paths:o.paths,records:o.records,expectedIndex:o.before,nextIndex:o.after});
 await fs.writeFile(path.join(f.output,o.paths[0]),'new-external-file');
 await assert.rejects(f.service.call('trash-restore',{h:f.h,id:deleted.id}),/同名文件已存在/);
 assert.equal(await fs.readFile(path.join(f.output,o.paths[0]),'utf8'),'new-external-file');
 assert.equal((await f.service.call('trash-list',{h:f.h})).length,1);
});

test('中断删除的恢复日志可在重新连接后恢复成果和旧索引',async t=>{
 const f=await fixture(t),o=await outputs(f);
 const deleted=await f.service.call('trash-delete',{h:f.h,paths:o.paths,records:o.records,expectedIndex:o.before,nextIndex:o.after});
 const manifest=path.join(f.output,'.xunjian-trash-v1',deleted.id,'manifest.json');
 const row=JSON.parse(await fs.readFile(manifest,'utf8'));row.phase='prepared';
 await fs.writeFile(manifest,JSON.stringify(row));
 await f.service.call('recover-output',{h:f.h});
 for(const file of o.paths)assert.ok(await fs.stat(path.join(f.output,file)));
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.output,'.xunjian-output-v1.json'),'utf8')),o.before);
 assert.equal((await f.service.call('trash-list',{h:f.h})).length,0);
});

test('目录快照识别嵌套增删修改，排除隐藏恢复资料和输出子目录',async t=>{
 const f=await fixture(t);
 await fs.mkdir(path.join(f.input,'线路','#001'),{recursive:true});
 await fs.mkdir(path.join(f.input,'缺陷原图'));
 await fs.mkdir(path.join(f.input,'.xunjian-trash-v1'));
 const picture=path.join(f.input,'线路','#001','照片.JPG');
 await fs.writeFile(picture,'one');
 await fs.writeFile(path.join(f.input,'缺陷原图','不要重复读.JPG'),'output');
 await fs.writeFile(path.join(f.input,'.xunjian-trash-v1','不要读.JPG'),'backup');
 const read=()=>f.service.call('snapshot',{h:f.inputHandle,mode:'input'});
 const initial=await read();assert.deepEqual(initial.rows.map(r=>r.path),['线路/#001/照片.JPG']);
 await fs.writeFile(picture,'changed-image');
 const changed=await read();assert.notEqual(initial.signature,changed.signature);
 await fs.writeFile(path.join(f.input,'新增.PNG'),'new');
 assert.equal((await read()).rows.length,2);
 await fs.unlink(picture);assert.deepEqual((await read()).rows.map(r=>r.name),['新增.PNG']);
});

test('目录监测发出通知，关闭监听后释放所有句柄',async t=>{
 const f=await fixture(t);
 let finish;
 const notification=new Promise(resolve=>{finish=resolve;});
 f.service.onFilesChanged=()=>finish(true);
 await f.service.call('watch',{handles:[f.inputHandle]});
 if(!f.service.watch.watchers.length){t.skip('当前平台不支持递归目录监听，仍可用快照轮询');return;}
 const timer=setTimeout(()=>finish(false),6000);
 try{
  await fs.writeFile(path.join(f.input,'新增.JPG'),'photo');
  assert.equal(await notification,true);
 }finally{clearTimeout(timer);f.service.watch.close();}
 assert.equal(f.service.watch.watchers.length,0);
});
