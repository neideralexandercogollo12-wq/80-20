const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const {setup,login,openAnalysis,ready}=require('./browser.cjs');
(async()=>{const browser=await(process.env.TEST_WEBKIT==='1'?webkit:chromium).launch({headless:true});try{
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  const {page,errors}=await setup(browser,viewport);await login(page);
  await page.evaluate(()=>{
   const base={user_id:'u1',categoria:'Trabajo y estudio',emocion:'',problema:'Compartido',created_at:new Date().toISOString(),nivel_original_10:null};
   window.mock.fricciones=[{...base,id:'duplicate-a',evento:'Texto repetido',emocion:'ELIMINAR-A',problema:'Problema único',nivel:5},{...base,id:'duplicate-b',evento:'Texto repetido',emocion:'CONSERVAR-B',nivel:5},...Array.from({length:11},(_,i)=>({...base,id:'tail'+i,evento:'Cola '+i,nivel:3})),{...base,id:'only',evento:'Fin único',nivel:1},...Array.from({length:9},(_,i)=>({...base,id:'other'+i,evento:'Otro '+i,categoria:'Mundo interior',nivel:2})),{...base,id:'foreign',user_id:'u2',evento:'Ajeno',nivel:5}];
   window.mock.palancas=[{id:'linked',user_id:'u1',texto:'Acción que debe permanecer',problema_nombre:'Problema único',problema_clave:'problema unico',importancia:4,categoria:'Trabajo y estudio',completada:false,created_at:new Date().toISOString()}];
  });
  await openAnalysis(page);await ready(page);await page.locator('#historyToggle').click();await page.locator('#historyBody .record').first().waitFor();await page.locator('#exportExcel').click();await page.waitForFunction(()=>!document.querySelector('#reportDownload').disabled);await page.getByRole('tab',{name:'Situaciones',exact:true}).click();
  const remove=id=>page.locator(`#reportContent .report-delete[data-delete-id="${id}"]:visible`);
  const readyMutation=()=>page.waitForFunction(()=>!document.querySelector('#reportDownload').disabled);
  const count=()=>page.evaluate(()=>window.mock.fricciones.filter(r=>r.user_id==='u1').length);
  const actions=await page.evaluate(()=>JSON.stringify(window.mock.palancas));assert.equal(await count(),23);
  // Cancel and failed delete preserve the row and its snapshot.
  await remove('duplicate-a').click();assert.match(await page.locator('#deleteDescription').innerText(),/historial.*informes/);assert.match(await page.locator('#deleteDescription').innerText(),/Texto repetido/);await page.locator('#deleteCancel').click();await readyMutation();assert.equal(await count(),23);
  await remove('duplicate-a').click();await page.evaluate(()=>window.mock.fail=true);await page.locator('#deleteConfirm').click();await page.locator('#reportMutationError').getByText('Error de prueba').waitFor();await readyMutation();assert.equal(await count(),23);assert.equal(await remove('duplicate-a').count(),1);await page.evaluate(()=>window.mock.fail=false);
  // Confirm only one duplicate by ID; the next export and every derived view update.
  await remove('duplicate-a').click();await page.evaluate(()=>window.mock.nextDelay=120);await page.locator('#deleteConfirm').click();assert.equal(await page.locator('#reportDownload').isDisabled(),true);await page.locator('#reportStatus').getByText(/Situación eliminada/).waitFor();await readyMutation();assert.equal(await count(),22);assert.equal(await remove('duplicate-a').count(),0);assert.equal(await remove('duplicate-b').count(),1);assert.equal(await page.evaluate(()=>JSON.stringify(window.mock.palancas)),actions);assert.equal(await page.evaluate(()=>window.mock.fricciones.some(r=>r.id==='foreign')),true);assert.equal(await page.locator('#problemNames option[value="Problema único"]').count(),0);assert.match(await page.locator('#reportContext').innerText(),/22 registros/);
  const pending=page.waitForEvent('download');await page.locator('#reportDownload').click();const file=await pending;const target='/tmp/pareto-web/report-after-delete-'+viewport.width+'.xlsx';await file.saveAs(target);const bytes=fs.readFileSync(target).toString('utf8');assert.ok(!bytes.includes('ELIMINAR-A'));assert.ok(bytes.includes('CONSERVAR-B'));assert.ok(bytes.includes('ptCount val="22"'));
  await page.getByRole('tab',{name:'Áreas',exact:true}).click();const work=page.locator('#reportContent tbody tr').filter({hasText:'Trabajo y estudio'});assert.match(await work.innerText(),/39/);await page.getByRole('tab',{name:'Datos',exact:true}).click();assert.equal(await page.locator('#reportContent th').count(),6);assert.ok(!(await page.locator('#reportContent').innerText()).includes('ELIMINAR-A'));
  // Keep filters, clamp the final page, and handle an empty filtered set.
  await page.getByRole('tab',{name:'Situaciones',exact:true}).click();await page.locator('#reportContent').getByLabel('Filtrar Situación',{exact:true}).fill('Cola');await page.locator('#reportContent .pager').getByRole('button',{name:'Siguiente',exact:true}).click();const lastId=await page.locator('#reportContent .report-delete:visible').first().getAttribute('data-delete-id');await remove(lastId).click();await page.locator('#deleteConfirm').click();await readyMutation();assert.equal(await page.locator('#reportContent').getByLabel('Filtrar Situación',{exact:true}).inputValue(),'Cola');assert.equal(await page.locator('#reportContent tbody tr').count(),10);assert.match(await page.locator('#reportContent').innerText(),/1–10 de 10/);
  await page.locator('#reportContent').getByLabel('Filtrar Situación',{exact:true}).fill('Fin único');await remove('only').click();await page.locator('#deleteConfirm').click();await readyMutation();assert.match(await page.locator('#reportContent').innerText(),/No hay resultados con estos filtros/);assert.equal(await page.locator('#reportContent .bar-fill').count(),0);await page.locator('#reportContent').getByRole('button',{name:'Limpiar filtros'}).click();
  await page.screenshot({path:'/tmp/pareto-web/report-delete-'+viewport.width+'.png',fullPage:false,animations:'disabled'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#reportClose').click();await page.locator('#historyQuery').fill('Problema único');assert.equal(await page.locator('#historyBody .record').count(),0);assert.match(await page.locator('#analysisBody .metrics').innerText(),/20/);
  // Last real row and already-deleted row; refresh reconciles a missing record.
  await page.evaluate(()=>window.mock.fricciones=[{id:'last',user_id:'u1',categoria:'Mundo interior',evento:'Último',nivel:4,created_at:new Date().toISOString()}]);await page.locator('#exportExcel').click();await readyMutation();await page.getByRole('tab',{name:'Situaciones',exact:true}).click();await page.evaluate(()=>window.mock.fricciones=[]);await remove('last').click();await page.locator('#deleteConfirm').click();await page.locator('#reportMutationError').getByText(/ya no está disponible/).waitFor();await readyMutation();await page.locator('#reportRefresh').click();await readyMutation();assert.match(await page.locator('#reportContent').innerText(),/No hay registros/);
  await page.evaluate(()=>window.mock.fricciones=[{id:'last2',user_id:'u1',categoria:'Mundo interior',evento:'Último real',nivel:4,created_at:new Date().toISOString()}]);await page.locator('#reportRefresh').click();await readyMutation();await remove('last2').click();await page.locator('#deleteConfirm').click();await readyMutation();assert.match(await page.locator('#reportContent').innerText(),/No hay registros/);assert.match(await page.locator('#reportContext').innerText(),/0 registros/);assert.equal(await page.locator('#reportContent tbody tr').count(),0);
  // An older record is visible by default, editable and deletable without a date limit.
  await page.locator('#reportClose').click();
  await page.evaluate(()=>window.mock.fricciones=[{id:'older',user_id:'u1',categoria:'Mundo interior',evento:'Situación antigua',nivel:2,emocion:'Conservar',problema:'Vínculo',created_at:'2020-01-01T12:00:00Z',nivel_original_10:4}]);
  await page.locator('#exportExcel').click();await readyMutation();
  assert.equal(await page.locator('#reportPeriod').inputValue(),'all');
  await page.getByRole('tab',{name:'Situaciones',exact:true}).click();
  await page.locator('.report-edit[data-edit-id="older"]:visible').click();
  await page.locator('#editEvent').fill('Situación corregida');
  await page.locator('#editArea').selectOption('Trabajo y estudio');
  await page.locator('#editLevels input[value="5"]').check();
  await page.locator('#editSave').click();
  await page.locator('#reportStatus').getByText('Situación actualizada.').waitFor();
  const edited=await page.evaluate(()=>window.mock.fricciones[0]);
  assert.deepEqual([edited.evento,edited.categoria,edited.nivel,edited.emocion,edited.problema,edited.nivel_original_10],['Situación corregida','Trabajo y estudio',5,'Conservar','Vínculo',4]);
  await page.locator('#reportPeriod').selectOption('week');await readyMutation();
  assert.equal(await remove('older').count(),0);
  await page.locator('#reportPeriod').selectOption('all');await readyMutation();
  await remove('older').click();await page.locator('#deleteConfirm').click();await readyMutation();
  assert.equal(await count(),0);
  // Late deletion after changing account must not reopen or populate another account's report.
  await page.evaluate(()=>window.mock.fricciones=[{id:'late',user_id:'u1',categoria:'Mundo interior',evento:'Respuesta tardía',nivel:2,created_at:new Date().toISOString()}]);await page.locator('#reportRefresh').click();await readyMutation();await remove('late').click();await page.evaluate(()=>window.mock.nextDelay=180);await page.locator('#deleteConfirm').click();await page.evaluate(()=>{window.mock.user={id:'u2'};window.mock.callback('SIGNED_IN',{user:window.mock.user});});await page.waitForTimeout(250);assert.equal(await page.locator('#reportDialog').isVisible(),false);assert.equal(await page.locator('#reportContent').innerText(),'');assert.equal(await page.locator('#reportMutationError').innerText(),'');assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Eliminar desde informe PC/móvil: confirmación/cancelación, ID duplicados, propietario, error/reintento, Excel/cálculos/historial/nombres, filtros/página/vacío, acciones intactas y cambio de cuenta: OK');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
