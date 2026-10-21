'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const JOURNAL='.xunjian-recovery-v1',INDEX='.xunjian-output-v1.json',DIRS=['缺陷圈示图','缺陷原图','危急缺陷'];
async function retry(job){for(let i=0;;i++){try{return await job();}catch(e){if(i>=4||!['EBUSY','EPERM','EACCES'].includes(e.code))throw e;await new Promise(r=>setTimeout(r,100*(i+1)));}}}
async function syncFile(p){const h=await fs.open(p,'r+');try{await h.sync();}finally{await h.close();}}
async function resolve(s,root,rel,create=false){
 if(typeof rel!=='string'||!rel)throw Error('整理路径无效');
 const parts=rel.split('/');parts.forEach(p=>s.part(p));let parent=root;
 for(const name of parts.slice(0,-1))parent=await s.call('child',{h:parent,name,kind:'directory',create});
 return s.locate({...parent,rel:[parent.rel,parts.at(-1)].filter(Boolean).join('/')},true);
}
async function atomic(p,data){const tmp=path.join(path.dirname(p),'.xunjian-write-'+crypto.randomUUID());try{const h=await fs.open(tmp,'wx');try{await h.writeFile(data);await h.sync();}finally{await h.close();}await retry(()=>fs.rename(tmp,p));}finally{await fs.unlink(tmp).catch(()=>{});}}
async function copyAtomic(source,target){const tmp=path.join(path.dirname(target),'.xunjian-write-'+crypto.randomUUID());try{await fs.copyFile(source,tmp,fs.constants.COPYFILE_EXCL);await syncFile(tmp);await retry(()=>fs.rename(tmp,target));}finally{await fs.unlink(tmp).catch(()=>{});}}
function validPath(p){return typeof p==='string'&&(p===INDEX||DIRS.includes(p.split('/')[0]))&&!p.split('/').some(x=>!x||x==='.'||x==='..'||x.includes('\\'));}
async function recover(s,root){
 let dir;try{dir=await s.call('child',{h:root,name:JOURNAL,kind:'directory'});}catch(e){if(e.code==='ENOENT')return;throw e;}
 const journalPath=await resolve(s,dir,'journal.json');let log;
 try{log=JSON.parse(await fs.readFile(journalPath,'utf8'));}catch(e){if(e.code==='ENOENT'){await s.call('remove',{h:root,name:JOURNAL,recursive:true});return;}throw Error('恢复记录无法读取，请保留输出目录：'+e.message);}
 if(log.version!==1||!['prepared','committed'].includes(log.phase)||!Array.isArray(log.items)||!log.items.every(x=>validPath(x.path)&&typeof x.existed==='boolean'))throw Error('恢复记录格式异常，已停止写入');
 if(log.phase==='prepared')for(let i=log.items.length-1;i>=0;i--){const item=log.items[i],target=await resolve(s,root,item.path,true);if(item.existed){const backup=await resolve(s,dir,'old-'+i);await copyAtomic(backup,target);}else await retry(()=>fs.unlink(target)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 await s.call('remove',{h:root,name:JOURNAL,recursive:true});
}
async function organize(s,{h:root,moves,expectedIndex}){
 if(!Array.isArray(moves)||!moves.length||moves.length>100000)throw Error('整理计划无效');
 await recover(s,root);const rootPath=await s.locate(root);if(!(await fs.stat(rootPath)).isDirectory())throw Error('请选择输出目录');
 const seen=new Set(),targets=new Set();
 for(const m of moves){if(!validPath(m.from)||!validPath(m.to)||m.from===INDEX||m.to===INDEX||m.from.split('/')[0]!==m.to.split('/')[0])throw Error('整理路径无效');const a=m.from.toLowerCase(),b=m.to.toLowerCase();if(seen.has(a)||targets.has(b)||a===b)throw Error('整理计划包含重复路径');seen.add(a);targets.add(b);}
 if([...targets].some(p=>seen.has(p)))throw Error('整理目标与原文件冲突，请重新整理');
 const idx=await resolve(s,root,INDEX);let doc={version:1,revision:0,records:[],garbage:[]};try{doc=JSON.parse(await fs.readFile(idx,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(JSON.stringify(doc)!==JSON.stringify(expectedIndex))throw Error('输出记录已改变，请重新点击分类整理');
 const mapping=new Map(moves.map(m=>[m.from,m.to]));const next=JSON.parse(JSON.stringify(doc));next.revision++;
 for(const row of next.records){const to=mapping.get(row.dir+'/'+row.path);if(to)row.path=to.slice(row.dir.length+1);}
 // Preflight all files before starting the journal. Never overwrite a destination.
 const sources=[];for(const m of moves){const from=await resolve(s,root,m.from);if(!(await fs.stat(from)).isFile())throw Error('源文件不可读取：'+m.from);const to=await resolve(s,root,m.to,true);try{await fs.stat(to);throw Error('目标文件已存在，请重新整理：'+m.to);}catch(e){if(e.code!=='ENOENT')throw e;}sources.push({from,to});}
 const dir=await s.call('child',{h:root,name:JOURNAL,kind:'directory',create:true}),journal=await resolve(s,dir,'journal.json');
 const items=moves.map(m=>({path:m.to,existed:false,deleted:false})).concat(moves.map(m=>({path:m.from,existed:true,deleted:true}))).concat([{path:INDEX,existed:await fs.stat(idx).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}),deleted:false}]);
 let prepared=false;const total=moves.length*2+1;
 try{
  for(let i=0;i<moves.length;i++){await fs.copyFile(sources[i].from,await resolve(s,dir,'old-'+(moves.length+i)),fs.constants.COPYFILE_EXCL);await syncFile(await resolve(s,dir,'old-'+(moves.length+i)));s.onProgress?.({phase:'备份',done:i+1,total:moves.length});}
  const indexPos=items.length-1;if(items[indexPos].existed){const backup=await resolve(s,dir,'old-'+indexPos);await fs.copyFile(idx,backup,fs.constants.COPYFILE_EXCL);await syncFile(backup);}
  await atomic(journal,JSON.stringify({version:1,phase:'prepared',items}));prepared=true;
  for(let i=0;i<moves.length;i++){await retry(()=>fs.copyFile(sources[i].from,sources[i].to,fs.constants.COPYFILE_EXCL));await syncFile(sources[i].to);s.onProgress?.({phase:'整理',done:i+1,total});}
  for(let i=0;i<moves.length;i++){await retry(()=>fs.unlink(sources[i].from));s.onProgress?.({phase:'整理',done:moves.length+i+1,total});}
  await atomic(idx,JSON.stringify(next));await atomic(journal,JSON.stringify({version:1,phase:'committed',items}));
 }catch(e){try{if(prepared)await recover(s,root);else await s.call('remove',{h:root,name:JOURNAL,recursive:true});}catch(r){throw Error('整理中断，恢复资料已保留；重新连接输出目录后恢复。'+r.message);}throw Error('整理未完成，原文件已保留或恢复：'+e.message);}
 await s.call('remove',{h:root,name:JOURNAL,recursive:true}).catch(()=>{});s.onProgress?.({phase:'完成',done:total,total});return {count:moves.length};
}
module.exports={organize,recover};
