const crypto = require('node:crypto');
const fs = require('node:fs');
const {promisify} = require('node:util');
const initSqlJs = require('sql.js');
const scrypt = promisify(crypto.scrypt);
const MAGIC = Buffer.from('PKTPLN01');
async function derive(password, salt) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 1024) throw Error('Use a password of 10–1024 characters.');
  return scrypt(password, salt, 32, {N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024});
}
function encrypt(bytes, key, salt) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MAGIC);
  const body = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}
async function decrypt(bytes, password) {
  if (bytes.length < 53 || !bytes.subarray(0,8).equals(MAGIC)) throw Error('This is not a PocketPlan backup.');
  const salt = bytes.subarray(8,24), key = await derive(password, salt);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(24,36));
    decipher.setAAD(MAGIC); decipher.setAuthTag(bytes.subarray(36,52));
    return {bytes: Buffer.concat([decipher.update(bytes.subarray(52)), decipher.final()]), key, salt};
  } catch { key.fill(0); throw Error('Incorrect password or damaged backup.'); }
}
function initial() {
  return {version:1, settings:{salary:712000, paydayStart:22, paydayEnd:31, savingsTarget:200000, rentTarget:0, theme:'dark'}, entries:[
    {id:crypto.randomUUID(), date:'2026-09-22', kind:'opening', category:'Opening balance', note:'Spending balance when you started', amount:80000},
    {id:crypto.randomUUID(), date:'2026-09-22', kind:'savingsOpening', category:'Savings', note:'Saved from this month’s bonus', amount:400000}
  ], items:['Liquid dish soap','Toilet paper','Cooking gas'].map(name=>({id:crypto.randomUUID(),name,quantity:1,unit:'each',price:null,status:'Check stock'})), budgets:{}};
}
function money(n) { return Number.isSafeInteger(n) && n >= 0 && n <= 100000000000; }
function validate(s) {
  if (!s || s.version!==1 || !s.settings || !Array.isArray(s.entries) || !Array.isArray(s.items) || !s.budgets || typeof s.budgets!=='object' || Array.isArray(s.budgets)) throw Error('Invalid planner data.');
  const p=s.settings;
  if (![p.salary,p.savingsTarget,p.rentTarget].every(money) || !Number.isInteger(p.paydayStart) || !Number.isInteger(p.paydayEnd) || p.paydayStart<1 || p.paydayEnd>31 || p.paydayEnd<p.paydayStart || !['light','dark'].includes(p.theme)) throw Error('Check your settings.');
  const str=(x,max=300)=>typeof x==='string' && x.length<=max;
  if(s.entries.length>100000 || s.items.length>10000) throw Error('Too many records.');
  const ids=new Set(),validId=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
  for(const e of s.entries){
    if(!validId(e.id)||ids.has(e.id)||!['opening','savingsOpening','expense','income','save','withdraw'].includes(e.kind)||!money(e.amount)||!str(e.note)||!str(e.category,80)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date) throw Error('Check transaction details.');
    ids.add(e.id);
  }
  for(const i of s.items) {if(!validId(i.id)||ids.has(i.id)||!str(i.name,100)||!i.name.trim()||!Number.isFinite(i.quantity)||i.quantity<0||i.quantity>100000||!str(i.unit,30)||!(i.price===null||money(i.price))||!['Available','Low stock','Out of stock','Check stock'].includes(i.status)) throw Error('Check household item details.');ids.add(i.id);}
  for(const [k,v] of Object.entries(s.budgets)) if(!str(k,80)||!money(v)) throw Error('Invalid budget.');
  return s;
}
class Vault {
  constructor(file){ this.file=file; }
  async open(password, create=false){
    if(this.db) throw Error('Vault already open.');
    const SQL=await initSqlJs();
    if(fs.existsSync(this.file)){
      const data=await decrypt(fs.readFileSync(this.file),password);
      this.key=data.key; this.salt=data.salt; this.db=new SQL.Database(data.bytes);
      try { validate(this.read()); } catch(e){this.close();throw e;}
    }else{
      if(!create) throw Error('Create your vault first.');
      this.salt=crypto.randomBytes(16); this.key=await derive(password,this.salt); this.db=new SQL.Database();
      this.db.run('CREATE TABLE planner (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)');
      this.db.run('INSERT INTO planner VALUES (1, ?)',[JSON.stringify(initial())]); this.persist();
    }
    return this.read();
  }
  read(){if(!this.db) throw Error('Unlock your vault first.'); return JSON.parse(this.db.exec('SELECT data FROM planner WHERE id=1')[0].values[0][0]);}
  save(state){validate(state); this.read(); const old=this.read(); this.db.run('UPDATE planner SET data=? WHERE id=1',[JSON.stringify(state)]); try{this.persist();}catch(e){this.db.run('UPDATE planner SET data=? WHERE id=1',[JSON.stringify(old)]);throw e;} return state;}
  persist(){const out=encrypt(Buffer.from(this.db.export()),this.key,this.salt); fs.mkdirSync(require('node:path').dirname(this.file),{recursive:true}); fs.writeFileSync(this.file+'.tmp',out,{mode:0o600}); fs.renameSync(this.file+'.tmp',this.file);}
  async restore(file,password){
    this.read(); const data=await decrypt(fs.readFileSync(file),password); const SQL=await initSqlJs(); let db;
    try{ db=new SQL.Database(data.bytes); const state=validate(JSON.parse(db.exec('SELECT data FROM planner WHERE id=1')[0].values[0][0])); fs.copyFileSync(this.file,this.file+'.bak'); return this.save(state); }finally{db?.close();data.key.fill(0);}
  }
  close(){this.db?.close();this.db=null;this.key?.fill(0);this.key=null;}
}
module.exports={Vault,initial,validate,encrypt,decrypt};
