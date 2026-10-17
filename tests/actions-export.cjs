const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {setup,login,ready,openAnalysis}=require('./browser.cjs');
const out=process.env.QA_DIR||'/tmp/pareto-web';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const {page,errors}=await setup(browser);await login(page);
    assert.ok(await page.locator('#actions').isVisible());
    let count=0;page.on('download',()=>count++);
    async function report(name){const pending=page.waitForEvent('download');await page.locator('#actionsExportExcel').click();const file=await pending;const target=path.join(out,name);await file.saveAs(target);return fs.readFileSync(target).toString('utf8');}
    const first=await report('actions-week.xlsx');assert.ok(first.includes('Evento 0'));assert.ok(!first.includes('Evento 3')); // no previous visit to Analysis
    await page.evaluate(()=>window.mock.fail=true);await page.locator('#actionsExportExcel').click();await page.locator('#toast').getByText('Error de prueba').waitFor();
    await page.waitForFunction(()=>!document.querySelector('#actionsExportExcel').disabled);assert.equal(count,1);await page.evaluate(()=>window.mock.fail=false);
    await openAnalysis(page);await ready(page);await page.locator('#period').selectOption('30');await ready(page);
    await page.getByRole('button',{name:'Acciones',exact:true}).click();assert.match(await page.locator('#actionsExportExcel').getAttribute('title'),/30 días/);
    const thirty=await report('actions-30.xlsx');assert.ok(thirty.includes('Evento 3'));assert.ok(!thirty.includes('Evento 4'));
    await page.evaluate(()=>window.mock.nextDelay=250);await page.locator('#actionsExportExcel').click();await page.getByRole('button',{name:'Salir',exact:true}).click();
    await page.locator('#auth').waitFor({state:'visible'});await page.waitForTimeout(300);assert.equal(count,2);assert.deepEqual(errors,[]);
    console.log('Excel desde Acciones: acceso directo inicial, período, error/reintento y cierre de sesión durante exportación: OK');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
