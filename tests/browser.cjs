const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.QA_DIR||'/tmp/pareto-web';fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml'};
async function setup(browser,viewport={width:1280,height:900}){
  const page=await browser.newPage({viewport,acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());if(url.origin!=='http://pareto.test')return route.abort();
    const name=url.pathname.slice(1)||'index.html';
    if(name==='config.js')return route.fulfill({contentType:'application/javascript',body:"window.PARETO_CONFIG={url:'https://test.supabase.co',anonKey:'public-test-key'}"});
    const file=name==='vendor/supabase-2.117.3.min.js'?path.join(__dirname,'supabase-mock.js'):path.join(root,name);
    return route.fulfill({contentType:mime[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
  });
  await page.goto('http://pareto.test/');return {page,errors};
}
async function login(page){await page.getByLabel('Correo',{exact:true}).fill('demo@example.com');await page.getByLabel('Contraseña',{exact:true}).fill('password');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.locator('#app').waitFor({state:'visible'});}
// Análisis is intentionally hidden from navigation; exercise retained internals only in tests.
async function openAnalysis(page){await page.locator('[data-panel="analysis"]').evaluate(button=>button.click());}
async function ready(page){await page.locator('#analysisBody .metrics').waitFor();}
async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const {page,errors}=await setup(browser);
    await page.getByLabel('Recordar mi correo').check();await login(page);
    assert.equal(await page.locator('input[name=captureLevel]:checked').count(),0);
    await page.getByRole('button',{name:'Salir',exact:true}).click();await page.locator('#auth').waitFor({state:'visible'});
    await page.reload();assert.equal(await page.locator('#email').inputValue(),'demo@example.com');await page.getByLabel('Recordar mi correo').uncheck();assert.equal(await page.evaluate(()=>localStorage.getItem('pareto.remembered-email')),null);
    await login(page);await page.reload();await page.locator('#app').waitFor({state:'visible'}); // restored simulated session
    await page.getByRole('button',{name:'Escáner',exact:true}).click();
    // Contextual levels, area change, save and reset; optional emotion.
    await page.locator('#event').fill('Situación web de prueba');await page.locator('#problem').fill('Prueba web');
    await page.locator('input[name=captureLevel][value="4"]').check();
    assert.match(await page.locator('#captureLevels').innerText(),/Interfiere mucho con mi concentración/);
    await page.locator('#category').selectOption('Mundo interior');assert.match(await page.locator('#captureLevels').innerText(),/mi claridad o tranquilidad interior/);
    await page.getByRole('button',{name:'Registrar fricción'}).click();await page.waitForFunction(()=>window.mock.fricciones.some(r=>r.evento==='Situación web de prueba'));
    await page.waitForFunction(()=>!document.querySelector('input[name=captureLevel]:checked'));assert.equal(await page.locator('#event').inputValue(),'');
    await openAnalysis(page);await ready(page);
    assert.ok(await page.getByRole('heading',{name:'Problema principal del período'}).isVisible());
    await page.screenshot({path:path.join(out,'dashboard-desktop.png'),fullPage:true});
    await page.getByRole('button',{name:'Ver historial',exact:true}).click();await page.locator('#historyBody .record').first().waitFor();
    await page.locator('#historyQuery').fill('situacion web');assert.equal(await page.locator('#historyBody .record').count(),1);
    const original=await page.evaluate(()=>({...window.mock.fricciones.find(r=>r.evento==='Situación web de prueba')}));
    await page.locator('#historyBody').getByRole('button',{name:'Editar registro'}).click();
    await page.locator('#editEvent').fill('Situación corregida');await page.locator('#editEmotion').fill('Calma');await page.locator('#editArea').selectOption('Trabajo y estudio');await page.locator('#editProblem').fill('Compartido');await page.locator('input[name=editLevel][value="5"]').check();
    await page.getByRole('button',{name:'Guardar cambios'}).click();await page.locator('#editDialog').waitFor({state:'hidden'});
    const edited=await page.evaluate(id=>window.mock.fricciones.find(r=>r.id===id),original.id);assert.equal(edited.nivel,5);assert.equal(edited.emocion,'Calma');assert.equal(edited.id,original.id);assert.equal(edited.created_at,original.created_at);assert.equal(edited.nivel_original_10,original.nivel_original_10);
    await page.locator('#historyQuery').fill('');await page.locator('#historyArea').selectOption('Trabajo y estudio');assert.equal(await page.locator('#historyBody .record').count(),1);
    await page.locator('#historyBody').getByRole('button',{name:'Editar registro'}).click();await page.locator('#editEvent').fill('No guardar');await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await page.evaluate(id=>window.mock.fricciones.find(r=>r.id===id).evento,original.id),'Situación corregida');
    // Error retains edit values; retry succeeds and clears optional fields.
    await page.locator('#historyBody').getByRole('button',{name:'Editar registro'}).click();await page.locator('#editEmotion').fill('');await page.locator('#editProblem').fill('');await page.evaluate(()=>window.mock.fail=true);
    await page.getByRole('button',{name:'Guardar cambios'}).click();await page.locator('#editError').getByText('Error de prueba').waitFor();assert.equal(await page.locator('#editEvent').inputValue(),'Situación corregida');await page.evaluate(()=>window.mock.fail=false);
    await page.getByRole('button',{name:'Guardar cambios'}).click();await page.locator('#editDialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(id=>window.mock.fricciones.find(r=>r.id===id).problema,original.id),null);
    // Exact area detail includes unclassified and legacy rows separately.
    await ready(page);await page.getByRole('button',{name:'Trabajo y estudio',exact:false}).first().click();await page.locator('#detailDialog').waitFor({state:'visible'});assert.equal(await page.locator('#detailTitle').innerText(),'Trabajo y estudio');assert.equal(await page.locator('#detailBody .level-bar').count(),1);
    await page.locator('#detailBody .level-bar').click();assert.ok(await page.locator('#selectedSituation').isVisible());
    await page.screenshot({path:path.join(out,'area-desktop.png'),fullPage:true});
    await page.locator('#detailClose').click();await page.getByRole('button',{name:'Ver todos los registros',exact:true}).click();assert.ok(await page.locator('#detailBody .level-bar').count()>=4);await page.locator('#detailClose').click();
    // Change period closes details and prevents old results being shown during error.
    await page.locator('#period').selectOption('today');await ready(page);
    await page.evaluate(()=>window.mock.fail=true);await page.locator('#refresh').click();await page.locator('#analysisBody').getByRole('button',{name:'Reintentar'}).waitFor();assert.equal(await page.locator('#analysisBody .metrics').count(),0);await page.evaluate(()=>window.mock.fail=false);await page.locator('#analysisBody').getByRole('button',{name:'Reintentar'}).click();await ready(page);
    // Excel export uses the selected period; CSV is no longer offered.
    const xlsxDownload=page.waitForEvent('download');await page.locator('#exportExcel').click();const xlsx=await xlsxDownload;await xlsx.saveAs(path.join(out,'pareto-web.xlsx'));
    assert.equal(await page.locator('#exportCsv').count(),0);
    // Problem action draft protection and actions persistence.
    await page.getByRole('button',{name:'Ver detalles',exact:true}).first().click();await page.getByRole('button',{name:'Preparar una acción'}).click();await page.locator('#actionText').waitFor({state:'visible'});assert.equal(await page.locator('#actionText').inputValue(),'');assert.notEqual(await page.locator('#actionProblem').inputValue(),'');
    await page.locator('#actionText').fill('Mi acción manual');await page.locator('#importance').selectOption('5');await page.getByRole('button',{name:'Guardar acción',exact:true}).click();await page.waitForFunction(()=>window.mock.palancas.length===1);await page.locator('#actionsBody .action-row').waitFor();
    await page.locator('#actionsBody input[type=checkbox]').check();await page.waitForFunction(()=>window.mock.palancas[0].completada===true);
    await openAnalysis(page);await ready(page);
    // No classified problems => no empty problem cards, but stats and areas remain.
    await page.evaluate(()=>window.mock.fricciones.forEach(r=>r.problema=null));await page.locator('#refresh').click();await ready(page);assert.equal(await page.getByRole('heading',{name:'Problema principal del período'}).count(),0);assert.equal(await page.getByRole('heading',{name:'Focos de atención 80/20'}).count(),0);
    // Mobile layout, no overflow and keyboard accessible level rows.
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'dashboard-mobile.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.getByRole('button',{name:'Escáner',exact:true}).click();await page.screenshot({path:path.join(out,'scanner-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    // Pending read after sign out cannot repopulate personal data.
    await page.evaluate(()=>window.mock.nextDelay=250);await openAnalysis(page);await page.getByRole('button',{name:'Salir',exact:true}).click();await page.locator('#auth').waitFor({state:'visible'});await page.waitForTimeout(300);assert.equal(await page.locator('#analysisBody').innerText(),'');assert.equal(await page.locator('#password').inputValue(),'');
    assert.deepEqual(errors,[]);console.log('Chromium: acceso, sesión, captura, edición/reintento, gráficos, historial, acciones, Excel, móvil y cierre seguro: OK');
  }finally{await browser.close();}
  if(process.env.TEST_WEBKIT==='1'){
    const b=await webkit.launch({headless:true});try{const {page,errors}=await setup(b,{width:390,height:844});await login(page);await openAnalysis(page);await ready(page);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log('WebKit: acceso, análisis y diseño móvil: OK');}finally{await b.close();}
  }
}
module.exports={setup,login,ready,openAnalysis};
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
