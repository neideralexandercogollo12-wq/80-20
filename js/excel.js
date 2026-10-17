/* Browser port of the iPhone build 30 exporter. OOXML template is bundled, no network service. */
(function(root){
  'use strict';
  const A=typeof module!=='undefined'&&module.exports?require('./domain.js'):root.ParetoAnalysis;
  const styles={text:5,number:8,title:10,header:16};
  const xml=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const cell=(address,value,style=styles.text)=>`<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  const num=(address,value,formula)=>`<c r="${address}" s="${styles.number}">${formula?`<f>${xml(formula)}</f>`:''}<v>${value}</v></c>`;
  const row=(i,body,height=24)=>`<row r="${i}" ht="${height}" customHeight="1">${body}</row>`;
  function rowHeight(texts,widths){
    // Conservative font measurement, with a deterministic fallback for non-browser tests.
    let context=null;if(typeof document!=='undefined'){context=document.createElement('canvas').getContext('2d');if(context)context.font='11pt Arial';}
    return Math.min(409.5,Math.max(24,...texts.map((t,i)=>{
      const width=Math.max(16,widths[i]*7-12);
      const measure=s=>context?context.measureText(s).width:[...s].length*7.4;
      let lines=0;String(t||' ').split(/\r\n|\r|\n/).forEach(line=>{
        let current='';lines++;
        for(const char of line){if(measure(current+char)>width&&current){lines++;current=char;}else current+=char;}
      });return Math.ceil(lines*14.5*1.2)+8;
    })));
  }
  function sheet(body,widths,drawing,id){
    const cols=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${cols}</cols><sheetData>${body}</sheetData>${drawing?`<drawing r:id="${drawing}"/>`:''}<tableParts count="1"><tablePart r:id="ParetoTable${id}"/></tableParts></worksheet>`;
  }
  function table(files,id,name,ref,headers){
    files[`xl/tables/table${id}.xml`]=`<?xml version="1.0" encoding="UTF-8"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${id}" name="${name}" displayName="${name}" ref="${ref}" totalsRowShown="0"><autoFilter ref="${ref}"/><tableColumns count="${headers.length}">${headers.map((h,i)=>`<tableColumn id="${i+1}" name="${xml(h)}"/>`).join('')}</tableColumns><tableStyleInfo name="" showFirstColumn="0" showLastColumn="0" showRowStripes="0" showColumnStripes="0"/></table>`;
    const path=`xl/worksheets/_rels/sheet${id}.xml.rels`,existing=files[path]||'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    files[path]=existing.replace('</Relationships>',`<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${id}.xml" Id="ParetoTable${id}"/></Relationships>`);
    files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>',`<Override PartName="/xl/tables/table${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>`);
  }
  function chart(title,series,sheetName,start,labels,values,categoryColumn,valueColumn,levels){
    const end=start+Math.max(1,values.length)-1,range=`'${sheetName}'!$`;
    const cats=labels.map((s,i)=>`<c:pt idx="${i}"><c:v>${xml(s)}</c:v></c:pt>`).join('');
    const nums=values.map((v,i)=>`<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
    const colors=values.map((v,i)=>`<c:dPt><c:idx val="${i}"/><c:spPr><a:solidFill><a:srgbClr val="${levels?A.sage(v).slice(1):'96B8A5'}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:dPt>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:style val="10"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${xml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:plotArea><c:layout/><c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${xml(series)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="96B8A5"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>${colors}<c:cat><c:strRef><c:f>${range}${categoryColumn}$${start}:$${categoryColumn}$${end}</c:f><c:strCache><c:ptCount val="${labels.length}"/>${cats}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>${range}${valueColumn}$${start}:$${valueColumn}$${end}</c:f><c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="${values.length}"/>${nums}</c:numCache></c:numRef></c:val></c:ser><c:gapWidth val="65"/><c:axId val="100"/><c:axId val="200"/></c:barChart><c:catAx><c:axId val="100"/><c:scaling><c:orientation val="maxMin"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:tickLblPos val="nextTo"/><c:crossAx val="200"/><c:crosses val="autoZero"/><c:auto val="1"/></c:catAx><c:valAx><c:axId val="200"/><c:scaling><c:orientation val="minMax"/>${levels?'<c:max val="5"/>':''}<c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="100"/><c:crosses val="max"/><c:majorUnit val="${levels?1:Math.max(1,Math.ceil(values.reduce((m,v)=>Math.max(m,v),0)/5))}"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100"><a:solidFill><a:srgbClr val="1F2937"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:endParaRPr lang="es-ES"/></a:p></c:txPr></c:chartSpace>`;
  }
  function sizedDrawing(original,from,height,heights){
    let remaining=height,end=from;while(remaining>=(heights[end+1]||24)){remaining-=heights[end+1]||24;end++;}
    return original.replace(/<xdr:to>.*?<\/xdr:to>/s,part=>part.replace(/<xdr:row>\d+<\/xdr:row>/,`<xdr:row>${end}</xdr:row>`).replace(/<xdr:rowOff>\d+<\/xdr:rowOff>/,`<xdr:rowOff>${Math.round(remaining*12700)}</xdr:rowOff>`));
  }
  function entries(rows,bounds,template){
    if(!template['_rels/.rels']||!template['[Content_Types].xml']||!template['xl/workbook.xml'])throw new Error('Falta la plantilla de Excel.');
    if(rows.length>=1048570)throw new Error('Demasiados registros para un archivo Excel.');
    const files={...template},ordered=A.situationPoints(rows,bounds).map(p=>p.row),areas=A.categoryTotals(ordered),last=Math.max(2,ordered.length+1);
    const drawingID=id=>{const match=files[`xl/worksheets/sheet${id}.xml`]?.match(/<(?:x:)?drawing r:id="([^"]+)"/);if(!match)throw new Error('Plantilla incompleta.');return match[1];};
    const first=drawingID(1),second=drawingID(2),ah={4:32},sh={3:32};
    let dashboard=row(2,cell('A2','Áreas',styles.title))+row(4,cell('A4','Área',styles.header)+cell('B4','Carga',styles.header),32);
    areas.forEach(([name,load],i)=>{const r=i+5,h=rowHeight([A.areaLabel(name)],[34]);ah[r]=h;dashboard+=row(r,cell('A'+r,A.areaLabel(name))+num('B'+r,load,`SUMIF(Datos!A2:A${last},A${r},Datos!D2:D${last})`),h);});
    const headers=['Área','Evento','Emoción','Nivel (1–5)','Problema','Nivel original (1–10)'];
    let situations=row(2,cell('A2','Situaciones',styles.title))+row(3,['N.º','Situación','Nivel','Área'].map((h,i)=>cell(String.fromCharCode(65+i)+'3',h,styles.header)).join(''),32);
    let data=row(1,headers.map((h,i)=>cell(String.fromCharCode(65+i)+'1',h,styles.header)).join(''),32);
    ordered.forEach((item,i)=>{const s=i+4,d=i+2,h=rowHeight([item.evento,A.areaLabel(item.categoria)],[55,34]);sh[s]=h;
      situations+=row(s,num('A'+s,i+1)+cell('B'+s,item.evento)+num('C'+s,item.nivel)+cell('D'+s,A.areaLabel(item.categoria)),h);
      data+=row(d,cell('A'+d,A.areaLabel(item.categoria))+cell('B'+d,item.evento)+cell('C'+d,item.emocion)+num('D'+d,item.nivel)+cell('E'+d,item.problema)+(item.nivel_original_10!=null?num('F'+d,item.nivel_original_10):cell('F'+d,'')),rowHeight([A.areaLabel(item.categoria),item.evento,item.emocion,item.problema],[34,55,26,34]));
    });
    if(!ordered.length)situations+=row(6,cell('B6','No hay registros en este período.'));
    files['xl/worksheets/sheet1.xml']=sheet(dashboard,[34,14,4,12],first,1);
    files['xl/worksheets/sheet2.xml']=sheet(situations,[8,55,12,34,4],ordered.length?second:null,2);
    files['xl/worksheets/sheet3.xml']=sheet(data,[34,55,26,16,34,30],null,3);
    files['xl/drawings/charts/chart1.xml']=chart('Carga por área','Carga','Áreas',5,areas.map(([n])=>A.areaLabel(n)),areas.map(([,v])=>v),'A','B',false);
    files['xl/drawings/charts/chart2.xml']=chart('Fricción por situación (1–5)','Nivel','Situaciones',4,ordered.map(r=>r.evento),ordered.map(r=>r.nivel),'B','C',true);
    table(files,1,'ParetoAreas',`A4:B${areas.length+4}`,['Área','Carga']);
    table(files,2,'ParetoSituaciones',`A3:D${Math.max(4,ordered.length+3)}`,['N.º','Situación','Nivel','Área']);
    table(files,3,'ParetoDatos',`A1:F${last}`,headers);
    files['xl/workbook.xml']=files['xl/workbook.xml'].replace('name="Dashboard"','name="Áreas"');
    files['xl/drawings/drawing1.xml']=sizedDrawing(files['xl/drawings/drawing1.xml'].replace('<xdr:row>7</xdr:row>','<xdr:row>3</xdr:row>'),3,Math.max(408,areas.length*32+72),ah);
    files['xl/drawings/drawing2.xml']=sizedDrawing(files['xl/drawings/drawing2.xml'],2,Math.max(408,Object.values(sh).slice(1).reduce((n,h)=>n+Math.min(72,Math.max(24,h)),0)+72),sh);
    if(files['xl/sharedStrings.xml'])files['xl/sharedStrings.xml']='<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"/>';
    return files;
  }
  const encoder=new TextEncoder(),crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;});
  function archive(files){
    const parts=[],central=[];let offset=0,directorySize=0;
    const header=(pairs)=>{const bytes=new Uint8Array(pairs.reduce((n,[,s])=>n+s,0)),v=new DataView(bytes.buffer);let p=0;for(const [n,s]of pairs){if(s===4)v.setUint32(p,n,true);else v.setUint16(p,n,true);p+=s;}return bytes;};
    const names=Object.keys(files).sort();
    for(const name of names){const path=encoder.encode(name),value=encoder.encode(files[name]);let crc=0xffffffff;for(const byte of value)crc=(crc>>>8)^crcTable[(crc^byte)&255];crc=(crc^0xffffffff)>>>0;const size=value.length;
      const local=header([[0x04034b50,4],[20,2],[0x800,2],[0,2],[0,2],[33,2],[crc,4],[size,4],[size,4],[path.length,2],[0,2]]);
      const dir=header([[0x02014b50,4],[20,2],[20,2],[0x800,2],[0,2],[0,2],[33,2],[crc,4],[size,4],[size,4],[path.length,2],[0,2],[0,2],[0,2],[0,2],[0,4],[offset,4]]);
      parts.push(local,path,value);central.push(dir,path);offset+=local.length+path.length+size;directorySize+=dir.length+path.length;
      if(offset+directorySize>=0xffffffff)throw new Error('El informe es demasiado grande.');
    }
    const footer=header([[0x06054b50,4],[0,2],[0,2],[names.length,2],[names.length,2],[directorySize,4],[offset,4],[0,2]]);
    const all=[...parts,...central,footer],output=new Uint8Array(offset+directorySize+footer.length);let p=0;for(const part of all){output.set(part,p);p+=part.length;}return output;
  }
  let cached;
  async function workbook(rows,bounds){
    if(!cached){const response=await fetch('assets/excel-template.json');if(!response.ok)throw new Error('No se pudo cargar la plantilla Excel. Intenta de nuevo.');cached=await response.json();}
    return archive(entries(rows,bounds,cached));
  }
  const api={entries,archive,workbook,rowHeight};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ParetoExcel=api;
})(globalThis);
