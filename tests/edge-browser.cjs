const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {setup,login,ready,openAnalysis}=require('./browser.cjs');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const {page,errors}=await setup(browser,{width:390,height:844});await login(page);
    await page.evaluate(()=>{
      const now=new Date().toISOString();window.mock.fricciones=[
        {id:'a',user_id:'u1',evento:'Compartida del trabajo',categoria:'Trabajo y estudio',emocion:'',problema:'Compartido',nivel:5,nivel_original_10:9,created_at:now},
        {id:'b',user_id:'u1',evento:'Compartida del hogar',categoria:'Hogar y vida diaria',emocion:'',problema:'Compartido',nivel:3,nivel_original_10:5,created_at:now},
        ...Array.from({length:23},(_,i)=>({id:'extra'+String(i).padStart(2,'0'),user_id:'u1',evento:'Extra '+i,categoria:'Trabajo',emocion:'',problema:null,nivel:2,nivel_original_10:null,created_at:now}))
      ];
    });
    await openAnalysis(page);await ready(page);
    await page.getByRole('button',{name:'Trabajo y estudio',exact:false}).first().click();
    assert.equal(await page.locator('#detailBody .level-bar').count(),1);
    await page.locator('#detailBody').getByRole('button',{name:'Compartido',exact:false}).click();
    assert.match(await page.locator('#detailBody').innerText(),/Compartida del trabajo/);assert.doesNotMatch(await page.locator('#detailBody').innerText(),/Compartida del hogar/);
    assert.match(await page.locator('#detailBody').innerText(),/100% de la carga clasificada del área/);
    await page.locator('#detailBack').click();await page.locator('#detailBody .level-bar').click();await page.locator('#selectedSituation').getByRole('button',{name:'Editar registro'}).click();
    await page.locator('#editArea').selectOption('Mundo interior');await page.getByRole('button',{name:'Guardar cambios'}).click();await page.locator('#editDialog').waitFor({state:'hidden'});
    assert.match(await page.locator('#detailBody').innerText(),/No hay situaciones/);assert.equal(await page.locator('#selectedSituation').count(),0);await page.locator('#detailClose').click();
    await page.getByRole('button',{name:'Ver historial',exact:true}).click();await page.locator('#historyBody .record').first().waitFor();assert.equal(await page.locator('#historyBody .record').count(),10);
    await page.locator('#historyBody').getByRole('button',{name:'Siguiente',exact:true}).click();assert.equal(await page.locator('#historyBody .record').count(),10);
    await page.locator('#historyBody').getByRole('button',{name:'Siguiente',exact:true}).click();assert.equal(await page.locator('#historyBody .record').count(),5);
    await page.locator('#historyQuery').fill('Extra');await page.locator('#historyArea').selectOption('Trabajo');await page.locator('#historyBody .record').first().getByRole('button',{name:'Editar registro'}).click();
    assert.equal(await page.locator('#editArea').inputValue(),'Trabajo');assert.equal(await page.locator('#editArea option').count(),7);
    await page.locator('#editProblem').fill('Clasificado');await page.getByRole('button',{name:'Guardar cambios'}).click();await page.locator('#editDialog').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>window.mock.fricciones.filter(r=>r.categoria==='Trabajo'&&r.problema==='Clasificado').length),1);
    // Delete requires confirmation; cancelling must preserve the record.
    const beforeDelete=await page.evaluate(()=>window.mock.fricciones.length);
    await page.locator('#historyBody .record').first().getByRole('button',{name:'Eliminar',exact:true}).click();await page.locator('#deleteCancel').click();
    assert.equal(await page.evaluate(()=>window.mock.fricciones.length),beforeDelete);
    await page.locator('#historyBody .record').first().getByRole('button',{name:'Eliminar',exact:true}).click();await page.locator('#deleteConfirm').click();
    await page.waitForFunction(n=>window.mock.fricciones.length===n-1,beforeDelete);await ready(page);
    // A record removed elsewhere cannot be silently overwritten; keep its draft for recovery.
    await page.locator('#historyBody .record').first().getByRole('button',{name:'Editar registro'}).click();
    const removedText=await page.locator('#editEvent').inputValue();
    await page.evaluate(text=>window.mock.fricciones=window.mock.fricciones.filter(r=>r.evento!==text),removedText);
    await page.getByRole('button',{name:'Guardar cambios'}).click();await page.locator('#editError').getByText(/ya no está disponible/).waitFor();
    assert.equal(await page.locator('#editEvent').inputValue(),removedText);await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    // Declining replacement keeps the draft, no implicit write.
    await page.getByRole('button',{name:'Acciones',exact:true}).click();await page.locator('#actionText').fill('Mi borrador sin guardar');
    await openAnalysis(page);await ready(page);await page.getByRole('button',{name:'Ver detalles',exact:true}).first().click();
    await page.locator('#detailDialog').getByRole('button',{name:'Preparar acción para aliviar'}).click();await page.locator('#deleteCancel').click();assert.equal(await page.locator('#actionText').inputValue(),'Mi borrador sin guardar');assert.equal(await page.evaluate(()=>window.mock.palancas.length),0);
    await page.locator('#detailClose').click();
    // Keyboard: opening/closing details and level choice preserve explicit selection.
    await page.getByRole('button',{name:'Ver todos los registros',exact:true}).focus();await page.keyboard.press('Enter');assert.ok(await page.locator('#detailDialog').isVisible());await page.keyboard.press('Escape');assert.ok(!await page.locator('#detailDialog').isVisible());
    // Account switch during a full edit: backend may finish, UI must not apply old account data.
    await page.locator('#historyQuery').fill('Compartida del trabajo');await page.locator('#historyArea').selectOption('');
    await page.locator('#historyBody').getByRole('button',{name:'Editar registro'}).click();await page.locator('#editEvent').fill('Guardado pendiente');await page.evaluate(()=>window.mock.nextDelay=250);
    await page.getByRole('button',{name:'Guardar cambios'}).click();
    await page.evaluate(()=>{window.mock.user={id:'u2'};sessionStorage.setItem('mock-user',JSON.stringify(window.mock.user));window.mock.callback('SIGNED_IN',{user:window.mock.user});});
    await page.waitForTimeout(300);await page.locator('#app').waitFor({state:'visible'});assert.ok(!await page.locator('#editDialog').isVisible());assert.equal(await page.locator('#actionText').inputValue(),'');
    await openAnalysis(page);await ready(page);assert.doesNotMatch(await page.locator('#analysisBody').innerText(),/Compartido|Guardado pendiente/);
    // Expiry event clears every personal view and pending dialog.
    await page.evaluate(()=>{window.mock.user=null;sessionStorage.removeItem('mock-user');window.mock.callback('SIGNED_OUT',null);});await page.locator('#auth').waitFor({state:'visible'});assert.equal(await page.locator('#analysisBody').innerText(),'');assert.equal(await page.locator('#problemNames option').count(),0);
    assert.deepEqual(errors,[]);console.log('Bordes: área/problema compartido, reclasificación, paginación, legado, borrador protegido, teclado, cambio de cuenta durante guardado y expiración: OK');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
