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

(async()=>{
 const browser=await (process.env.TEST_WEBKIT==='1'?webkit:chromium).launch({headless:true});
 try{
  const {page,errors}=await setup(browser);await login(page);
  await page.evaluate(()=>{
   const m=window.mock,base={user_id:'u1',emocion:'',evento:'Contexto',nivel_original_10:null};
   m.fricciones=[{...base,id:'new',categoria:'Trabajo y estudio',problema:'Ruido',nivel:2,created_at:new Date().toISOString()},{...base,id:'old',categoria:'Mundo interior',problema:'ruído',nivel:5,created_at:'2020-01-01'},{...base,id:'tie1',categoria:'Trabajo y estudio',problema:'Empate',nivel:4,created_at:'2020-01-01'},{...base,id:'tie2',categoria:'Mundo interior',problema:'Empate',nivel:4,created_at:'2020-01-01'}];
   m.palancas=[{id:'linked',user_id:'u1',texto:'Acción del iPhone',importancia:5,completada:false,categoria:'Trabajo y estudio',problema_nombre:'Ya eliminado',problema_clave:'ya eliminado',created_at:'2020-01-01'},{id:'done',user_id:'u1',texto:'Hecho',importancia:3,completada:true,categoria:null,created_at:'2020-01-01'}];
  });
  await page.locator('#refreshActions').click();await page.getByText('Acción del iPhone',{exact:true}).waitFor();
  await page.locator('#actionFilter').selectOption('__none');assert.equal(await page.locator('#actionsBody progress').getAttribute('value'),'100');assert.equal(await page.getByText('Acción del iPhone',{exact:true}).count(),0);
  await page.locator('#actionFilter').selectOption('');
  await page.locator('.action-row').filter({hasText:'Acción del iPhone'}).locator('summary').click();await page.getByRole('button',{name:'Añadir otra acción'}).click();
  assert.equal(await page.locator('#actionText').inputValue(),'');assert.equal(await page.locator('#importance').inputValue(),'');assert.equal(await page.locator('#actionArea').inputValue(),'Trabajo y estudio');assert.equal(await page.locator('#actionProblem').inputValue(),'ya eliminado');
  await page.locator('#actionCancel').click();await page.getByRole('button',{name:'Nueva acción',exact:true}).click();
  await page.locator('#actionProblem').selectOption('ruido');assert.equal(await page.locator('#actionArea').inputValue(),'Mundo interior');
  await page.locator('#actionText').fill('Mi paso');await page.locator('#importance').selectOption('4');
  await page.locator('#actionProblem').selectOption('empate');await page.locator('#actionChoice').waitFor();await page.locator('#actionChoiceCancel').click();assert.equal(await page.locator('#actionProblem').inputValue(),'ruido');assert.equal(await page.locator('#actionText').inputValue(),'Mi paso');
  await page.locator('#actionProblem').selectOption('empate');await page.locator('#actionChoiceArea').selectOption('Trabajo y estudio');await page.locator('#actionChoiceSave').click();assert.equal(await page.locator('#actionArea').inputValue(),'Trabajo y estudio');
  await page.locator('#actionProblem').selectOption('');assert.equal(await page.locator('#actionArea').inputValue(),'Trabajo y estudio');
  await page.locator('#actionProblem').selectOption('ruido');await page.evaluate(()=>window.mock.fail=true);await page.locator('#actionSave').click();await page.locator('#actionError').getByText('Error de prueba').waitFor();assert.equal(await page.locator('#actionText').inputValue(),'Mi paso');await page.evaluate(()=>window.mock.fail=false);await page.locator('#actionSave').click();await page.locator('#actions').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.mock.palancas.find(r=>r.texto==='Mi paso').problema_clave),'ruido');
  await page.locator('#actionFilter').selectOption('Mundo interior');const item=page.locator('.action-row').filter({hasText:'Mi paso'});await item.locator('summary').click();await item.getByRole('button',{name:'Cambiar área'}).click();await page.locator('#actionChoiceArea').selectOption('');await page.locator('#actionChoiceSave').click();await page.locator('#actionChoice').waitFor({state:'hidden'});assert.equal(await page.locator('.action-row').count(),0);assert.equal(await page.evaluate(()=>window.mock.palancas.find(r=>r.texto==='Mi paso').categoria),null);
  await page.locator('#actionFilter').selectOption('');await page.getByRole('button',{name:'Nueva acción',exact:true}).click();await page.locator('#actionText').fill('Conservar borrador');await page.locator('#actionArea').selectOption('Salud y bienestar');await page.getByRole('button',{name:'Acciones',exact:true}).click();
  const linked=page.locator('.action-row').filter({hasText:'Acción del iPhone'});await linked.locator('summary').click();page.once('dialog',d=>d.dismiss());await linked.getByRole('button',{name:'Añadir otra acción'}).click();await page.getByRole('button',{name:'Nueva acción',exact:true}).click();assert.equal(await page.locator('#actionText').inputValue(),'Conservar borrador');assert.equal(await page.locator('#actionArea').inputValue(),'Salud y bienestar');
  await page.getByRole('button',{name:'Acciones',exact:true}).click();await page.evaluate(()=>window.mock.fail=true);await page.getByRole('button',{name:'Nueva acción',exact:true}).click();await page.locator('#problemStatus').getByRole('button',{name:'Reintentar'}).waitFor();assert.equal(await page.locator('#actionText').inputValue(),'Conservar borrador');await page.evaluate(()=>window.mock.fail=false);await page.locator('#problemStatus').getByRole('button',{name:'Reintentar'}).click();await page.waitForFunction(()=>!document.querySelector('#actionProblem').disabled);assert.equal(await page.locator('#actionArea').inputValue(),'Salud y bienestar');await page.getByRole('button',{name:'Acciones',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.locator('#actionFilter').selectOption('');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(out,'actions-areas-mobile.png'),fullPage:true});await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(out,'actions-areas-desktop.png'),fullPage:true});assert.deepEqual(errors,[]);
  console.log('Acciones: filtros/progreso, vínculos iPhone y huérfanos, formulario vacío, historial completo, empates/cancelación, desvincular, error/reintento, NULL, móvil/escritorio: OK');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
