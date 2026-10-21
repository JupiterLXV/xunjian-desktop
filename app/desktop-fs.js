'use strict';
(function(){
 if(!window.desktopAPI)return;
 async function call(op,args={}){const r=await desktopAPI.invoke(op,args);if(!r.ok)throw new DOMException(r.error.message,r.error.name);return r.value;}
 class Handle{
  constructor(d){Object.assign(this,d);}
  queryPermission(){return call('permission',{h:this});} requestPermission(){return this.queryPermission();}
  async isSameEntry(other){return !!other&&this.root===other.root&&this.rel===other.rel;}
  async getFile(){const meta=await call('stat',{h:this});const response=await fetch('xunjian-file://'+this.root+'/'+this.rel.split('/').map(encodeURIComponent).join('/'));if(!response.ok)throw new DOMException('图片读取失败，请检查目录是否仍可访问','NotReadableError');const blob=await response.blob();const ext=this.name.split('.').pop().toLowerCase(),type=({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',bmp:'image/bmp',json:'application/json'})[ext]||'';return new File([blob],this.name,{type,lastModified:meta.lastModified});}
  async *entries(){for(const d of await call('list',{h:this}))yield [d.name,new Handle(d)];}
  async *values(){for await(const [,h]of this.entries())yield h;}
  async *keys(){for await(const [n]of this.entries())yield n;}
  [Symbol.asyncIterator](){return this.entries();}
  async getDirectoryHandle(name,opts={}){return new Handle(await call('child',{h:this,name,kind:'directory',create:!!opts.create}));}
  async getFileHandle(name,opts={}){return new Handle(await call('child',{h:this,name,kind:'file',create:!!opts.create}));}
  removeEntry(name,opts={}){return call('remove',{h:this,name,recursive:!!opts.recursive});}
  async move(name){const d=await call('move',{h:this,name});Object.assign(this,d);}
  async resolve(other){if(this.root!==other.root)return null;const prefix=this.rel?this.rel+'/':'';return other.rel===this.rel?[]:other.rel.startsWith(prefix)?other.rel.slice(prefix.length).split('/'):null;}
  async createWritable(){const id=await call('begin',{h:this});let closed=false;return {async write(data){if(closed)throw new DOMException('写入已结束','InvalidStateError');const blob=data instanceof Blob?data:new Blob([data]);for(let offset=0;offset<blob.size;offset+=1024*1024)await call('chunk',{id,bytes:new Uint8Array(await blob.slice(offset,offset+1024*1024).arrayBuffer())});},async close(){await call('commit',{id});closed=true;},async abort(){await call('abort',{id});closed=true;}};}
 }
 function revive(value){if(value?.__desktopHandle)return new Handle(value);if(Array.isArray(value))return value.map(revive);if(value&&typeof value==='object'){for(const key of Object.keys(value))value[key]=revive(value[key]);}return value;}
 window.DesktopFS={call,revive};
 window.showDirectoryPicker=async options=>new Handle(await call('pick',{id:options?.id,startIn:options?.startIn?.__desktopHandle?options.startIn:null}));
})();
