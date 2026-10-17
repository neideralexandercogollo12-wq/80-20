const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {setup,login}=require('./browser.cjs');
(async()=>{const browser=await(process.env.TEST_WEBKIT==='1'?webkit:chromium).launch({headless:true});try{
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  const {page,errors}=await setup(browser,viewport);await login(page);await page.evaluate(()=>window.mock.palancas=Array.from({length:90},(_,i)=>({id:'s'+String(i).padStart(3,'0'),texto:'Acción '+i,completada:i>=60,importancia:3,categoria:null,user_id:'u1',created_at:new Date(2026,9,1,0,i).toISOString()})));
  await page.getByRole('button',{name:'Acciones',exact:true}).click();await page.locator('.action-row').nth(20).waitFor();
  const row=id=>page.locator('.action-row[data-motion-id="'+id+'"]');
  for(const [targetId,anchorId,completed] of [['s020','s021',true],['s070','s071',false]]){
   await row(targetId).scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollBy(0,-150));
   const target=row(targetId).locator('input[type=checkbox]');await target.focus();
   const old=await row(anchorId).boundingBox();assert.ok(old.y>0&&old.y<viewport.height);
   await page.evaluate(()=>window.mock.nextDelay=120);await target.setChecked(completed);
   assert.equal(await page.locator('#actionsBody .action-row').count(),90);
   await page.waitForFunction(([id,done])=>document.querySelector(`.action-row[data-motion-id="${id}"]`)?.classList.contains('done')===done,[targetId,completed]);
   const current=await row(anchorId).boundingBox();assert.ok(Math.abs(current.y-old.y)<3,`Ancla ${anchorId}: ${old.y} → ${current.y}`);assert.ok(await page.evaluate(()=>scrollY)>1000);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Acciones sin salto: completar y volver a pendientes conservan ancla visible y lista durante guardado, escritorio/móvil: OK');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
