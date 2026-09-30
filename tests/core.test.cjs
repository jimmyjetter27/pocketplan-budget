const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');
const {Vault,initial,validate}=require('../lib/vault.cjs');const {totals,payday}=require('../ui/model.js');
const entry=(kind,amount,date='2026-09-22',category='Miscellaneous')=>({id:crypto.randomUUID(),kind,amount,date,category,note:'Test'});
test('starting balances and transfers preserve total assets; opening savings is not a monthly transfer',()=>{
 const s=initial();assert.deepEqual({...totals(s,'2026-09','2026-09-22')},{cash:80000,savings:400000,spent:0,saved:0,income:0,categories:{}});
 s.entries.push(entry('income',712000),entry('save',200000),entry('expense',12345),entry('withdraw',5000));
 const t=totals(s,'2026-09','2026-09-22');assert.equal(t.cash,584655);assert.equal(t.savings,595000);assert.equal(t.spent,12345);assert.equal(t.saved,195000);assert.equal(t.cash+t.savings,1179655);
});
test('month filtering and future entries do not inflate present balances',()=>{
 const s=initial();s.entries.push(entry('expense',1000,'2026-08-31'),entry('income',999999,'2026-10-01'));
 assert.equal(totals(s,'2026-09','2026-09-22').spent,0);assert.equal(totals(s,'2026-08','2026-09-22').spent,1000);assert.equal(totals(s,'2026-09','2026-09-22').cash,79000);
});
test('payday clamps short months and includes today in remaining days',()=>{
 const settings=initial().settings;assert.equal(payday(settings,'2026-02-22').end,28);assert.equal(payday(settings,'2026-02-22').days,7);assert.equal(payday(settings,'2026-09-22').days,9);assert.equal(payday(settings,'2026-09-30').days,1);
});
test('validation rejects fractional money, invalid dates and injected record IDs',()=>{
 const s=initial();s.entries[0].amount=1.1;assert.throws(()=>validate(s));s.entries[0].amount=1;s.entries[0].date='2026-02-31';assert.throws(()=>validate(s));s.entries[0].date='2026-09-22';s.items[0].id='" onclick="bad';assert.throws(()=>validate(s));
});
test('household items support descriptive, non-numeric amounts',()=>{
 const s=initial();const gas=s.items.find(i=>i.name==='Cooking gas');assert.equal(gas.quantity,null);assert.equal(gas.quantityLabel,'Cylinder / refill');assert.doesNotThrow(()=>validate(s));
 gas.quantityLabel='Half cylinder';gas.unit='';assert.doesNotThrow(()=>validate(s));
 gas.quantityLabel='';gas.quantity=null;gas.unit='';assert.doesNotThrow(()=>validate(s));
});
test('vault passwords require at least four characters',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pocketplan-password-test-'));const file=path.join(dir,'budget.vault');const vault=new Vault(file);
 try {await assert.rejects(vault.open('abc',true),/4–1024/);await vault.open('abcd',true);assert.equal(vault.read().settings.salary,712000);} finally {vault.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('encrypted SQLite persists, rejects wrong passwords and tampering, restores across passwords',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pocketplan-test-'));const file=path.join(dir,'one.vault');const backup=path.join(dir,'backup.vault');let v=new Vault(file),other;
 try{
  const s=await v.open('test-password-one',true);s.entries.push(entry('expense',5555));v.save(s);fs.copyFileSync(file,backup);v.close();
  assert.equal(fs.readFileSync(file).includes(Buffer.from('Spending balance')),false);assert.equal(fs.readFileSync(file).includes(Buffer.from('SQLite format')),false);
  await assert.rejects(v.open('wrong-password'),/Incorrect/);await v.open('test-password-one');assert.equal(v.read().entries.at(-1).amount,5555);
  other=new Vault(path.join(dir,'two.vault'));await other.open('another-password',true);await other.restore(backup,'test-password-one');assert.equal(other.read().entries.at(-1).amount,5555);other.close();await other.open('another-password');
  const bad=fs.readFileSync(backup);bad[bad.length-1]^=1;fs.writeFileSync(backup,bad);await assert.rejects(other.restore(backup,'test-password-one'),/Incorrect/);assert.equal(other.read().entries.at(-1).amount,5555);
  const invalid=other.read();invalid.settings.salary=-1;assert.throws(()=>other.save(invalid));assert.equal(other.read().settings.salary,712000);
 }finally{v.close();other?.close();fs.rmSync(dir,{recursive:true,force:true});}
});

