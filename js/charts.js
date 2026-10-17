(function(root){
  'use strict';
  const A = root.ParetoAnalysis;
  const levelColor=level=>document.body.classList.contains('native-layout')?A.sage(level):(level<=2?'#6ee7b7':level===3?'#34d399':'#10b981');
  function el(tag,text='',cls='') {const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;}
  function button(text,fn,cls='') {const n=el('button',text,cls);n.type='button';n.addEventListener('click',fn);return n;}
  function levels(rows,onSelect) {
    const wrap=el('div','','level-chart');
    wrap.setAttribute('aria-label','Situaciones ordenadas por intensidad de fricción, escala de 1 a 5');
    for(const row of rows) {
      const bar=button('',()=>onSelect(row),'level-bar');
      const label=el('span','','bar-label');label.append(el('span',row.evento,'situation-text'),el('b',A.formatLevel(row.nivel)));
      label.lastChild.style.color=levelColor(row.nivel);
      const track=el('span','','bar-track'),fill=el('span','','bar-fill');
      fill.style.width=(row.nivel/5*100)+'%';fill.style.background=levelColor(row.nivel);track.append(fill);track.setAttribute('aria-hidden','true');
      bar.append(label,track,el('small',A.areaLabel(row.categoria)));bar.setAttribute('aria-label',`${row.evento}. ${A.areaLabel(row.categoria)}. ${A.formatLevel(row.nivel)}. Ver situación`);
      wrap.append(bar);
    }
    if(!rows.length) wrap.append(el('p','No hay situaciones en este período.','muted'));
    return wrap;
  }
  function pareto(points,onSelect,{title='Pareto por problemas',denominator='de la carga clasificada del área'}={}) {
    const box=el('section','','stack');box.append(el('h3',title));
    if(!points.length) return box;
    const width=Math.max(560,points.length*60+72),height=270,left=42,top=12,bottom=226,step=(width-left-18)/points.length;
    const svgNS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('class','pareto-chart');
    svg.setAttribute('aria-hidden','true');
    function shape(tag,attrs,text) {const n=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;svg.append(n);return n;}
    const y=v=>bottom-(bottom-top)*v/100;
    for(const v of [0,20,40,60,80,100]) {
      shape('line',{x1:left,y1:y(v),x2:width-10,y2:y(v),stroke:v===80?'#6ee7b7':'#374151','stroke-dasharray':v===80?'5 4':'0'});
      shape('text',{x:left-6,y:y(v)+4,'text-anchor':'end'},v+'%');
    }
    const coords=[];
    points.forEach((p,i)=>{
      const x=left+step*(i+.5),w=Math.min(34,step*.65);
      const bar=shape('rect',{x:x-w/2,y:y(p.share),width:w,height:bottom-y(p.share),fill:p.priority?'#10b981':'#6b7280',rx:3});
      bar.style.cursor='pointer';bar.addEventListener('click',()=>onSelect(p));
      coords.push(`${x},${y(p.cumulative)}`);
      shape('text',{x,y:bottom+22,'text-anchor':'middle'},String(i+1));
    });
    shape('polyline',{points:coords.join(' '),fill:'none',stroke:'#c4d3eb','stroke-width':2.5,'pointer-events':'none'});
    points.forEach((p,i)=>shape('circle',{cx:left+step*(i+.5),cy:y(p.cumulative),r:3.5,fill:'#c4d3eb','pointer-events':'none'}));
    const scroll=el('div','','chart-scroll');scroll.append(svg);box.append(scroll);
    box.append(el('p',`Barras: porcentaje ${denominator}. Línea: acumulado. Referencia: 80 %. Verde: conjunto mínimo del 80 %; gris: resto.`,'hint'));
    const list=el('details');list.append(el('summary','Ver cifras y problemas del gráfico'));
    points.forEach((p,i)=>{
      const frequency=p.count!=null?` · ${p.count} registros · Media ${p.average.toFixed(1)}/5`:'';
      const b=button(`${i+1}. ${p.name}${frequency} · Carga ${p.load} · ${p.share.toFixed(1)}% · Acumulado ${p.cumulative.toFixed(1)}%${p.priority?' · Foco 80 %':''}`,()=>onSelect(p),'area-row');list.append(b);
    });box.append(list);return box;
  }
  root.ParetoCharts={el,button,levels,pareto};
})(globalThis);
