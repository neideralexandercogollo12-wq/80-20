const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {setup,login,ready,openAnalysis}=require('./browser.cjs');
const out=process.env.QA_DIR||'/tmp/pareto-web';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await(process.env.TEST_WEBKIT==='1'?webkit:chromium).launch({headless:true});try{
 const {page,errors}=await setup(browser);await login(page);let count=0;page.on('download',()=>count++);
 async function readyReport(){await page.waitForFunction(()=>!document.querySelector('#reportDownload').disabled);}
 async function open(){await page.locator('#actionsExportExcel').click();await readyReport();}
 async function download(name){const pending=page.waitForEvent('download');await page.locator('#reportDownload').click();const file=await pending,target=path.join(out,name);await file.saveAs(target);return fs.readFileSync(target).toString('utf8');}
 await open();assert.equal(count,0);assert.equal(await page.locator('#reportPeriod').inputValue(),'week');
 await page.getByRole('tab',{name:'Situaciones',exact:true}).click();assert.match(await page.locator('#reportContent').innerText(),/Evento 0/);assert.doesNotMatch(await page.locator('#reportContent').innerText(),/Evento 3/);const first=await download('preview-week.xlsx');assert.ok(first.includes('Evento 0'));assert.ok(!first.includes('Evento 3'));assert.equal(count,1);
 await page.locator('#reportClose').click();assert.equal(await page.locator('#actionsExportExcel').evaluate(n=>n===document.activeElement),true);
 await page.evaluate(()=>window.mock.fail=true);await page.locator('#actionsExportExcel').click();await page.locator('#reportStatus').getByText('Error de prueba').waitFor();assert.equal(count,1);assert.equal(await page.locator('#reportDownload').isDisabled(),true);await page.evaluate(()=>window.mock.fail=false);await page.locator('#reportStatus').getByRole('button',{name:'Reintentar'}).click();await readyReport();
 await page.locator('#reportPeriod').selectOption('30');await readyReport();await page.getByRole('tab',{name:'Situaciones',exact:true}).click();assert.match(await page.locator('#reportContent').innerText(),/Evento 3/);assert.equal(await page.locator('#period').inputValue(),'week');const thirty=await download('preview-30.xlsx');assert.ok(thirty.includes('Evento 3'));assert.ok(!thirty.includes('Evento 4'));
 // Changing the source after a successful read must not change the export snapshot.
 await page.evaluate(()=>window.mock.fricciones[0].evento='CAMBIO POSTERIOR');const same=await download('preview-snapshot.xlsx');assert.ok(same.includes('Evento 0'));assert.ok(!same.includes('CAMBIO POSTERIOR'));await page.locator('#reportRefresh').click();await readyReport();assert.match(await page.locator('#reportContent').innerText(),/CAMBIO POSTERIOR/);
 await page.locator('#reportClose').click();await openAnalysis(page);await ready(page);await page.locator('#period').selectOption('90');await ready(page);await page.getByRole('button',{name:'Acciones',exact:true}).click();await open();assert.equal(await page.locator('#reportPeriod').inputValue(),'90');assert.equal(await page.locator('#reportContext').innerText().then(t=>t.includes('16 registros')),true);
 // Pending reads cannot put personal content back after closing or changing account.
 await page.locator('#reportClose').click();await page.evaluate(()=>window.mock.nextDelay=250);await page.locator('#actionsExportExcel').click();await page.keyboard.press('Escape');await page.waitForTimeout(300);assert.equal(await page.locator('#reportContent').innerText(),'');assert.equal(await page.locator('#reportDialog').isVisible(),false);
 await page.evaluate(()=>window.mock.nextDelay=250);await page.locator('#actionsExportExcel').click();await page.evaluate(()=>window.mock.callback('SIGNED_OUT',null));await page.waitForTimeout(300);assert.equal(await page.locator('#reportDialog').isVisible(),false);assert.equal(await page.locator('#reportContent').innerText(),'');assert.deepEqual(errors,[]);
 console.log('Vista previa: abrir sin descarga, secciones/períodos independientes, Excel del snapshot, actualizar, error/reintento, Escape/foco y cierre de sesión durante consulta: OK');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
