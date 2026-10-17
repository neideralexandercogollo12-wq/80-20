const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
(async()=>{
 let version=1;
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const name=decodeURIComponent(url.pathname).replace(/^\/pareto\//,'')||'index.html',file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.setHeader('Cache-Control','no-store');
  if(name==='config.js')return res.end("window.PARETO_CONFIG={url:'https://test.supabase.co',anonKey:'public-test-key'};");
  if(name==='vendor/supabase-2.117.3.min.js')return res.end(fs.readFileSync(path.join(__dirname,'supabase-mock.js')));
  if(name==='sw.js')return res.end(fs.readFileSync(file,'utf8').replace(/2026-10-16-\d+/,'pwa-test-'+version));
  res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}/pareto/`;
  await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const manifest=await page.evaluate(async()=>await(await fetch('manifest.webmanifest')).json());assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');
  assert.equal(await page.locator('link[rel=apple-touch-icon]').getAttribute('href'),'assets/apple-touch-icon.png');
  for(const icon of manifest.icons){const response=await page.request.get(url+icon.src);assert.equal(response.status(),200);assert.equal(response.headers()['content-type'],'image/png');const bytes=await response.body();const size=Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
  await page.locator('#auth [data-install-app]').click();await page.locator('#installDialog').waitFor({state:'visible'});await page.getByRole('button',{name:'Entendido'}).click();
  await page.getByLabel('Correo',{exact:true}).fill('demo@example.com');await page.getByLabel('Contraseña',{exact:true}).fill('password');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.locator('#app').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Nueva acción',exact:true}).click();await page.locator('#actionText').fill('Mi borrador no debe perderse');
  version=2;await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});await page.locator('#appUpdate').waitFor({state:'visible'});
  assert.equal(await page.locator('#actionText').inputValue(),'Mi borrador no debe perderse');
  await page.locator('#actionText').fill('');await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Actualizar app',exact:true}).click()]);await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.some(k=>k.includes('pwa-test-2'))&&!keys.some(k=>k.includes('pwa-test-1'));});
  await page.waitForLoadState();
  const cacheUrls=await page.evaluate(async()=>{const list=[];for(const n of await caches.keys())for(const r of await(await caches.open(n)).keys())list.push(r.url);return list;});
  assert.ok(cacheUrls.some(u=>u.endsWith('/pareto/index.html')));assert.ok(cacheUrls.every(u=>u.startsWith(url)));assert.ok(!cacheUrls.some(u=>/config\.js|rest\/v1|auth\/v1/.test(u)));
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.locator('#connectionNotice').waitFor({state:'visible',timeout:5000});assert.equal(await page.title(),'Pareto Core');assert.ok(await page.locator('link[rel=manifest]').count());
  await context.setOffline(false);await page.reload();await page.locator('#connectionNotice').waitFor({state:'hidden'});assert.deepEqual(errors,[]);
  const mobile=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1'});const iphone=await mobile.newPage();await iphone.goto(url);await iphone.locator('#auth [data-install-app]').click();assert.match(await iphone.locator('#installInstructions').innerText(),/Safari.*Compartir.*pantalla de inicio/);assert.ok(await iphone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await iphone.screenshot({path:'/tmp/pareto-web/pwa-install-iphone.png',fullPage:true,animations:'disabled'});await mobile.close();
  console.log('PWA: manifiesto/iconos, subcarpeta, service worker real, caché sin config/datos, actualización manual sin perder borrador, apertura sin conexión, recuperación e instrucciones iPhone: OK');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
