/* Read-only preview. Its in-memory snapshot is also the input to the existing Excel exporter. */
(function(root){
  'use strict';
  const A=root.ParetoAnalysis,X=root.ParetoExcel,{el,button}=root.ParetoCharts;
  function create({service,context,onDownload}){
    const $=id=>document.getElementById(id),dialog=$('reportDialog');
    let sequence=0,snapshot=null,period='week',offset=0,tab='areas',page=0,loading=false,exporting=false,opener=null;
    const date=d=>d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
    function active(c,revision){return c.active()&&revision===sequence&&dialog.open&&!document.hidden;}
    function controls(){
      $('reportPeriod').value=period;$('reportWeeks').hidden=period!=='week';$('reportNext').disabled=offset===0;
      $('reportDownload').disabled=loading||!snapshot||exporting;
      $('reportDownload').textContent=exporting?'Preparando Excel…':'Descargar Excel';
      $('reportDownload').setAttribute('aria-busy',String(exporting));$('reportRefresh').disabled=loading;
    }
    function close(restoreFocus=true){
      sequence++;snapshot=null;loading=false;exporting=false;page=0;
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
      snapshot=null;opener=source;period=initialPeriod;offset=initialPeriod==='week'?Math.min(0,initialOffset):0;tab='areas';page=0;
      if(!dialog.open)dialog.showModal();setTab('areas');$('reportClose').focus();load();
    }
    function setTab(next){
      tab=next;page=0;
      const buttons=[...$('reportTabs').querySelectorAll('[role=tab]')];
      buttons.forEach(b=>{const selected=b.dataset.reportTab===tab;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;if(selected)$('reportContent').setAttribute('aria-labelledby',b.id);});
      render();
    }
    function table(headers,rows,title){
      const wrap=el('div','','report-table-wrap'),table=el('table','','report-table '+(headers.length===6?'report-data':headers.length===4?'report-situations':'report-areas')),caption=el('caption',title,'sr-only');
      const head=el('thead'),tr=el('tr');headers.forEach(h=>{const th=el('th',h);th.scope='col';tr.append(th);});head.append(tr);
      const body=el('tbody');rows.forEach(values=>{const tr=el('tr');values.forEach(value=>tr.append(el('td',value==null?'':String(value),typeof value==='number'?'report-number':'')));body.append(tr);});
      table.append(caption,head,body);wrap.append(table);return wrap;
    }
    function bars(items,max,title,levels=false){
      const group=el('section','','report-bars');group.append(el('h3',title));const list=el('ul');
      items.forEach(({name,value,area})=>{const item=el('li'),label=el('div','','report-bar-label');label.append(el('span',name),el('strong',levels?A.formatLevel(value):String(value)));
        label.lastChild.style.color=levels?A.sage(value):'#b7ccc0';
        const track=el('div','','bar-track'),fill=el('span','','bar-fill');fill.style.width=(max?value/max*100:0)+'%';fill.style.background=levels?A.sage(value):'#96B8A5';track.append(fill);track.setAttribute('aria-hidden','true');
        item.append(label,track);if(area)item.append(el('small',area,'hint'));list.append(item);
      });group.append(list);return group;
    }
    function render(){
      const target=$('reportContent');target.replaceChildren();if(!snapshot)return;
      const count=snapshot.ordered.length;
      if(!count)target.append(el('p','No hay registros en este período.','status'));
      if(tab==='areas'){
        const layout=el('div','','report-columns');layout.append(table(['Área','Carga'],snapshot.areas.map(([name,load])=>[A.areaLabel(name),load]),'Áreas del informe'),bars(snapshot.areas.map(([name,value])=>({name:A.areaLabel(name),value})),Math.max(0,...snapshot.areas.map(([,n])=>n)),'Carga por área'));target.append(layout);return;
      }
      const rows=tab==='situations'?snapshot.situations:snapshot.data;
      page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(rows.length/10)-1)));
      const start=page*10,visible=rows.slice(start,start+10);
      if(count)target.append(el('p',`${start+1}–${Math.min(start+10,count)} de ${count} registros. El Excel incluye todo el período.`,'hint'));
      if(tab==='situations'){
        const layout=el('div','','report-columns');layout.append(table(['N.º','Situación','Nivel','Área'],visible,'Situaciones del informe'),bars(visible.map(([,name,value,area])=>({name,value,area})),5,'Fricción por situación (1–5)',true));target.append(layout);
      }else target.append(table(snapshot.headers,visible,'Datos del informe'));
      if(count>10){const nav=el('div','','pager'),prev=button('Anterior',()=>{page--;render();}),next=button('Siguiente',()=>{page++;render();});prev.disabled=page===0;next.disabled=(page+1)*10>=count;
        nav.setAttribute('aria-label','Páginas del informe');nav.append(prev,el('span',`${page+1} / ${Math.ceil(count/10)}`),next);target.append(nav);}
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
    $('reportPeriod').onchange=()=>{period=$('reportPeriod').value;offset=0;load();};
    $('reportPrev').onclick=()=>{offset--;load();};$('reportCurrent').onclick=()=>{offset=0;load();};$('reportNext').onclick=()=>{offset=Math.min(0,offset+1);load();};
    $('reportRefresh').onclick=load;$('reportDownload').onclick=download;
    $('reportTabs').querySelectorAll('[role=tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.reportTab));
    $('reportTabs').onkeydown=event=>{const tabs=[...$('reportTabs').querySelectorAll('[role=tab]')],i=tabs.indexOf(document.activeElement);if(i<0)return;
      const next=event.key==='ArrowRight'?(i+1)%tabs.length:event.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
      if(next!==null){event.preventDefault();setTab(tabs[next].dataset.reportTab);tabs[next].focus();}};
    return {open,close};
  }
  root.ParetoReport={create};
})(globalThis);
