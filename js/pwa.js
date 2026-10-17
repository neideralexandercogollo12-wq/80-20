/* Installation and connectivity only. No account or record data enters the offline cache. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const installed = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const buttons = [...document.querySelectorAll('[data-install-app]')];
  let prompt = null, registration = null;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function sync() {
    buttons.forEach(button => button.hidden = installed());
    $('connectionNotice').hidden = navigator.onLine;
  }
  let connectionCheck = 0;
  async function checkConnection() {
    const generation=++connectionCheck;sync();
    if(!navigator.onLine)return;
    try {
      // onLine may stay true with an unreachable connection. This public HEAD request caches nothing.
      await fetch(new URL('config.js',document.baseURI),{method:'HEAD',cache:'no-store',signal:AbortSignal.timeout(4000)});
    } catch {
      if(generation===connectionCheck)$('connectionNotice').hidden=false;
    }
  }
  checkConnection();window.addEventListener('online',checkConnection);
  window.addEventListener('offline',()=>{connectionCheck++;sync();});
  window.matchMedia('(display-mode: standalone)').addEventListener('change', sync);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault();prompt = event;sync(); });
  window.addEventListener('appinstalled', () => {prompt=null;buttons.forEach(button => button.hidden=true);});
  buttons.forEach(button => button.addEventListener('click', async () => {
    if (prompt) {
      const pending=prompt;prompt=null;
      try {await pending.prompt();await pending.userChoice;} catch {showHelp();}
    } else showHelp();
  }));
  function showHelp() {
    $('installInstructions').textContent = ios
      ? 'En Safari, abre Compartir → Agregar a pantalla de inicio. Activa «Abrir como app web» si aparece y pulsa Agregar.'
      : 'Abre el menú de tu navegador y busca «Instalar Pareto Core», «Instalar página como aplicación» o «Agregar al Dock». Si no aparece, prueba con Chrome, Edge o Safari actualizado.';
    $('installDialog').showModal();
  }
  $('installClose').onclick=()=>$('installDialog').close();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)$('installDialog').close();});
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register(new URL('../sw.js', new URL('js/pwa.js',document.baseURI)), {updateViaCache:'none'}).then(value => {
      registration=value;
      const showUpdate=()=>{if(value.waiting&&navigator.serviceWorker.controller)$('appUpdate').hidden=false;};
      showUpdate();
      value.addEventListener('updatefound',()=>{
        value.installing?.addEventListener('statechange',showUpdate);
      });
    }).catch(()=>{/* The online web remains usable when installation caching is unavailable. */});
    let requestedReload=false;
    $('applyUpdate').onclick=()=>{
      if(!registration?.waiting)return;
      requestedReload=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
    };
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requestedReload)location.reload();});
  }
})();
