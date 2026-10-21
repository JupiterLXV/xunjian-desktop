const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktopAPI',{
 getApiSettings:async()=>{const r=await ipcRenderer.invoke('desktop:request','api-settings');if(!r.ok)throw Error(r.error.message);return r.value;},
 importApiConfig:async()=>{const r=await ipcRenderer.invoke('desktop:request','api-import');if(!r.ok)throw Error(r.error.message);return r.value;},
 apiRequest:async args=>{const result=await ipcRenderer.invoke('desktop:request','api-request',args);if(!result.ok)throw Error(result.error.message);return result.value;},
 getSession:async()=>{const r=await ipcRenderer.invoke('desktop:request','auth-state');if(!r.ok)throw Error(r.error.message);return r.value;},
 logout:async()=>{const r=await ipcRenderer.invoke('desktop:request','auth-logout');if(!r.ok)throw Error(r.error.message);return r.value;},
 getMachineCode:async()=>{const result=await ipcRenderer.invoke('desktop:request','device-info');if(!result.ok)throw Error(result.error.message);return result.value.machine;},
 invoke:(op,args)=>ipcRenderer.invoke('desktop:request',op,args),
 onFilesChanged:fn=>ipcRenderer.on('desktop:files-changed',()=>fn()),
 onProgress:fn=>ipcRenderer.on('desktop:progress',(_event,progress)=>fn(progress)),
 onAction:fn=>ipcRenderer.on('desktop:action',(_event,action)=>fn(action)),
 closeReady:result=>ipcRenderer.send('desktop:close-ready',result),
 onClose:fn=>ipcRenderer.on('desktop:prepare-close',()=>fn())
});
