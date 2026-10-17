const {test}=require('node:test'),assert=require('node:assert/strict');
const {Store}=require('../js/state.js'),A=require('../js/domain.js'),F=require('../js/focus.js');
const row=(id,nivel=3,problema='Ruido',categoria=A.areas[0][0])=>({id,nivel,problema,categoria,evento:'Situación privada',created_at:'2026-10-10T00:00:00Z'});
async function fixture(rows=[row('1')],preferences=new F.MemoryPreferences(),create=async()=>{}){
 const s=new Store({read:async()=>rows,create},()=>{},preferences);s.account({id:'u'});await s.load('analysis');return s;
}
test('clave SHA256 equivalente a iPhone y preferencias sin nombre ni texto',async()=>{
 const crypto=require('node:crypto');const key=await F.key(A.problemKey(' Ruído '));assert.equal(key,crypto.createHash('sha256').update('ruido').digest('hex'));
 const data=new Map(),prefs=new F.LocalPreferences({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)});const s=await fixture(undefined,prefs);await s.omitProblem('ruido');const json=[...data.values()][0];assert.ok(!json.includes('Ruido'));assert.ok(!json.includes('Situación privada'));assert.equal(s.archivedProblems.length,1);
 const other=await fixture(undefined,prefs);assert.equal(other.archivedProblems.length,1);other.account({id:'v'});await other.load('analysis');assert.equal(other.pendingProblems.length,1);
});
test('omitir conserva cálculos y reaparece con una nueva situación',async()=>{
 const s=await fixture([row('1'),row('2',5)]),before=A.analyze(s.analysis);await s.omitProblem('ruido');assert.equal(s.pendingProblems.length,0);assert.equal(s.archivedProblems.length,1);assert.deepEqual(A.analyze(s.analysis),before);
 s.analysis.push({...row('new'),created_at:new Date(Date.now()+1000).toISOString()});assert.equal(s.pendingProblems.length,1);assert.equal(s.archivedProblems.length,0);
});
test('recuperación individual, último elemento, otros períodos y error de persistencia',async()=>{
 const prefs=new F.MemoryPreferences(),s=await fixture([row('1'),row('2',4,'Otra')],prefs);await s.omitProblem('ruido');await s.omitProblem('otra');assert.equal(s.archivedProblems.length,2);
 const save=prefs.save.bind(prefs);prefs.save=()=>{throw Error('Sin espacio');};assert.throws(()=>s.restoreProblem('ruido'));assert.equal(s.archivedProblems.length,2);prefs.save=save;s.restoreProblem('ruido');assert.equal(s.pendingProblems[0].key,'ruido');s.restoreProblem('otra');assert.equal(s.archivedProblems.length,0);s.period='30';await s.load('analysis');assert.equal(s.pendingProblems.length,2);
});
test('preparar/cancelar no aparta, guardar sí, sin ocultar situaciones nuevas durante la escritura',async()=>{
 const rows=[row('1')],s=await fixture(rows);s.prepareAction({name:'Ruido',key:'ruido'},A.areas[0][0],rows);assert.equal(s.pendingProblems.length,1);s.clearActionDraft();assert.equal(s.pendingProblems.length,1);
 s.prepareAction({name:'Ruido',key:'ruido'},'',rows);s.analysis.push(row('2'));s.actionDraft='Mi acción';s.importance='4';await s.saveAction();assert.equal(s.pendingProblems.length,1);assert.equal(s.archivedProblems.length,0);
 s.prepareAction({name:'Ruido',key:'ruido'},'',s.analysis);s.actionDraft='Otro paso';s.importance='2';await s.saveAction();assert.equal(s.pendingProblems.length,0);assert.equal(s.archivedProblems.length,1);
 s.analysis.push(row('3'));assert.equal(s.pendingProblems.length,1);
 s.prepareAction({name:'Ruido',key:'ruido'});s.actionDraft='Segunda acción';s.importance='1';await s.saveAction();assert.equal(s.pendingProblems.length,1);
});
test('fallar al guardar conserva borrador/contexto y no aparta',async()=>{
 const s=await fixture(undefined,undefined,async()=>{throw Error('Sin conexión');});s.prepareAction({name:'Ruido',key:'ruido'},'',s.analysis);s.actionDraft='Paso';s.importance='4';await assert.rejects(s.saveAction());assert.equal(s.pendingProblems.length,1);assert.deepEqual(s.reviewedContext,['1']);assert.equal(s.actionDraft,'Paso');
});
test('acción creada con fallo de preferencia no se duplica y avisa',async()=>{
 let count=0;const prefs=new F.MemoryPreferences(),s=await fixture(undefined,prefs,async()=>count++);prefs.save=()=>{throw Error('No disponible');};s.prepareAction({name:'Ruido',key:'ruido'},'',s.analysis);s.actionDraft='Paso';s.importance='3';await s.saveAction();assert.equal(count,1);assert.equal(s.actionDraft,'');assert.equal(s.reviewedContext,null);assert.match(s.actionNotice,/Acción guardada.*No se pudo retirar/);assert.equal(s.pendingProblems.length,1);await assert.rejects(s.saveAction());assert.equal(count,1);
});
test('cambio de cuenta durante guardado no aparta ni limpia el borrador nuevo',async()=>{
 let finish;const pending=new Promise(r=>finish=r),s=await fixture(undefined,undefined,()=>pending);s.prepareAction({name:'Ruido',key:'ruido'},'',s.analysis);s.actionDraft='Paso';s.importance='2';const saving=s.saveAction();s.account({id:'v'});s.actionDraft='Otro usuario';finish();assert.equal(await saving,false);assert.equal(s.actionDraft,'Otro usuario');assert.deepEqual(s.dispositions,{});
});
test('carga/error no muestran focos viejos y falla de omisión no los oculta',async()=>{
 const prefs=new F.MemoryPreferences(),s=await fixture(undefined,prefs);prefs.save=()=>{throw Error('Error');};await assert.rejects(s.omitProblem('ruido'));assert.equal(s.pendingProblems.length,1);s.status.analysis={loading:true};assert.equal(s.pendingProblems.length,0);assert.equal(s.archivedProblems.length,0);s.status.analysis={error:'Error'};assert.equal(s.archivedProblems.length,0);
});
