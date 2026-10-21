'use strict';
// Immutable backups stay beside the output. Recovery never overwrites unrelated files.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const ROOT='.xunjian-trash-v1',INDEX='.xunjian-output-v1.json',DIRS=['缺陷圈示图','缺陷原图','危急缺陷'];
const EMPTY={version:1,revision:0,records:[],garbage:[]};
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
async function hash(p){const h=crypto.createHash('sha256');for await(const b of require('node:fs').createReadStream(p))h.update(b);return h.digest('hex');}
async function atomic(p,data){const tmp=path.join(path.dirname(p),'.xunjian-write-'+crypto.randomUUID());try{const f=await fs.open(tmp,'wx');try{await f.writeFile(data);await f.sync();}finally{await f.close();}await fs.rename(tmp,p);}finally{await fs.unlink(tmp).catch(()=>{});}}
async function resolve(s,h,rel,create=false){const parts=rel.split('/');parts.forEach(x=>s.part(x));let d=h;for(const name of parts.slice(0,-1))d=await s.call('child',{h:d,name,kind:'directory',create});return s.locate({...d,rel:[d.rel,parts.at(-1)].filter(Boolean).join('/')},true);}
function valid(p){return typeof p==='string'&&DIRS.includes(p.split('/')[0])&&p.split('/').length>1&&!p.split('/').some(x=>!x||x==='.'||x==='..'||x.includes('\\'));}
async function readIndex(s,h){try{return JSON.parse(await fs.readFile(await resolve(s,h,INDEX),'utf8'));}catch(e){if(e.code==='ENOENT')return structuredClone(EMPTY);throw e;}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
async function exists(p){try{await fs.lstat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function copyExclusive(a,b){await fs.copyFile(a,b,fs.constants.COPYFILE_EXCL);const f=await fs.open(b,'r+');try{await f.sync();}finally{await f.close();}}
async function container(s,h,id,create=false){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('回收记录编号无效');const root=await s.call('child',{h,name:ROOT,kind:'directory',create});return s.call('child',{h:root,name:id,kind:'directory',create});}
async function manifest(s,h,id){const d=await container(s,h,id),p=await resolve(s,d,'manifest.json'),m=JSON.parse(await fs.readFile(p,'utf8'));if(m.version!==1||m.id!==id||!Array.isArray(m.items)||!m.items.every(x=>valid(x.path)&&/^[a-f0-9]{64}$/.test(x.hash))||!Array.isArray(m.records)||!m.records.every(r=>valid(r.dir+'/'+r.path)))throw Error('回收记录格式异常');return {d,p,m};}
async function entries(s,h){try{const d=await s.call('child',{h,name:ROOT,kind:'directory'});return (await s.call('list',{h:d})).filter(x=>x.kind==='directory'&&/^[a-f0-9-]{36}$/.test(x.name));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
async function rollback(s,h,{d,p,m}){
 const restoring=m.phase==='restoring',before=restoring?m.restoreBefore:m.before,after=restoring?m.restoreAfter:m.after;
 // Check index before any rollback: later edits must never be replaced by old metadata.
 const current=await readIndex(s,h);if(!same(current,before)&&!same(current,after))throw Error('输出记录被外部修改，恢复资料已保留，请先备份输出目录');
 for(let i=0;i<m.items.length;i++){const item=m.items[i],target=await resolve(s,h,item.path,true),backup=await resolve(s,d,'file-'+i);if(await hash(backup)!==item.hash)throw Error('回收备份校验失败，已停止恢复');
  if(await exists(target)){if(await hash(target)!==item.hash)throw Error('文件已被外部修改，未覆盖：'+item.path);if(restoring)await fs.unlink(target);}
  else if(!restoring)await copyExclusive(backup,target);
 }
 if(same(current,after))await atomic(await resolve(s,h,INDEX),JSON.stringify(before));
 m.phase=restoring?'deleted':'cancelled';m.error='上次操作中断，已安全回退';await atomic(p,JSON.stringify(m));
}
async function recover(s,h){for(const ent of await entries(s,h)){let row;try{row=await manifest(s,h,ent.name);}catch(e){if(e.code==='ENOENT')continue;throw e;}if(['prepared','restoring'].includes(row.m.phase))await rollback(s,h,row);}}
async function remove(s,{h,paths,records,expectedIndex,nextIndex,label}){
 if(!Array.isArray(paths)||paths.length>100000||!paths.every(valid)||new Set(paths.map(p=>p.toLowerCase())).size!==paths.length)throw Error('删除清单无效');
 await recover(s,h);if(!same(await readIndex(s,h),expectedIndex))throw Error('成果已变化，请刷新后重试');
 if(!Array.isArray(records)||!records.every(r=>paths.includes(r.dir+'/'+r.path)))throw Error('删除关联记录无效');
 if(!paths.length)return {count:0};
 const id=crypto.randomUUID(),d=await container(s,h,id,true),p=await resolve(s,d,'manifest.json');
 const m={version:1,id,time:new Date().toISOString(),label:String(label||'删除缺陷成果').slice(0,240),phase:'prepared',items:[],records,before:expectedIndex,after:nextIndex};let prepared=false;
 try{
  for(let i=0;i<paths.length;i++){const source=await resolve(s,h,paths[i]),backup=await resolve(s,d,'file-'+i);await copyExclusive(source,backup);m.items.push({path:paths[i],hash:await hash(backup)});}
  await atomic(p,JSON.stringify(m));prepared=true;
  for(const item of m.items){const source=await resolve(s,h,item.path);if(await hash(source)!==item.hash)throw Error('文件刚被修改，请刷新后重试：'+item.path);await fs.unlink(source);}
  if(!same(await readIndex(s,h),expectedIndex))throw Error('输出记录已改变');
  await atomic(await resolve(s,h,INDEX),JSON.stringify(nextIndex));m.phase='deleted';await atomic(p,JSON.stringify(m));
 }catch(e){if(prepared)await rollback(s,h,{d,p,m:{...m,phase:'prepared'}});throw e;}
 return {count:paths.length,id};
}
async function restore(s,{h,id}){
 await recover(s,h);const row=await manifest(s,h,id),{m,d,p}=row;if(m.phase!=='deleted')throw Error('这项记录当前无需恢复');
 const before=await readIndex(s,h),paths=new Set(m.items.map(x=>x.path));
 for(let i=0;i<m.items.length;i++){const item=m.items[i];if(await exists(await resolve(s,h,item.path,true)))throw Error('同名文件已存在，未覆盖：'+item.path);if(await hash(await resolve(s,d,'file-'+i))!==item.hash)throw Error('回收备份校验失败');}
 if(before.records.some(r=>paths.has(r.dir+'/'+r.path)))throw Error('当前成果已使用这些文件名，请先核对');
 const after={...before,revision:before.revision+1,records:before.records.concat(m.records),garbage:before.garbage.filter(r=>!paths.has(r.dir+'/'+r.path))};
 m.phase='restoring';m.restoreBefore=before;m.restoreAfter=after;await atomic(p,JSON.stringify(m));
 try{for(let i=0;i<m.items.length;i++)await copyExclusive(await resolve(s,d,'file-'+i),await resolve(s,h,m.items[i].path,true));if(!same(await readIndex(s,h),before))throw Error('输出记录已改变');await atomic(await resolve(s,h,INDEX),JSON.stringify(after));m.phase='restored';m.restoredAt=new Date().toISOString();await atomic(p,JSON.stringify(m));}
 catch(e){await rollback(s,h,{d,p,m:{...m,phase:'restoring'}});throw e;}
 return {count:m.items.length};
}
async function list(s,{h}){await recover(s,h);const rows=[];for(const ent of await entries(s,h)){try{const {m}=await manifest(s,h,ent.name);if(m.phase==='deleted')rows.push({id:m.id,time:m.time,label:m.label,count:m.items.length,paths:m.items.map(x=>x.path)});}catch(e){if(e.code!=='ENOENT')throw e;}}return rows.sort((a,b)=>b.time.localeCompare(a.time));}
module.exports={remove,restore,list,recover};
