/* Read-only preview. Its in-memory snapshot is also the input to the existing Excel exporter. */
(function(root){
  'use strict';
  const A=root.ParetoAnalysis,X=root.ParetoExcel,{el,button}=root.ParetoCharts;
  function create({service,context,onDownload}){
    const $=id=>document.getElementById(id),dialog=$('reportDialog');
    let sequence=0,snapshot=null,period='week',offset=0,tab='areas',page=0,loading=false,exporting=false,opener=null;
    let filters={areas:{},situations:{},data:{}};
    const date=d=>d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
    function active(c,revision){return c.active()&&revision===sequence&&dialog.open&&!document.hidden;}
    function controls(){
      $('reportPeriod').value=period;$('reportWeeks').hidden=period!=='week';$('reportNext').disabled=offset===0;
      $('reportDownload').disabled=loading||!snapshot||exporting;
      $('reportDownload').textContent=exporting?'Preparando Excel…':'Descargar Excel';
      $('reportDownload').setAttribute('aria-busy',String(exporting));$('reportRefresh').disabled=loading;
    }
    function close(restoreFocus=true){
      sequence++;filters={areas:{},situations:{},data:{}};snapshot=null;loading=false;exporting=false;page=0;
      $('reportContent').replaceChildren();$('reportStatus').replaceChildren();$('reportDownloadError').textContent='';$('reportContext').textContent='';
      dialog.close();controls();const previous=opener;opener=null;
      if(restoreFocus&&previous?.isConnected&&previous.checkVisibility())previous.focus({preventScroll:true});
    }
    async function load(){
      const c=context();if(!c.user)return close(false);
      const revision=++sequence,bounds=A.periodBounds(period,offset);
      snapshot=null;loading=true;exporting=false;page=0;$('reportDownloadError').textContent='';
      $('reportContext').textContent=date(bounds.start)+' — '+date(new Date(bounds.end-1));
      $('reportContent').replaceChildren();$('reportContent').setAttribute('aria-busy','true');$('reportStatus').textContent='Cargando informe…';controls();
      try{
        const rows=await service.read(c.user,{bounds,active:()=>active(c,revision)});
        if(!active(c,revision))return;
        snapshot=X.prepareReport(rows,bounds);loading=false;
        $('reportContext').textContent+=` · ${snapshot.ordered.length} registros`;
        $('reportStatus').replaceChildren();render();
      }catch(error){
        if(!active(c,revision))return;
        loading=false;$('reportStatus').replaceChildren(el('p',error.message||'No se pudo cargar el informe.','error'),button('Reintentar',load));
      }finally{if(active(c,revision)){$('reportContent').removeAttribute('aria-busy');controls();}}
    }
    function open(source,initialPeriod,initialOffset){
      if(!context().user)return;
      filters={areas:{},situations:{},data:{}};snapshot=null;opener=source;period=initialPeriod;offset=initialPeriod==='week'?Math.min(0,initialOffset):0;tab='areas';page=0;
      if(!dialog.open)dialog.showModal();setTab('areas');$('reportClose').focus();load();
    }
    function setTab(next){
      tab=next;page=0;
      const buttons=[...$('reportTabs').querySelectorAll('[role=tab]')];
      buttons.forEach(b=>{const selected=b.dataset.reportTab===tab;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;if(selected)$('reportContent').setAttribute('aria-labelledby',b.id);});
      render();
    }
    function filtered(rows){
      return rows.filter(values=>Object.entries(filters[tab]).every(([index,filter])=>{
        const value=values[Number(index)]??'';
        return filter.kind==='text'?A.problemKey(value).includes(A.problemKey(filter.value)):JSON.stringify(value)===filter.value;
      }));
    }
    function applyFilter(index,kind,value,selection){
      if(value)filters[tab][index]={kind,value};else delete filters[tab][index];page=0;render();
      const field=$('reportContent').querySelector(`[data-filter-index="${index}"]`);
      if(field){field.focus({preventScroll:true});if(kind==='text')field.setSelectionRange(selection?.[0]??value.length,selection?.[1]??value.length);}
    }
    function filterSummary(target,shown,total,unit){
      const row=el('div','','report-filter-summary');row.append(el('p',`${shown} de ${total} ${unit}`,'hint'));
      if(Object.keys(filters[tab]).length)row.append(button('Limpiar filtros',()=>{filters[tab]={};page=0;render();$('reportContent').querySelector('[data-filter-index]')?.focus({preventScroll:true});},'plain'));
      target.append(row);
    }
    function table(headers,rows,title,allRows){
      const wrap=el('div','','report-table-wrap'),table=el('table','','report-table '+(headers.length===6?'report-data':headers.length===4?'report-situations':'report-areas')),caption=el('caption',title,'sr-only');
      const head=el('thead'),tr=el('tr');headers.forEach((h,index)=>{
        const th=el('th');th.scope='col';th.append(el('span',h));
        const kind=(tab==='areas'||(tab==='situations'&&index!==1)||(tab==='data'&&[0,3,5].includes(index)))?'exact':'text';
        const current=filters[tab][index]?.value||'';let input;
        if(kind==='exact'){
          input=el('select');const any=el('option','Todos');any.value='';input.append(any);
          const values=[...new Set(allRows.map(row=>JSON.stringify(row[index]??'')))];if(current&&!values.includes(current))values.push(current);
          values.sort((a,b)=>String(JSON.parse(a)).localeCompare(String(JSON.parse(b)),'es',{numeric:true})).forEach(encoded=>{const value=JSON.parse(encoded),option=el('option',value===''?'(Vacíos)':String(value));option.value=encoded;input.append(option);});
          input.value=current;input.onchange=()=>applyFilter(index,kind,input.value);
        }else{
          input=el('input');input.type='search';input.placeholder='Filtrar…';input.value=current;input.oninput=()=>applyFilter(index,kind,input.value,[input.selectionStart,input.selectionEnd]);
        }
        input.className='report-column-filter';input.dataset.filterIndex=index;input.setAttribute('aria-label','Filtrar '+h);th.append(input);tr.append(th);
      });head.append(tr);
      const body=el('tbody');rows.forEach(values=>{const tr=el('tr');values.forEach(value=>tr.append(el('td',value==null?'':String(value),typeof value==='number'?'report-number':'')));body.append(tr);});
      table.append(caption,head,body);wrap.append(table);return wrap;
    }
    function bars(items,max,title,levels=false){
      const group=el('section','','report-bars');group.append(el('h3',title));const list=el('ul');
      items.forEach(({name,value,area})=>{const item=el('li'),label=el('div','','report-bar-label');label.append(el('span',name),el('strong',levels?A.formatLevel(value):String(value)));
        label.lastChild.style.color='#365744';
        const track=el('div','','bar-track'),fill=el('span','','bar-fill');fill.style.width=(max?value/max*100:0)+'%';fill.style.background=levels?A.sage(value):'#96B8A5';track.append(fill);track.setAttribute('aria-hidden','true');
        item.append(label,track);if(area)item.append(el('small',area,'hint'));list.append(item);
      });group.append(list);return group;
    }
    function render(){
      const target=$('reportContent');target.replaceChildren();if(!snapshot)return;
      const count=snapshot.ordered.length;
      if(!count)target.append(el('p','No hay registros en este período.','status'));
      if(tab==='areas'){
        const all=snapshot.areas.map(([name,load])=>[A.areaLabel(name),load]),rows=filtered(all);filterSummary(target,rows.length,all.length,'áreas');
        const layout=el('div','','report-columns');layout.append(table(['Área','Carga'],rows,'Áreas del informe',all),bars(rows.map(([name,value])=>({name,value})),Math.max(0,...rows.map(([,n])=>n)),'Carga por área'));target.append(layout);
        if(!rows.length&&count)target.append(el('p','No hay resultados con estos filtros.','status'));return;
      }
      const all=tab==='situations'?snapshot.situations:snapshot.data,rows=filtered(all),total=rows.length;
      page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(total/10)-1)));
      const start=page*10,visible=rows.slice(start,start+10);filterSummary(target,total,count,'registros');
      if(total)target.append(el('p',`${start+1}–${Math.min(start+10,total)} de ${total} registros. El Excel incluye todo el período.`,'hint'));
      if(tab==='situations'){
        const layout=el('div','','report-columns');layout.append(table(['N.º','Situación','Nivel','Área'],visible,'Situaciones del informe',all),bars(visible.map(([,name,value,area])=>({name,value,area})),5,'Fricción por situación (1–5)',true));target.append(layout);
      }else target.append(table(snapshot.headers,visible,'Datos del informe',all));
      if(!total&&count)target.append(el('p','No hay resultados con estos filtros.','status'));
      if(total>10){const nav=el('div','','pager'),prev=button('Anterior',()=>{page--;render();}),next=button('Siguiente',()=>{page++;render();});prev.disabled=page===0;next.disabled=(page+1)*10>=total;
        nav.setAttribute('aria-label','Páginas del informe');nav.append(prev,el('span',`${page+1} / ${Math.ceil(total/10)}`),next);target.append(nav);}
    }
    async function download(){
      if(!snapshot||loading||exporting)return;
      const c=context(),revision=sequence,report=snapshot;exporting=true;$('reportDownloadError').textContent='';controls();
      try{
        const bytes=await X.workbook(report.ordered,report.bounds);
        if(active(c,revision))onDownload(bytes);
      }catch(error){if(active(c,revision))$('reportDownloadError').textContent=error.message||'No se pudo preparar el Excel. Intenta descargar nuevamente.';}
      finally{if(active(c,revision)){exporting=false;controls();}}
    }
    $('reportClose').onclick=()=>close();dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    $('reportPeriod').onchange=()=>{filters={areas:{},situations:{},data:{}};period=$('reportPeriod').value;offset=0;load();};
    $('reportPrev').onclick=()=>{filters={areas:{},situations:{},data:{}};offset--;load();};$('reportCurrent').onclick=()=>{filters={areas:{},situations:{},data:{}};offset=0;load();};$('reportNext').onclick=()=>{filters={areas:{},situations:{},data:{}};offset=Math.min(0,offset+1);load();};
    $('reportRefresh').onclick=load;$('reportDownload').onclick=download;
    $('reportTabs').querySelectorAll('[role=tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.reportTab));
    $('reportTabs').onkeydown=event=>{const tabs=[...$('reportTabs').querySelectorAll('[role=tab]')],i=tabs.indexOf(document.activeElement);if(i<0)return;
      const next=event.key==='ArrowRight'?(i+1)%tabs.length:event.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
      if(next!==null){event.preventDefault();setTab(tabs[next].dataset.reportTab);tabs[next].focus();}};
    return {open,close};
  }
  root.ParetoReport={create};
})(globalThis);
