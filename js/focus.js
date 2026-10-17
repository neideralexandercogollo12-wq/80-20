(function(root){
  'use strict';
  async function key(value){
    const cryptoAPI = root.crypto;
    if(!cryptoAPI?.subtle)throw new Error('Abre Pareto desde HTTPS para guardar las preferencias de focos.');
    const hash=await cryptoAPI.subtle.digest('SHA-256',new TextEncoder().encode(value));
    return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  function includes(mark,row){
    if(mark.reviewed?.includes(row.id))return true;
    const date=Date.parse(row.created_at);
    return Number.isFinite(date)&&(date<mark.through||(date===mark.through&&mark.boundary?.includes(row.id)));
  }
  function omitted(rows,now=Date.now()){
    const through=Math.max(now,...rows.map(r=>Date.parse(r.created_at)).filter(Number.isFinite));
    return {through,boundary:rows.filter(r=>Date.parse(r.created_at)===through).map(r=>r.id),reviewed:[]};
  }
  function reviewed(ids,previous){return {through:previous?.through??0,boundary:previous?.boundary||[],reviewed:[...new Set([...(previous?.reviewed||[]),...ids])]};}
  class MemoryPreferences{
    constructor(){this.accounts=new Map();}
    load(user){return structuredClone(this.accounts.get(user)||{});}
    save(user,values){this.accounts.set(user,structuredClone(values));}
  }
  class LocalPreferences{
    constructor(storage){this.storage=storage;}
    storageKey(user){return 'pareto.focus.v1.'+user;}
    load(user){
      const parsed=JSON.parse(this.storage.getItem(this.storageKey(user))||'{}');
      if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw Error('Preferencias de focos no disponibles.');
      for(const [hash,m] of Object.entries(parsed)){
        if(!/^[a-f0-9]{64}$/.test(hash)||!m||!Number.isFinite(m.through)||!Array.isArray(m.boundary)||!Array.isArray(m.reviewed)||![...m.boundary,...m.reviewed].every(id=>typeof id==='string'))throw Error('Preferencias de focos no disponibles.');
      }
      return parsed;
    }
    save(user,values){this.storage.setItem(this.storageKey(user),JSON.stringify(values));}
  }
  const api={key,includes,omitted,reviewed,MemoryPreferences,LocalPreferences};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ParetoFocus=api;
})(globalThis);
