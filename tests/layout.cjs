const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {setup,login,openAnalysis}=require('./browser.cjs');
const out=process.env.QA_DIR||'/tmp/pareto-web';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const {page,errors}=await setup(browser,{width:1280,height:900});await login(page);
    assert.ok(await page.locator('#actions').isVisible());
    assert.equal(await page.getByRole('button',{name:'Análisis',exact:true}).count(),0);
    assert.deepEqual(await page.locator('.tabs button:not([hidden])').allTextContents(),['Acciones','Nueva acción','Escáner']);
    assert.equal(await page.locator('.topbar .tabs').count(),1);
    assert.ok((await page.locator('.tabs').boundingBox()).y<100);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()),'#030712');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()),'#10b981');
    await page.evaluate(()=>{
      window.mock.palancas=[
        {id:'p1',user_id:'u1',texto:'Preparar la entrega',completada:false,importancia:5,created_at:new Date().toISOString()},
        {id:'p2',user_id:'u1',texto:'Organizar mis ideas',completada:false,importancia:3,created_at:new Date().toISOString()},
        {id:'p3',user_id:'u1',texto:'Acción anterior',completada:true,importancia:4,created_at:new Date().toISOString()}
      ];
    });
    await page.locator('#refreshActions').click();await page.locator('#actionsBody .action-row').first().waitFor();
    assert.equal(await page.locator('#actionsBody>section').first().locator('h2').innerText(),'Pendientes');
    assert.match(await page.locator('#actionsBody .action-row').first().innerText(),/Preparar la entrega/);
    assert.equal(await page.locator('#actions #actionForm').count(),0);
    assert.ok(!await page.locator('#actionForm').isVisible());
    assert.ok((await page.locator('#actionsBody .action-row').first().boundingBox()).y<650);
    await page.screenshot({path:path.join(out,'actions-desktop-emerald.png'),fullPage:true});
    await page.getByRole('button',{name:'Nueva acción',exact:true}).click();
    await page.locator('#actionText').fill('Mi borrador');
    await page.getByRole('button',{name:'Acciones',exact:true}).click();
    assert.ok(!await page.locator('#actionForm').isVisible());
    await page.getByRole('button',{name:'Nueva acción',exact:true}).click();
    assert.equal(await page.locator('#actionText').inputValue(),'Mi borrador');
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>document.querySelector('.tabs button').dataset.panel==='scanner');
    assert.deepEqual(await page.locator('.tabs button:not([hidden])').allTextContents(),['Escáner','Acciones','Nueva acción']);
    assert.equal(await page.locator('.topbar .tabs').count(),0);
    assert.ok((await page.locator('.tabs').boundingBox()).y>700);
    assert.equal(await page.locator('#actionText').inputValue(),'Mi borrador');
    assert.ok(await page.locator('#new-action').isVisible()); // Resizing does not change the active screen.
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(out,'actions-mobile-refined.png'),fullPage:true});
    await page.locator('#importance').selectOption('4');
    await page.evaluate(()=>window.mock.fail=true);
    await page.getByRole('button',{name:'Guardar acción',exact:true}).click();
    await page.locator('#actionError').getByText('Error de prueba').waitFor();
    assert.equal(await page.locator('#actionText').inputValue(),'Mi borrador');
    await page.evaluate(()=>window.mock.fail=false);
    await page.getByRole('button',{name:'Guardar acción',exact:true}).click();
    await page.locator('#actions').waitFor({state:'visible'});
    await page.getByRole('button',{name:'Nueva acción',exact:true}).click();
    assert.equal(await page.locator('#actionText').inputValue(),'');
    await page.getByRole('button',{name:'Salir',exact:true}).click();await login(page);assert.ok(await page.locator('#scanner').isVisible());
    assert.equal(await page.getByRole('button',{name:'Análisis',exact:true}).count(),0);
    await openAnalysis(page);await page.locator('#analysisBody .metrics').waitFor();
    await page.getByRole('button',{name:'Ver todos los registros',exact:true}).click();
    assert.equal(await page.locator('.bar-fill').first().evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(16, 185, 129)');
    await page.locator('#detailClose').click();
    await page.setViewportSize({width:800,height:900});
    await page.waitForFunction(()=>document.querySelector('.tabs button').dataset.panel==='actions');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.getByRole('button',{name:'Salir',exact:true}).click();await login(page);assert.ok(await page.locator('#actions').isVisible());
    assert.deepEqual(errors,[]);console.log('Escritorio: acciones pendientes primero, pestaña Nueva acción independiente. Móvil: navegación inferior, borrador conservado y guardado con reintento. OK');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
