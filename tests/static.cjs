const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml'};
(async()=>{
  // Real bundled Supabase client, no auth credentials or writes; serve under a Pages-like prefix.
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname).replace(/^\/pareto\//,'')||'index.html';
    const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});res.end(fs.readFileSync(file));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage(),errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('127.0.0.1'))failed.push(r.url());});
    await page.goto(`http://127.0.0.1:${server.address().port}/pareto/`);
    try { await page.waitForFunction(()=>document.querySelector('#authMessage').textContent!=='Comprobando sesión…',{},{timeout:10000}); }
    catch(e) { console.log({errors,failed,status:await page.locator('#authMessage').innerText()}); throw e; }
    assert.ok(await page.locator('#auth').isVisible());assert.equal(await page.evaluate(()=>typeof window.supabase.createClient),'function');
    assert.match(await page.locator('#authMessage').innerText(),/Ingresa con tu cuenta privada/);
    const parts=await page.evaluate(async()=>Object.keys(await(await fetch('assets/excel-template.json')).json()));assert.ok(parts.includes('_rels/.rels'));
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);console.log('Sitio estático bajo subcarpeta: dependencias reales, configuración local, login y plantilla Excel: OK');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
