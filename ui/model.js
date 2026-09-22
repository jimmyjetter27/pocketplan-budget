(function(root,factory){if(typeof module==='object') module.exports=factory();else root.Model=factory();})(this,function(){
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function totals(state,month=today().slice(0,7),asOf=today()){
    let cash=0,savings=0,spent=0,saved=0,income=0;const categories={};
    for(const e of state.entries){
      if(e.date>asOf) continue;
      if(['opening','income','withdraw'].includes(e.kind)) cash+=e.amount;
      if(['expense','save'].includes(e.kind)) cash-=e.amount;
      if(['savingsOpening','save'].includes(e.kind)) savings+=e.amount;
      if(e.kind==='withdraw') savings-=e.amount;
      if(e.date.startsWith(month)){
        if(e.kind==='expense'){spent+=e.amount;categories[e.category]=(categories[e.category]||0)+e.amount;}
        if(e.kind==='save') saved+=e.amount;
        if(e.kind==='withdraw') saved-=e.amount;
        if(e.kind==='income') income+=e.amount;
      }
    }
    return {cash,savings,spent,saved,income,categories};
  }
  function payday(settings,asOf=today()){
    const [y,m,d]=asOf.split('-').map(Number);const last=new Date(y,m,0).getDate();
    const end=Math.min(settings.paydayEnd,last); const start=Math.min(settings.paydayStart,last);
    const target=d<=end?new Date(y,m-1,end):new Date(y,m,Math.min(settings.paydayEnd,new Date(y,m+1,0).getDate()));
    const days=Math.max(1,Math.round((target-new Date(y,m-1,d))/86400000)+1);
    return {days,start,end,inWindow:d>=start&&d<=end,overdue:d>end};
  }
  return {today,totals,payday};
});
