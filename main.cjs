const {app,BrowserWindow,ipcMain,dialog,powerMonitor}=require('electron');
const path=require('node:path'); const fs=require('node:fs'); const {Vault}=require('./lib/vault.cjs');
let win,vault; let busy=false;
if(!app.requestSingleInstanceLock()) app.quit();
else {
app.on('second-instance',()=>{win?.show();win?.focus();});
app.whenReady().then(()=>{
  vault=new Vault(path.join(process.env.POCKETPLAN_DATA_DIR || app.getPath('userData'),'budget.vault'));
  win=new BrowserWindow({width:1320,height:900,minWidth:950,minHeight:690,backgroundColor:'#101513',title:'PocketPlan',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  ipcMain.handle('planner',async(event,action,payload)=>{
    if(event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame) throw Error('Unauthorized request.');
    if(busy) return {error:'Another operation is in progress. Please try again.'};
    busy=true;
    try{
      let data;
      if(action==='status') data={exists:fs.existsSync(vault.file),path:vault.file};
      else if(action==='unlock') data=await vault.open(payload.password,payload.create);
      else if(action==='save') data=vault.save(payload);
      else if(action==='lock'){vault.close();data=true;}
      else if(action==='backup'){
        vault.read();const choice=await dialog.showSaveDialog(win,{title:'Save encrypted backup',defaultPath:`PocketPlan-${new Date().toISOString().slice(0,10)}.vault`,filters:[{name:'Encrypted PocketPlan vault',extensions:['vault']}]});
        if(!choice.canceled){if(path.resolve(choice.filePath).toLowerCase()===path.resolve(vault.file).toLowerCase()) throw Error('Choose a different location from your active vault.');fs.copyFileSync(vault.file,choice.filePath);data=true;}
      }else if(action==='restore'){
        vault.read(); const choice=await dialog.showOpenDialog(win,{filters:[{name:'PocketPlan vault',extensions:['vault']}],properties:['openFile']});
        if(!choice.canceled) data=await vault.restore(choice.filePaths[0],payload.password);
      }else throw Error('Unknown action.');
      return {data};
    }catch(e){return {error:e.message};}finally{busy=false;}
  });
  powerMonitor.on('lock-screen',()=>{if(!busy){vault.close();win.webContents.send('locked');}});
  win.loadFile('ui/index.html');
});
app.on('window-all-closed',()=>{vault?.close();app.quit();});
}
