const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('planner',{call:(action,payload)=>ipcRenderer.invoke('planner',action,payload),onLock:callback=>ipcRenderer.on('locked',()=>callback())});
