const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../js/domain.js'),{Service}=require('../js/service.js'),{Store}=require('../js/state.js'),X=require('../js/excel.js');
const bounds={start:new Date('2026-10-12T00:00:00Z'),end:new Date('2026-10-19T00:00:00Z')};
const row=(id='1',nivel=3,problema='Ruido',categoria=A.areas[0][0])=>({id,nivel,problema,categoria,evento:'Situación '+id,emocion:'',created_at:'2026-10-13T12:00:00Z',nivel_original_10:8});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('30 descripciones, ausencia de selección, nivel conservado y referencias heredadas',()=>{
  const prefixes=['Apenas interfiere con','Interfiere un poco con','Interfiere de forma apreciable con','Interfiere mucho con','Dificulta seriamente'];
  const contexts=['mi concentración o mi avance.','mi comunicación o el cuidado de mis vínculos.','mi descanso, energía o cuidado personal.','mi organización económica o mi sensación de seguridad.','mis tareas o rutinas cotidianas.','mi claridad o tranquilidad interior.'];
  A.areas.forEach(([area],i)=>{for(let n=1;n<=5;n++)assert.equal(A.frictionDescription(area,n),prefixes[n-1]+' '+contexts[i]);});
  assert.match(A.frictionDescription('Trabajo',null),/Elige un nivel/);assert.match(A.frictionDescription('Trabajo',3),/necesita atención/);
});
test('períodos locales: hoy, semana lunes/domingo, ventanas, sin semanas futuras',()=>{
  const now=new Date(2026,9,18,23,30),today=A.periodBounds('today',0,now),week=A.periodBounds('week',0,now);
  assert.equal(today.start.getDate(),18);assert.equal(today.end.getDate(),19);assert.equal(today.start.getHours(),0);
  assert.equal(week.start.getDate(),12);assert.equal(week.end.getDate(),19);assert.equal(A.periodBounds('week',1,now).start.getTime(),week.start.getTime());
  for(const n of [30,90])assert.equal((A.periodBounds(String(n),0,now).end-A.periodBounds(String(n),0,now).start)/86400000,n);
  assert.equal(now.getHours(),23);
});
test('normalización, recurrencia, medias y denominador clasificado',()=>{
  const r=A.analyze([row('1',5,'  Comunicación  '),row('2',3,'comunicacion','Alma'),row('3',4,null)]);
  assert.equal(r.problems.length,1);assert.equal(r.problems[0].average,4);assert.equal(r.problems[0].share,100);assert.equal(r.problems[0].recurrent,true);
  assert.equal(r.total,12);assert.equal(r.classifiedLoad,8);assert.equal(r.unclassifiedLoad,4);assert.ok(Math.abs(r.coverage-200/3)<1e-10);
});
test('80 % exacto, cruce, empates y un único problema',()=>{
  const exact=A.analyze([row('a',4,'A'),row('b',1,'B')]);assert.equal(exact.priorityCount,1);assert.equal(exact.problems[0].cumulative,80);
  assert.equal(A.analyze([row('a',5,'A'),row('b',2,'B'),row('c',1,'C')]).priorityCount,2);
  assert.deepEqual(A.analyze([row('a',5,'A'),row('b',3,'B'),row('c',2,'B'),row('d',5,'C')]).problems.map(p=>p.name),['B','A','C']);
  assert.equal(A.analyze([row()]).problems[0].cumulative,100);assert.equal(A.analyze([]).priorityCount,0);
});
test('área exacta, heredadas separadas, problema compartido y límites de período',()=>{
  const rows=[row('a',5,'X','Trabajo'),row('b',3,'X'),{...row('c',4,'X'),created_at:bounds.end.toISOString()}];
  const filtered=A.scope(rows,bounds,'Trabajo');assert.equal(filtered.length,1);assert.equal(A.analyze(filtered).problems[0].load,5);
  assert.equal(A.categoryTotals(rows).find(([n])=>n==='Trabajo')[1],5);assert.equal(A.areaLabel('Trabajo'),'Trabajo (anterior)');
});
test('situaciones no agrupan textos repetidos, orden por nivel/fecha/id, porcentajes',()=>{
  const rows=[{...row('b',4),evento:'igual'},{...row('a',4),evento:'igual',problema:null},row('c',2)];
  const p=A.situationPoints(rows,bounds);assert.deepEqual(p.map(p=>p.key),['a','b','c']);assert.deepEqual(p.map(p=>p.priority),[true,true,false]);assert.equal(p.at(-1).cumulative,100);
  assert.equal(p.reduce((n,p)=>n+p.share,0),100);assert.equal(A.situationPoints([row()],bounds)[0].share,100);
});
test('filtros de historial normalizados, paginación estable y colores salvia',()=>{
  const rows=[row('a'),{...row('b'),evento:'Concentración'}];assert.equal(A.filterHistory(rows,{query:'concentracion'})[0].id,'b');assert.equal(A.filterHistory(rows,{area:'Alma'}).length,0);
  assert.deepEqual(A.filterHistory(rows).map(r=>r.id),['b','a']);assert.equal(A.sage(1),'#B7CCC0');assert.equal(A.sage(3),'#96B8A5');assert.equal(A.sage(5),'#769B87');
});
test('validación cinco campos, límites escalares, vacíos y área heredada',()=>{
  const draft={...row(),evento:'  '+ 'é'.repeat(500)+'  ',emocion:'x'.repeat(80),problema:'a'.repeat(120)};
  const patch=A.validateRecord(draft);assert.equal(patch.evento.length,500);assert.deepEqual(Object.keys(patch).sort(),['categoria','emocion','evento','nivel','problema']);
  assert.equal(A.validateRecord({...draft,emocion:'',problema:'  '}).problema,null);
  for(const change of [{evento:''},{evento:'x'.repeat(501)},{emocion:'x'.repeat(81)},{problema:'x'.repeat(121)},{nivel:0},{nivel:6},{categoria:'Trabajo'}])assert.throws(()=>A.validateRecord({...draft,...change}));
  assert.equal(A.validateRecord({...draft,categoria:'Trabajo'},'Trabajo').categoria,'Trabajo');
});
test('acciones: importancia independiente, sin valorar y completadas',()=>{
  const action=(id,importancia,completada=false)=>({id,importancia,completada,created_at:id==='b'?'2026-01-02':'2026-01-01'});
  assert.deepEqual(A.orderActions([action('c',null),action('b',5),action('a',5),action('d',5,true)]).map(r=>r.id),['a','b','c','d']);
  assert.equal(A.importanceLabel(null),'Sin valorar');
});
function dbFixture(rows){
  const calls=[];return {calls,from(table){const call={table,filters:[],orders:[]};calls.push(call);const q={select(c){call.columns=c;return q;},eq(k,v){call.filters.push([k,v]);return q;},order(k,v){call.orders.push([k,v]);return q;},gte(k,v){call.start=v;return q;},lt(k,v){call.end=v;return q;},range(a,b){call.range=[a,b];return Promise.resolve({data:rows.slice(a,b+1)});},update(p){call.patch=p;return q;},delete(){call.deleted=true;return q;},insert(p){call.patch=p;return q;},then(resolve){resolve({data:rows});}};return q;}};
}
test('servicio pagina 1201 registros con propietario y orden estable',async()=>{
  const db=dbFixture(Array.from({length:1201},(_,i)=>row(String(i)))),s=new Service(db);assert.equal((await s.read('u1',{bounds})).length,1201);
  assert.equal(db.calls.length,3);for(const c of db.calls){assert.deepEqual(c.filters,[['user_id','u1']]);assert.equal(c.start,bounds.start.toISOString());assert.equal(c.end,bounds.end.toISOString());assert.deepEqual(c.orders.map(([k])=>k),['created_at','id']);}
});
test('actualizaciones y borrados exigen propietario/id y detectan registro eliminado',async()=>{
  const db=dbFixture([row()]),s=new Service(db),patch=A.validateRecord(row());await s.change('u','fricciones','1',patch);assert.deepEqual(db.calls[0].filters,[['user_id','u'],['id','1']]);assert.deepEqual(db.calls[0].patch,patch);
  await assert.rejects(new Service(dbFixture([])).change('u','fricciones','x',patch),/ya no/);
});
test('lecturas tardías de período o cuenta no restauran datos',async()=>{
  const d=deferred(),s=new Store({read:()=>d.promise});s.account({id:'u'});const pending=s.load('analysis');s.account({id:'v'});d.resolve([row()]);await pending;assert.equal(s.analysis.length,0);
  let calls=0;const a=deferred();s.service={read:()=>++calls===1?a.promise:Promise.resolve([row('nuevo')])};const old=s.load('analysis');await s.setPeriod('today');a.resolve([row('viejo')]);await old;assert.equal(s.analysis[0].id,'nuevo');
});
test('guardado invalida cambio de cuenta y no aplica refrescos viejos',async()=>{
  const d=deferred();let reads=0;const s=new Store({create:()=>d.promise,read:()=>{reads++;return []}});s.account({id:'u'});const pending=s.saveRecord(row());s.account({id:'v'});d.resolve();assert.equal(await pending,false);assert.equal(reads,0);
});
test('edición conserva identidad/fecha/respaldo y recalcula tras reclasificación',async()=>{
  let records=[row()],sent;const s=new Store({read:async()=>records,change:async(_u,_t,id,p)=>{sent=p;records=[{...records[0],...p}];}});s.account({id:'u'});await s.saveRecord({...row(),categoria:'Mundo interior',nivel:5,emocion:'',problema:''},row());
  assert.equal(s.analysis[0].id,'1');assert.equal(s.analysis[0].created_at,row().created_at);assert.equal(s.analysis[0].nivel_original_10,8);assert.equal(A.scope(s.analysis,bounds,A.areas[0][0]).length,0);assert.equal(A.analyze(s.analysis).unclassifiedLoad,5);assert.equal(sent.problema,null);
});
test('error limpia resultados anteriores y permite reintento',async()=>{
  let fail=true;const s=new Store({read:async()=>{if(fail)throw new Error('Sin conexión');return [row()];}});s.account({id:'u'});s.analysis=[row()];await s.load('analysis');assert.equal(s.analysis.length,0);assert.equal(s.status.analysis.error,'Sin conexión');fail=false;await s.load('analysis');assert.equal(s.analysis.length,1);
});
test('respuesta de acción tardía no limpia borrador de otra cuenta',async()=>{
  const d=deferred(),s=new Store({create:()=>d.promise});s.account({id:'u'});s.actionDraft='acción';s.importance='3';const pending=s.saveAction();s.account({id:'v'});s.actionDraft='borrador nuevo';d.resolve();assert.equal(await pending,false);assert.equal(s.actionDraft,'borrador nuevo');
});
const template=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/excel-template.json'),'utf8'));
test('paridad con resultados calculados por el dominio Swift de iPhone',()=>{
  const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'parity-fixtures.json'),'utf8'));
  const b={start:new Date(fixture.bounds.start),end:new Date(fixture.bounds.end)};
  const compare=(actual,expected)=>{
    if(typeof expected==='number'){assert.ok(Math.abs(actual-expected)<1e-10);return;}
    if(Array.isArray(expected)){assert.equal(actual.length,expected.length);expected.forEach((v,i)=>compare(actual[i],v));return;}
    if(expected&&typeof expected==='object'){assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort());Object.keys(expected).forEach(k=>compare(actual[k],expected[k]));return;}
    assert.equal(actual,expected);
  };
  fixture.cases.forEach((rows,i)=>{
    const r=A.analyze(rows);
    compare({total:r.total,classifiedLoad:r.classifiedLoad,unclassifiedCount:r.unclassifiedCount,coverage:r.coverage,
      problems:r.problems.map(({key,load,count,average,share,cumulative,priority})=>({key,load,count,average,share,cumulative,priority})),
      areas:A.categoryTotals(rows).map(([name,load])=>({name,load})),
      points:A.situationPoints(rows,b).map(({key,share,cumulative,priority})=>({id:key,share,cumulative,priority}))},fixture.expected[i]);
  });
});
test('Excel nativo: Áreas sin tarjetas/período, filtros, series visibles y textos seguros',()=>{
  const files=X.entries([{...row('b',5),evento:'=SUM(A1) & <hola>\nsegunda',categoria:'Alma'},row('a',3)],bounds,template);
  assert.ok(files['_rels/.rels']);assert.ok(files['xl/workbook.xml'].includes('name="Áreas"'));assert.ok(!files['xl/worksheets/sheet1.xml'].includes('Semana'));
  for(let i=1;i<=3;i++){assert.ok(files[`xl/tables/table${i}.xml`].includes('<autoFilter'));assert.ok(files[`xl/tables/table${i}.xml`].includes('name=""'));assert.ok(files[`xl/worksheets/_rels/sheet${i}.xml.rels`].includes(`ParetoTable${i}`));}
  assert.ok(files['xl/worksheets/sheet2.xml'].includes('Alma (anterior)'));assert.ok(files['xl/worksheets/sheet2.xml'].includes('=SUM(A1) &amp; &lt;hola&gt;'));
  assert.ok(!files['xl/worksheets/sheet2.xml'].includes('hidden="1"'));assert.ok(!files['xl/worksheets/sheet2.xml'].includes('<f>'));
  for(let i=1;i<=2;i++)assert.ok(files[`xl/drawings/charts/chart${i}.xml`].includes('<c:plotVisOnly val="1"/>'));
  assert.ok(files['xl/drawings/charts/chart2.xml'].includes("'Situaciones'!$B$4:$B$5"));
});
test('Excel vacío sin barras ficticias, un registro, repetidos y lista de 521',()=>{
  const empty=X.entries([],bounds,template);assert.ok(!empty['xl/worksheets/sheet2.xml'].includes('<drawing'));assert.ok(empty['xl/tables/table2.xml'].includes('A3:D4'));assert.ok(empty['xl/worksheets/sheet2.xml'].includes('No hay registros'));
  const rows=Array.from({length:521},(_,i)=>({...row(String(i),i%5+1),evento:'Texto repetido'})),files=X.entries(rows,bounds,template);
  assert.ok(files['xl/tables/table2.xml'].includes('A3:D524'));assert.ok(files['xl/drawings/charts/chart2.xml'].includes('ptCount val="521"'));assert.equal((files['xl/worksheets/sheet2.xml'].match(/Texto repetido/g)||[]).length,521);
  assert.ok(X.rowHeight(['corto'],[55])<=28);assert.ok(X.rowHeight(['largo '.repeat(90)],[55])>100);assert.ok(X.rowHeight(['a\nb\nc\nd'],[55])>60);
});
test('contextos de acciones usan todo el historial, normalizan y resuelven áreas/empates',()=>{
  const [a,b]=A.areas.map(([n])=>n);
  const rows=[row('a',3,' Ruído ',a),{...row('b',5,'ruido',b),created_at:'2020-01-01'},row('c',2,'RUIDO',a),row('d',5,'Legado','Alma'),row('e',2,null,a)];
  const c=A.problemContexts(rows);assert.equal(c.length,2);assert.deepEqual(c.find(p=>p.key==='ruido').areas,[b,a].sort((x,y)=>x.localeCompare(y,'es')));assert.deepEqual(c.find(p=>p.key==='legado').areas,[]);
  assert.deepEqual(A.problemContexts([...rows,row('f',1,'ruido',b)]).find(p=>p.key==='ruido').areas,[b]);
});
test('áreas filtran completadas, progreso y orden sin inferir vínculos',()=>{
  const a=A.areas[0][0], rows=[{id:'a',importancia:2,completada:false,categoria:a},{id:'b',importancia:5,completada:false,categoria:a},{id:'c',completada:true,categoria:null}];
  assert.deepEqual(A.filterActions(rows,a).map(r=>r.id),['b','a']);assert.deepEqual(A.filterActions(rows,'__none').map(r=>r.id),['c']);assert.equal(A.filterActions(rows).length,3);assert.equal(A.validActionArea(''),null);assert.throws(()=>A.validActionArea('Alma'));
});
test('borrador vinculado vacío, segunda acción huérfana, error y campos explícitos',async()=>{
  let saved,fail=true;const s=new Store({create:async(u,t,v)=>{if(fail)throw Error('fallo');saved=v;},read:async()=>[]});s.account({id:'u'});
  s.prepareAction({name:'Ya eliminado',key:'ya eliminado'},A.areas[0][0]);assert.equal(s.actionDraft,'');assert.equal(s.importance,'');assert.ok(s.hasActionDraft());s.actionDraft='Mi paso';s.importance='4';
  await assert.rejects(s.saveAction());assert.equal(s.actionProblem.key,'ya eliminado');assert.equal(s.actionDraft,'Mi paso');fail=false;await s.saveAction();assert.equal(saved.problema_nombre,'Ya eliminado');assert.equal(saved.categoria,A.areas[0][0]);assert.equal(s.actionProblem,null);
  s.actionDraft='Independiente';s.importance='1';await s.saveAction();assert.equal(saved.categoria,null);assert.equal(saved.problema_clave,null);
  s.actionFilter='__none';s.prepareAction({name:'X',key:'x'});s.account({id:'v'});assert.equal(s.actionFilter,'');assert.equal(s.actionProblem,null);assert.deepEqual(s.problemContexts,[]);
});
test('sugerencias tardías no pasan a otra cuenta ni sustituyen el borrador',async()=>{
 const d=deferred(),s=new Store({read:()=>d.promise});s.account({id:'u'});s.prepareAction({name:'Propio',key:'propio'},A.areas[1][0]);s.actionDraft='Texto';const pending=s.load('names');s.account({id:'v'});s.actionDraft='Otra cuenta';d.resolve([row()]);await pending;assert.deepEqual(s.problemContexts,[]);assert.equal(s.actionDraft,'Otra cuenta');
});
test('actualizar acción conserva la lista durante el guardado y no vuelve a consultarla',async()=>{
 const d=deferred();let reads=0;const s=new Store({change:()=>d.promise,read:async()=>{reads++;return [];}});s.account({id:'u'});s.actions=[{id:'a',completada:false,importancia:3},{id:'b',completada:false,importancia:4}];
 const pending=s.changeAction('a',{completada:true});assert.equal(s.actions.length,2);assert.equal(s.actions[0].completada,false);d.resolve();await pending;assert.equal(s.actions[0].completada,true);assert.equal(s.actions.length,2);assert.equal(reads,0);
 await s.changeAction('a',{completada:false});assert.equal(s.actions[0].completada,false);assert.equal(reads,0);
});
