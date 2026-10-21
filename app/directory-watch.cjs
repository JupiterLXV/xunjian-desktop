'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),crypto=require('node:crypto');
const OUTPUT=['缺陷圈示图','缺陷原图','危急缺陷'];
async function snapshot(s,{h,mode}){
 const rows=[],dirs=[],queue=[{h,p:''}];await s.locate(h);
 for(let i=0;i<queue.length;i++){const job=queue[i],dir=await s.locate(job.h),entries=await fsp.readdir(dir,{withFileTypes:true});
  for(const ent of entries){if(ent.name.startsWith('.')||ent.isSymbolicLink())continue;const p=job.p+ent.name,handle=s.descriptor(h.root,[job.h.rel,ent.name].filter(Boolean).join('/'),ent.isDirectory()?'directory':'file');
   if(ent.isDirectory()){if(mode==='input'&&OUTPUT.includes(ent.name))continue;if(mode==='output'&&i===0&&!OUTPUT.includes(ent.name))continue;dirs.push({path:p+'/',handle,parent:job.h});queue.push({h:handle,p:p+'/'});}
   else if(ent.isFile()&&/\.(jpe?g|png|webp|bmp|tiff?)$/i.test(ent.name)){try{const stat=await fsp.stat(await s.locate(handle));rows.push({path:p,name:ent.name,handle,size:stat.size,mtime:stat.mtimeMs,ctime:stat.ctimeMs});}catch(e){if(e.code!=='ENOENT')throw e;}}
  }
 }
 rows.sort((a,b)=>a.path.localeCompare(b.path));dirs.sort((a,b)=>a.path.localeCompare(b.path));
 const signature=crypto.createHash('sha256').update(JSON.stringify([dirs.map(d=>d.path),rows.map(r=>[r.path,r.size,r.mtime,r.ctime])])).digest('hex');return {signature,rows,dirs};
}
class DirectoryWatch{
 constructor(s){this.s=s;this.watchers=[];this.timer=null;this.key='';}
 async set(handles){if(!Array.isArray(handles)||handles.length>2)throw Error('目录监听参数无效');const key=JSON.stringify(handles.map(h=>[h.root,h.rel]));if(key===this.key)return true;this.close();this.key=key;
  for(const h of handles){const p=await this.s.locate(h);try{const w=fs.watch(p,{recursive:true},(_event,name)=>{if(name&&String(name).split(/[\\/]/).some(x=>x.startsWith('.')))return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.s.onFilesChanged?.(),600);});w.on('error',()=>this.s.onFilesChanged?.());this.watchers.push(w);}catch{/* The renderer also polls and refreshes on focus. */}}
  return true;
 }
 close(){clearTimeout(this.timer);for(const w of this.watchers)w.close();this.watchers=[];this.key='';}
}
module.exports={snapshot,DirectoryWatch};
