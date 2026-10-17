/* Pareto Core web 2.1 — personal data stays in memory; Supabase owns session persistence. */
(() => {
  'use strict';
  const A=window.ParetoAnalysis,C=window.ParetoCharts,$=id=>document.getElementById(id),{el,button}=C;
  const cfg=window.PARETO_CONFIG||{};
  function publicConfig(c) {
    if(typeof c.url!=='string'||!/^https:\/\//.test(c.url)||typeof c.anonKey!=='string'||c.anonKey.startsWith('sb_secret_'))return false;
    try {if(c.anonKey.split('.').length===3 && JSON.parse(atob(c.anonKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role!=='anon')return false;}catch{return false;}
    return !!c.anonKey&&!c.anonKey.startsWith('TU_');
  }
  let db;try{if(publicConfig(cfg)&&window.supabase)db=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});}catch{}
  const service=new window.ParetoService.Service(db),store=new window.ParetoState.Store(service,changed);
  const desktop=window.matchMedia('(min-width: 768px)');
  let panel='scanner',historyOpen=false,historyPage=0,views=[],editing=null,authSequence=0,loginAttempt=0,busy=false,exportSequence=0,exporting=false;
  service.onSessionError=()=>{authSequence++;loginAttempt++;store.account(null);$('authMessage').textContent='Tu sesión terminó. Vuelve a entrar.';};
  let captureLevel=null,editLevel=null;
  const date=s=>new Date(s).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
  const pct=n=>n.toLocaleString('es-CO',{maximumFractionDigits:1})+'%';
  const mean=rows=>rows.length?(A.analyze(rows).total/rows.length).toLocaleString('es-CO',{maximumFractionDigits:1})+'/5':'Sin datos';
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
  let enteringActions = new Set();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function celebrate(node) {
    if(!node || reducedMotion.matches || document.hidden)return;
    node.classList.remove('saved-feedback');void node.offsetWidth;node.classList.add('saved-feedback');
  }
  async function animateRemoval(kind,id) {
    if(reducedMotion.matches || document.hidden)return;
    const nodes=[...document.querySelectorAll('[data-motion-kind]')].filter(n=>n.dataset.motionKind===kind&&n.dataset.motionId===id);
    await Promise.all(nodes.map(async node=>{
      if(!node.checkVisibility() || !node.animate)return;
      const animation=node.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-6px)'}],{duration:180,easing:'ease-in',fill:'forwards'});
      try{await animation.finished;}catch{}finally{animation.cancel();}
    }));
  }
  let deleteDecision = null;
  function finishDeleteConfirmation(accepted=false){
    const resolve=deleteDecision;deleteDecision=null;$('deleteDialog').close();if(resolve)resolve(accepted);
  }
  function confirmDelete(title){
    finishDeleteConfirmation();$('deleteTitle').textContent=title;
    return new Promise(resolve=>{deleteDecision=resolve;$('deleteDialog').showModal();$('deleteCancel').focus();});
  }
  $('deleteCancel').onclick=()=>finishDeleteConfirmation();
  $('deleteConfirm').onclick=()=>finishDeleteConfirmation(true);
  $('deleteDialog').addEventListener('cancel',e=>{e.preventDefault();finishDeleteConfirmation();});
  function dismissKeyboard(){if(document.activeElement instanceof HTMLElement)document.activeElement.blur();}
  function opts(select,items,value) {select.replaceChildren();for(const [v,t] of items){const o=el('option',t);o.value=v;select.append(o);}select.value=value??items[0]?.[0]??'';}
  function areaOptions(original){return [...(original&&!A.areas.some(([n])=>n===original)?[[original,A.areaLabel(original)]]:[]),...A.areas.map(([n])=>[n,n])];}
  opts($('category'),areaOptions());opts($('importance'),[['','Elige una valoración'],...A.importanceLabels.map((_,i)=>[String(i+1),A.importanceLabel(i+1)])],'');
  opts($('historyLevel'),[['','Todos'],...A.levels.map((_,i)=>[String(i+1),A.formatLevel(i+1)])],'');
  function makeLevels(target,name,value,area,onChange){
    const set=el('fieldset','','level-set');set.append(el('legend','Nivel de fricción'));
    A.levels.forEach((label,i)=>{const l=el('label','','level-choice'),input=document.createElement('input');input.type='radio';input.name=name;input.value=i+1;input.checked=value===i+1;input.required=true;input.addEventListener('change',()=>onChange(i+1));l.append(input,el('strong',String(i+1)),el('span',label));set.append(l);});
    const description=el('p',A.frictionDescription(area,value),'hint level-description');description.setAttribute('aria-live','polite');
    $(target).replaceChildren(set,description);
  }
  function renderCaptureLevel(){makeLevels('captureLevels','captureLevel',captureLevel,$('category').value,v=>{captureLevel=v;renderCaptureLevel();document.querySelector(`input[name=captureLevel][value="${v}"]`).focus();});}
  function areaDescription(){$('areaDescription').textContent=A.areas.find(([n])=>n===$('category').value)?.[1]||'';renderCaptureLevel();}
  function renderEditLevel(){makeLevels('editLevels','editLevel',editLevel,$('editArea').value,v=>{editLevel=v;renderEditLevel();document.querySelector(`input[name=editLevel][value="${v}"]`).focus();});}
  $('category').addEventListener('change',areaDescription);$('editArea').addEventListener('change',renderEditLevel);areaDescription();
  const rememberKey='pareto.remembered-email';
  try{const email=localStorage.getItem(rememberKey);if(email){$('email').value=email;$('remember').checked=true;}}catch{}
  $('remember').addEventListener('change',()=>{try{if(!$('remember').checked)localStorage.removeItem(rememberKey);}catch{}});
  function rememberEmail(){try{if($('remember').checked)localStorage.setItem(rememberKey,$('email').value.trim());else localStorage.removeItem(rememberKey);}catch{}}
  function changed(channel){
    if(channel==='account'){
      finishDeleteConfirmation();enteringActions.clear();closeActionChoice();syncActionForm();$('actionFilter').value='';closeDetails();closeEditor();cancelExport();historyOpen=false;historyPage=0;busy=false;
      $('captureForm').reset();captureLevel=null;areaDescription();$('captureError').textContent='';
      $('actionForm').reset();$('actionError').textContent='';$('password').value='';
      $('historyQuery').value='';$('historyLevel').value='';opts($('historyArea'),[['','Todas']],'');
      $('historySection').hidden=true;$('historyToggle').textContent='Ver historial';$('historyToggle').setAttribute('aria-expanded','false');
      $('detailBody').replaceChildren();$('historyBody').replaceChildren();$('analysisBody').replaceChildren();$('actionsBody').replaceChildren();$('problemNames').replaceChildren();
      $('toast').hidden=true;clearTimeout(toast.timer);
      $('captureSave').disabled=false;$('actionSave').disabled=false;
      $('app').hidden=!store.user;$('auth').hidden=!!store.user;
      if(!store.user){$('authMessage').textContent='Ingresa con tu cuenta privada.';return;}
      $('period').value=store.period;selectPanel(desktop.matches?'actions':'scanner');
    }
    if(channel==='period'){closeDetails();closeEditor();cancelExport();}
    if(channel==='analysis'||channel==='period'){renderAnalysis();renderDetail();}
    if(channel==='history'){renderHistory();}
    if(channel==='names'){renderProblemOptions();$('problemNames').replaceChildren(...store.names.map(n=>{const o=el('option');o.value=n;return o;}));}
    if(channel==='actions')renderActions();
  }
  function selectPanel(id){
    dismissKeyboard();closeDetails();panel=id;
    document.querySelectorAll('.panel').forEach(n=>n.hidden=n.id!==id);
    document.querySelectorAll('[data-panel]').forEach(n=>n.setAttribute('aria-current',n.dataset.panel===id?'page':'false'));
    if(id==='analysis'){store.load('analysis');if(historyOpen)store.load('history');}
    if(id==='actions')store.load('actions');
    store.load('names');window.scrollTo({top:0});
  }
  document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>selectPanel(b.dataset.panel)));
  function layout(){
    const nav=document.querySelector('.tabs');
    const order=desktop.matches?['actions','new-action','analysis','scanner']:['scanner','actions','new-action','analysis'];
    order.forEach(id=>nav.append(document.querySelector(`[data-panel="${id}"]`)));
    if(desktop.matches){
      document.querySelector('.topbar').insertBefore(nav,$('logout'));
    }else{
      $('app').append(nav);
    }
    if(store.user)renderActions();
  }
  desktop.addEventListener('change',layout);
  layout();
  function status(channel,target,empty){
    const s=store.status[channel]||{};
    if(s.loading){target.append(el('p','Cargando…','status'));target.setAttribute('aria-busy','true');return true;}
    target.removeAttribute('aria-busy');
    if(s.error){const box=el('div','','status');box.setAttribute('role','alert');box.append(el('p',s.error),button('Reintentar',()=>store.load(channel)));target.append(box);return true;}
    if(empty)target.append(el('p',empty,'status'));return false;
  }
  function metric(label,value){const n=el('div','','card metric');n.append(el('span',label),el('strong',value));return n;}
  function metrics(rows){const n=el('div','','metrics');n.append(metric('Registros',String(rows.length)),metric('Carga acumulada',String(A.analyze(rows).total)),metric('Intensidad media',mean(rows)));return n;}
  function card(title){const n=el('section','','card stack');if(title)n.append(el('h2',title));return n;}
  function renderAnalysis(){
    const target=$('analysisBody');target.replaceChildren();
    const bounds=store.bounds();$('periodDates').textContent=date(bounds.start)+' — '+date(new Date(bounds.end-1));
    $('weekControls').hidden=store.period!=='week';$('nextWeek').disabled=store.weekOffset===0;
    syncExportButtons();$('refresh').disabled=!!store.status.analysis?.loading;
    if(status('analysis',target))return;
    if(!store.analysis.length)target.append(el('p','No hay registros en este período.','status'));
    target.append(button('Ver todos los registros',()=>openDetail({kind:'all'})),metrics(store.analysis));
    const r=A.analyze(store.analysis);
    if(r.problems.length){
      const top=card('Problema principal del período'),first=r.problems[0],ties=r.problems.filter(p=>p.load===first.load);
      if(ties.length>1)top.append(el('p',`${ties.length} problemas comparten la mayor carga.`,'hint'));
      ties.forEach(p=>{top.append(el('h3',p.name),el('p',`${p.count} registros · Media ${p.average.toFixed(1)}/5 · Carga ${p.load}`,'hint'),button('Ver detalles',()=>openDetail({kind:'problem',key:p.key})));});target.append(top);
      const focus=card('Focos de atención 80/20');focus.append(el('p',`Clasificación: ${pct(r.coverage)} · Sin clasificar: ${r.unclassifiedCount} registros / ${r.unclassifiedLoad} puntos.`,'hint'));
      r.problems.filter(p=>p.priority).forEach(p=>focus.append(problemButton(p,null)));
      focus.append(el('p','La carga registrada orienta tu atención; no es una medida de bienestar ni una obligación de actuar.','hint'));target.append(focus);
    }
    const areas=card('Distribución por áreas');A.categoryTotals(store.analysis).forEach(([name,load])=>{
      const b=button('',()=>openDetail({kind:'area',area:name}),'area-row');b.append(el('span',A.areaLabel(name)),el('span',pct(r.total?load/r.total*100:0)+' ›'));areas.append(b);
    });target.append(areas);
  }
  function problemButton(p,area){
    const b=button('',()=>openDetail({kind:'problem',key:p.key,area}),'area-row');
    const n=el('span');n.append(el('strong',p.name),el('p',`${p.count} registros · Carga ${p.load} · Media ${p.average.toFixed(1)}/5`,'hint'));
    b.append(n,el('span','›'));return b;
  }
  $('period').addEventListener('change',()=>store.setPeriod($('period').value));
  $('prevWeek').addEventListener('click',()=>store.setPeriod('week',store.weekOffset-1));
  $('nextWeek').addEventListener('click',()=>store.setPeriod('week',store.weekOffset+1));
  $('currentWeek').addEventListener('click',()=>store.setPeriod('week',0));
  $('refresh').addEventListener('click',()=>{store.load('analysis');if(historyOpen)store.load('history');});
  function filters(){return {query:$('historyQuery').value,area:$('historyArea').value,level:$('historyLevel').value};}
  $('historyToggle').addEventListener('click',()=>{
    historyOpen=!historyOpen;$('historySection').hidden=!historyOpen;$('historyToggle').textContent=historyOpen?'Ocultar historial':'Ver historial';$('historyToggle').setAttribute('aria-expanded',String(historyOpen));
    if(historyOpen)store.load('history');
  });
  ['historyQuery','historyArea','historyLevel'].forEach(id=>$(id).addEventListener(id==='historyQuery'?'input':'change',()=>{historyPage=0;renderHistory();}));
  function renderHistory(){
    const area=$('historyArea'),value=area.value;const seen=[...new Set([...A.areas.map(([n])=>n),...store.history.map(r=>r.categoria)])];
    opts(area,[['','Todas'],...seen.map(n=>[n,A.areaLabel(n)])],value);
    const target=$('historyBody');target.replaceChildren();if(status('history',target))return;
    $('historyHint').textContent=store.history.some(r=>!A.problemKey(r.problema))?'Puedes asignar un problema desde Editar registro':'';
    const rows=A.filterHistory(store.history,filters());historyPage=Math.max(0,Math.min(historyPage,Math.ceil(rows.length/10)-1));
    historyList(target,rows,historyPage,p=>{historyPage=p;renderHistory();});
  }
  function historyList(target,rows,page,setPage){
    if(!rows.length){target.append(el('p','No hay registros que mostrar.','muted'));return;}
    rows.slice(page*10,page*10+10).forEach(row=>target.append(record(row)));
    const pager=el('div','','pager'),prev=button('Anterior',()=>setPage(page-1)),next=button('Siguiente',()=>setPage(page+1));prev.disabled=page===0;next.disabled=(page+1)*10>=rows.length;
    pager.append(prev,el('span',`${page+1} / ${Math.ceil(rows.length/10)} · ${rows.length} registros`),next);target.append(pager);
  }
  function record(row){
    const n=el('article','','record');n.dataset.motionKind='record';n.dataset.motionId=row.id;n.append(el('p',row.evento),el('p',`${A.areaLabel(row.categoria)} · ${A.formatLevel(row.nivel)} · ${date(row.created_at)}`,'hint'));
    if(row.emocion)n.append(el('p',row.emocion,'hint'));n.append(el('p',row.problema||'Sin clasificar','hint'));
    const actions=el('div','','row');actions.append(button('Editar registro',()=>openEditor(row)),button('Eliminar',()=>deleteRecord(row)));n.append(actions);return n;
  }
  async function deleteRecord(row){
    if(busy)return;const c=store.context();
    if(!await confirmDelete('¿Eliminar esta situación?')||!c.active()||busy)return;busy=true;
    try{if(await store.deleteRecord(row.id,()=>animateRemoval('record',row.id)))toast('Registro eliminado.');}catch(e){if(c.active())toast(e.message);}finally{if(c.active())busy=false;}
  }
  function openDetail(view){view.page=0;view.history=false;view.selected=null;views.push(view);renderDetail();if(!$('detailDialog').open)$('detailDialog').showModal();}
  function closeDetails(){views=[];if($('detailDialog').open)$('detailDialog').close();$('detailBody').replaceChildren();}
  $('detailClose').addEventListener('click',closeDetails);$('detailDialog').addEventListener('cancel',()=>{views=[];});
  $('detailBack').addEventListener('click',()=>{views.pop();renderDetail();});
  function renderDetail(){
    if(!views.length)return;
    const v=views.at(-1),target=$('detailBody');target.replaceChildren();$('detailBack').hidden=views.length<2;
    if(status('analysis',target))return;
    const bounds=store.bounds(),rows=A.scope(store.analysis,bounds,v.area??null),r=A.analyze(rows);
    $('detailTitle').textContent=v.kind==='area'?A.areaLabel(v.area):v.kind==='all'?'Todas las áreas':r.problems.find(p=>p.key===v.key)?.name||'Problema';
    target.append(el('p',date(bounds.start)+' — '+date(new Date(bounds.end-1)),'hint'));
    if(v.kind==='problem'){
      const p=r.problems.find(p=>p.key===v.key);
      if(!p){target.append(el('p','Este problema ya no tiene registros en este contexto.','muted'));return;}
      if(v.area)target.append(el('p',A.areaLabel(v.area),'hint'));
      target.append(metrics(p.rows),el('p',`${pct(p.share)} ${v.area?'de la carga clasificada del área':'de la carga clasificada del período'} · Acumulado ${pct(p.cumulative)}`,'hint'));
      target.append(button('Preparar una acción',()=>prepareAction(p.name)));
      const h=card('Registros del problema');v.page=Math.min(v.page,Math.max(0,Math.ceil(p.rows.length/10)-1));historyList(h,[...p.rows].sort(A.historyOrder),v.page,page=>{v.page=page;renderDetail();});target.append(h);return;
    }
    if(!rows.length){target.append(el('p','No hay situaciones en esta área y período.','muted'));return;}
    target.append(metrics(rows));
    if(v.kind==='area'){const total=A.analyze(store.analysis).total;target.append(el('p',`${pct(total?r.total/total*100:0)} de la carga total del período.`,'hint'));}
    const points=A.situationPoints(rows,bounds),situations=card('Situaciones');situations.append(el('p','De mayor a menor fricción · Escala 1–5. Toca una barra para ver sus detalles.','hint'));
    situations.append(C.levels(points.map(p=>p.row),row=>{v.selected=row.id;renderDetail();$('selectedSituation')?.scrollIntoView({block:'nearest'});}));target.append(situations);
    if(v.selected){const row=rows.find(row=>row.id===v.selected);if(row){const selected=card('Situación seleccionada');selected.id='selectedSituation';selected.append(record(row));const point=points.find(p=>p.row.id===row.id);selected.append(el('p',`${pct(point.share)} de la carga del área o conjunto abierto · Acumulado ${pct(point.cumulative)}`,'hint'));target.append(selected);}else v.selected=null;}
    const advanced=el('details');advanced.append(el('summary','Ver Pareto avanzado'));advanced.append(C.pareto(points,p=>{v.selected=p.row.id;renderDetail();$('selectedSituation')?.scrollIntoView({block:'nearest'});},{title:'Pareto de situaciones',denominator:v.area?'de la carga total del área':'de la carga total del período'}));
    if(r.problems.length){advanced.append(C.pareto(r.problems,p=>openDetail({kind:'problem',key:p.key,area:v.area}),{denominator:v.area?'de la carga clasificada del área':'de la carga clasificada del período'}));}
    target.append(advanced);
    if(r.unclassifiedCount)target.append(el('p',`Sin clasificar: ${r.unclassifiedCount} registros / ${r.unclassifiedLoad} puntos. No entran en el Pareto por problemas.`,'hint'));
    if(r.problems.length){const problems=card('Problemas'+(v.area?' del área':''));r.problems.forEach(p=>problems.append(problemButton(p,v.area)));target.append(problems);}
    const toggle=button(v.history?'Ocultar historial':'Ver historial',()=>{v.history=!v.history;renderDetail();},'disclosure');toggle.setAttribute('aria-expanded',String(v.history));target.append(toggle);
    if(v.history){const h=card('Historial'+(v.area?' del área':''));if(r.unclassifiedCount)h.append(el('p','Puedes asignar un problema desde Editar registro','hint'));v.page=Math.min(v.page,Math.max(0,Math.ceil(rows.length/10)-1));historyList(h,[...rows].sort(A.historyOrder),v.page,page=>{v.page=page;renderDetail();});target.append(h);}
  }
  function openEditor(row){editing={...row};$('editEvent').value=row.evento;$('editEmotion').value=row.emocion||'';$('editProblem').value=row.problema||'';opts($('editArea'),areaOptions(row.categoria),row.categoria);editLevel=row.nivel;renderEditLevel();$('editError').textContent='';$('editSave').disabled=false;$('editDialog').showModal();}
  function closeEditor(){editing=null;editLevel=null;if($('editDialog').open)$('editDialog').close();$('editForm').reset();$('editError').textContent='';}
  $('editCancel').addEventListener('click',closeEditor);$('editDialog').addEventListener('cancel',()=>{editing=null;});
  $('editForm').addEventListener('submit',async e=>{
    e.preventDefault();if(busy||!editing)return;
    const c=store.context(),original=editing;busy=true;$('editSave').disabled=true;$('editError').textContent='';dismissKeyboard();
    try{const ok=await store.saveRecord({evento:$('editEvent').value,emocion:$('editEmotion').value,categoria:$('editArea').value,problema:$('editProblem').value,nivel:editLevel},original);if(ok&&editing===original){closeEditor();toast('Registro actualizado.');}}
    catch(e){if(c.active()&&editing===original)$('editError').textContent=e.message;}
    finally{if(c.active()){busy=false;$('editSave').disabled=false;}}
  });
  $('captureForm').addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;const c=store.context();busy=true;$('captureSave').disabled=true;$('captureError').textContent='';dismissKeyboard();
    try{if(await store.saveRecord({evento:$('event').value,emocion:$('emotion').value,problema:$('problem').value,categoria:$('category').value,nivel:captureLevel})){$('captureForm').reset();captureLevel=null;areaDescription();celebrate($('captureForm'));toast('Fricción registrada.');}}
    catch(e){if(c.active())$('captureError').textContent=e.message;}finally{if(c.active()){busy=false;$('captureSave').disabled=false;}}
  });
  const importanceReferences=['Tiene poco peso para lo que hoy quiero cuidar.','Me importa un poco.','Tiene un lugar significativo para mí.','Es importante para lo que quiero cuidar.','Es de lo más importante para mí en este momento.'];
  $('actionText').addEventListener('input',()=>store.actionDraft=$('actionText').value);
  $('importance').addEventListener('change',()=>{store.importance=$('importance').value;$('importanceDescription').textContent=importanceReferences[Number(store.importance)-1]||'¿Cuánto importa para lo que hoy quieres cuidar?';});
  const currentAreas = () => A.areas.map(([n])=>[n,n]);
  opts($('actionArea'),[['','Sin área'],...currentAreas()],'');
  opts($('actionFilter'),[['','Todas las áreas'],...currentAreas(),['__none','Sin área']],'');
  let choiceCallback = null;
  function closeActionChoice(){ choiceCallback=null; $('actionChoice').close(); }
  function chooseArea(title, areas, value, callback){
    if(busy)return;
    $('actionChoiceTitle').textContent=title;opts($('actionChoiceArea'),[['','Sin área'],...areas.map(n=>[n,n])],value);
    $('actionChoiceError').textContent='';choiceCallback=callback;$('actionChoice').showModal();
  }
  $('actionChoiceCancel').onclick=()=>{if(!busy)closeActionChoice();};
  $('actionChoice').addEventListener('cancel',e=>{if(busy)e.preventDefault();else choiceCallback=null;});
  $('actionChoiceForm').addEventListener('submit',async e=>{
    e.preventDefault();if(busy||!choiceCallback)return;
    const c=store.context(), callback=choiceCallback;
    $('actionChoiceSave').disabled=true;
    try{await callback($('actionChoiceArea').value);if(c.active())closeActionChoice();}
    catch(error){if(c.active())$('actionChoiceError').textContent=error.message;}
    finally{$('actionChoiceSave').disabled=false;}
  });
  function renderProblemOptions(){
    const selected=store.actionProblem, items=store.problemContexts.map(p=>[p.key,p.name]);
    if(selected&&!items.some(([k])=>k===selected.key))items.push([selected.key,selected.name]);
    opts($('actionProblem'),[['','Sin problema vinculado'],...items],selected?.key||'');
    const state=store.status.names||{}, target=$('problemStatus');target.replaceChildren();
    $('actionProblem').disabled=!!state.loading||!!state.error;
    if(state.loading)target.textContent='Cargando problemas…';
    else if(state.error)target.append(el('span','No se pudieron cargar los problemas. '),button('Reintentar',()=>store.load('names'),'plain'));
    $('actionCancel').hidden=!selected;
  }
  function syncActionForm(){
    $('actionText').value=store.actionDraft;$('importance').value=store.importance;$('actionArea').value=store.actionArea;
    $('importanceDescription').textContent=importanceReferences[Number(store.importance)-1]||'';
    $('actionError').textContent='';renderProblemOptions();
  }
  $('actionArea').onchange=()=>{store.actionArea=$('actionArea').value;};
  $('actionFilter').onchange=()=>{store.actionFilter=$('actionFilter').value;renderActions();};
  $('actionProblem').onchange=()=>{
    if(busy)return renderProblemOptions();
    const p=store.problemContexts.find(p=>p.key===$('actionProblem').value);
    if(!p){store.actionProblem=null;renderProblemOptions();return;}
    const commit=area=>{store.actionProblem={name:p.name,key:p.key};store.actionArea=area;syncActionForm();};
    renderProblemOptions();
    if(p.areas.length>1)chooseArea('Este problema tiene la misma carga en varias áreas',p.areas,'',commit);
    else commit(p.areas[0]||'');
  };
  function prepareAction(name, area, key=A.problemKey(name)){
    if(busy)return;
    const p=store.problemContexts.find(p=>p.key===key);
    const commit=value=>{if(store.hasActionDraft()&&!window.confirm('Ya tienes un borrador. ¿Reemplazarlo?'))return;store.prepareAction({name,key},value);syncActionForm();selectPanel('new-action');$('actionText').focus();};
    if(area!==undefined)commit(area||'');
    else if(p?.areas.length>1)chooseArea('Elige el área de la acción',p.areas,'',commit);
    else commit(p?.areas[0]||'');
  }
  $('actionCancel').onclick=()=>{if(busy)return;store.clearActionDraft();syncActionForm();selectPanel('actions');};
  $('actionForm').addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;const c=store.context();busy=true;$('actionSave').disabled=true;$('actionError').textContent='';dismissKeyboard();
    const previousIds=new Set(store.actions.map(r=>r.id));
    try{if(await store.saveAction()){enteringActions=new Set(store.actions.filter(r=>!previousIds.has(r.id)).map(r=>r.id));syncActionForm();selectPanel('actions');toast('Acción guardada.');}}
    catch(e){if(c.active())$('actionError').textContent=e.message;}finally{if(c.active()){busy=false;$('actionSave').disabled=false;}}
  });
  async function changeAction(row,patch){if(busy)return;const c=store.context();if(patch===null&&(!await confirmDelete('¿Eliminar esta acción?')||!c.active()||busy))return;busy=true;try{await store.changeAction(row.id,patch,()=>patch===null?animateRemoval('action',row.id):Promise.resolve());}catch(e){if(c.active()){toast(e.message);renderActions();}}finally{if(c.active())busy=false;}}
  function renderActions(){
    const target=$('actionsBody');target.replaceChildren();if(status('actions',target))return;
    const filtered=A.filterActions(store.actions,store.actionFilter);
    const completed=filtered.filter(a=>a.completada).length,percent=filtered.length?completed/filtered.length*100:0;
    const progress=card('Acciones completadas');progress.append(el('p',pct(percent)));const bar=el('progress');bar.value=percent;bar.max=100;bar.setAttribute('aria-label','Acciones completadas');progress.append(bar);if(!desktop.matches)target.append(progress);
    if(!filtered.length){target.append(el('p','No hay acciones en esta selección.','muted'));if(desktop.matches)target.append(progress);return;}
    if(desktop.matches&&!filtered.some(a=>!a.completada))target.append(el('p','No tienes acciones pendientes.','muted'));
    for(const done of [false,true]){const rows=filtered.filter(r=>r.completada===done);if(!rows.length)continue;const list=card(done?'Completadas':'Pendientes');rows.forEach(row=>{
      const item=el('div','','action-row'+(done?' done':'')),check=el('input');check.type='checkbox';check.checked=done;check.setAttribute('aria-label',(done?'Marcar pendiente: ':'Completar: ')+row.texto);check.addEventListener('change',()=>changeAction(row,{completada:check.checked}));
      item.dataset.motionKind='action';item.dataset.motionId=row.id;if(enteringActions.has(row.id)){item.classList.add('row-enter');}
      const content=el('div');content.append(el('p',row.texto));content.append(el('p',row.categoria||'Sin área','hint action-area'));if(row.problema_nombre)content.append(el('p',row.problema_nombre,'hint action-problem'));const importance=el('select');importance.setAttribute('aria-label','Cambiar importancia de '+row.texto);opts(importance,[...(row.importancia==null?[['','Sin valorar']]:[]),...A.importanceLabels.map((_,i)=>[String(i+1),A.importanceLabel(i+1)])],String(row.importancia??''));if(row.importancia==null)importance.firstChild.disabled=true;importance.addEventListener('change',()=>changeAction(row,{importancia:Number(importance.value)}));content.append(importance);
      const remove=button('Eliminar',()=>changeAction(row,null),'plain action-delete');remove.setAttribute('aria-label','Eliminar acción: '+row.texto);remove.title='Eliminar acción';
      const menu=el('details','','action-menu'),summary=el('summary','Opciones');menu.append(summary);
      menu.append(button('Cambiar área',()=>chooseArea('Clasificar acción',A.areas.map(([n])=>n),row.categoria||'',async area=>{
        const c=store.context();busy=true;
        try{if(await store.changeAction(row.id,{categoria:area||null}))toast('Área guardada: '+(area||'Sin área'));}
        finally{if(c.active())busy=false;}
      }),'plain'));
      if(row.problema_nombre&&row.problema_clave)menu.append(button('Añadir otra acción',()=>prepareAction(row.problema_nombre,row.categoria||'',row.problema_clave),'plain'));
      menu.append(remove);item.append(check,content,menu);list.append(item);
    });target.append(list);}
    if(desktop.matches)target.append(progress);
    enteringActions.clear();
  }
  $('refreshActions').addEventListener('click',()=>store.load('actions'));
  function download(bytes,type,name){const url=URL.createObjectURL(new Blob([bytes],{type})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function syncExportButtons(){
    $('exportExcel').disabled=exporting||!!store.status.analysis?.loading||!!store.status.analysis?.error;
    $('actionsExportExcel').disabled=exporting;
    $('actionsExportExcel').textContent=exporting?'Preparando Excel…':'Descargar Excel';
    $('actionsExportExcel').setAttribute('aria-busy',String(exporting));
    const period={today:'Hoy',week:'Semana','30':'30 días','90':'90 días'}[store.period];
    $('actionsExportExcel').title='Informe de fricciones · '+period;
  }
  function cancelExport(){exportSequence++;exporting=false;syncExportButtons();}
  async function exportExcel(fresh=false){
    if(exporting||(!fresh&&(store.status.analysis?.loading||store.status.analysis?.error)))return;
    const c=store.context();if(!c.user)return;
    const seq=++exportSequence,bounds=store.bounds(),active=()=>c.active()&&seq===exportSequence;
    exporting=true;syncExportButtons();
    try{
      // Actions can be the first screen: fetch its report without requiring Analysis to be opened.
      const rows=fresh?await service.read(c.user,{bounds,active}):store.analysis.map(r=>({...r}));
      if(!active())return;
      const data=await window.ParetoExcel.workbook(rows,bounds);
      if(active()){download(data,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','pareto-core.xlsx');toast('Excel exportado.');}
    }catch(e){if(active())toast(e.message||'No se pudo preparar Excel.');}
    finally{if(active()){exporting=false;syncExportButtons();}}
  }
  $('exportExcel').addEventListener('click',()=>exportExcel());
  $('actionsExportExcel').addEventListener('click',()=>exportExcel(true));
  async function verifySession(){
    const seq=++authSequence;
    try{const {data,error}=await db.auth.getUser();if(seq!==authSequence)return;if(error||!data?.user){store.account(null);$('authMessage').textContent=error&&error.name!=='AuthSessionMissingError'?'No se pudo verificar la sesión. Intenta entrar nuevamente.':'Ingresa con tu cuenta privada.';return;}store.account(data.user);}
    catch{if(seq===authSequence){store.account(null);$('authMessage').textContent='No se pudo conectar. Comprueba internet e intenta entrar nuevamente.';}}
  }
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!db){$('authMessage').textContent='Configura la URL y la clave pública de Supabase en config.js.';return;}
    authSequence++;const attempt=++loginAttempt;$('loginButton').disabled=true;$('authMessage').textContent='Verificando acceso…';dismissKeyboard();
    try{const {data,error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;if(attempt===loginAttempt){rememberEmail();store.account(data.user);}}
    catch{if(attempt===loginAttempt)$('authMessage').textContent='No se pudo entrar. Verifica la conexión, el correo y la contraseña.';}finally{$('loginButton').disabled=false;}
  });
  $('logout').addEventListener('click',async()=>{
    $('logout').disabled=true;loginAttempt++;
    try{const {error}=await db.auth.signOut();if(error)throw error;authSequence++;store.account(null);}
    catch{toast('No se pudo cerrar la sesión. Comprueba tu conexión y vuelve a intentar.');}finally{$('logout').disabled=false;}
  });
  document.addEventListener('visibilitychange',()=>{
    const hidden=document.hidden;$('privacy').hidden=!hidden;$('app').inert=hidden;$('auth').inert=hidden;
    if(hidden){finishDeleteConfirmation();closeActionChoice();closeDetails();closeEditor();cancelExport();}
    else if(store.user){if(panel==='analysis')store.load('analysis');if(panel==='actions')store.load('actions');}
  });
  if(db){
    db.auth.onAuthStateChange((event,session)=>{
      // The explicit getUser check owns startup. INITIAL_SESSION must not invalidate it.
      if(event==='INITIAL_SESSION')return;
      if(!session){
        authSequence++;loginAttempt++;store.account(null);
        $('authMessage').textContent='Ingresa con tu cuenta privada.';
      }else if(store.user?.id!==session.user.id){store.account(null);setTimeout(verifySession,0);}
    });
    verifySession();
  }
  else $('authMessage').textContent='Completa config.js con la URL y la clave pública de tu proyecto Supabase.';
})();
