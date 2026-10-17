(function(root) {
  'use strict';
  const A = typeof module !== 'undefined' && module.exports ? require('./domain.js') : root.ParetoAnalysis;
  const F = typeof module !== 'undefined' && module.exports ? require('./focus.js') : root.ParetoFocus;
  // All request generations belong to a verified account; no personal data is persisted here.
  class Store {
    constructor(service, notify = () => {}, focusStore = new F.MemoryPreferences()) {
      this.focusStore=focusStore; this.dispositions={}; this.focusKeys={}; this.reviewedContext=null; this.actionNotice=null;
      this.service = service; this.notify = notify; this.epoch = 0; this.tickets = {};
      this.user = null; this.period = 'week'; this.weekOffset = 0;
      this.analysis = []; this.history = []; this.actions = []; this.names = [];
      this.problemContexts = []; this.actionArea = ''; this.actionProblem = null; this.actionFilter = '';
      this.status = {}; this.historyLoaded = false; this.actionDraft = ''; this.importance = '';
    }
    bounds() { return A.periodBounds(this.period, this.weekOffset); }
    context(channel) {
      const epoch = this.epoch, user = this.user?.id;
      const ticket = channel ? this.tickets[channel] = (this.tickets[channel] || 0) + 1 : null;
      return {user, active:() => !!user && this.user?.id === user && this.epoch === epoch && (!channel || this.tickets[channel] === ticket)};
    }
    account(user) {
      if(this.user?.id === user?.id) return;
      this.epoch++; this.tickets = {}; this.user = user;
      this.analysis = []; this.history = []; this.actions = []; this.names = [];
      this.problemContexts = []; this.actionArea = ''; this.actionProblem = null; this.actionFilter = '';
      this.status = {}; this.historyLoaded = false; this.actionDraft = ''; this.importance = '';
      this.dispositions={};this.focusKeys={};this.reviewedContext=null;this.actionNotice=null;
      if(user){try{this.dispositions=this.focusStore.load(user.id);}catch{this.status.focus={error:'No se pudieron cargar los problemas apartados.'};}}
      this.period = 'week'; this.weekOffset = 0; this.notify('account');
    }
    async load(channel) {
      const c = this.context(channel); if(!c.user) return;
      this.status[channel] = {loading:true, error:null};
      if(channel !== 'names') this[channel] = [];
      this.notify(channel);
      try {
        const rows = await this.service.read(c.user, {
          table:channel === 'actions' ? 'palancas' : 'fricciones',
          bounds:channel === 'analysis' ? this.bounds() : undefined, active:c.active
        });
        if(!c.active()) return;
        if(channel === 'names') {
          this.problemContexts = A.problemContexts(rows);
          this.names = this.problemContexts.map(p=>p.name);
        } else {
          if(channel==='analysis') {
            const pairs=await Promise.all(A.analyze(rows).problems.map(async p=>[p.key,await F.key(p.key)]));
            if(!c.active())return;this.focusKeys=Object.fromEntries(pairs);
          }
          this[channel] = rows;
        }
        if(channel === 'history') this.historyLoaded = true;
        this.status[channel] = {loading:false,error:null};
      } catch(e) {
        if(!c.active()) return;
        this.status[channel] = {loading:false,error:e.message || 'No se pudo conectar. Intenta de nuevo.'};
      }
      if(c.active()) this.notify(channel);
    }
    setPeriod(period, offset = 0) {
      this.period = period; this.weekOffset = Math.min(0,offset);
      this.analysis=[];this.status.analysis={loading:true,error:null};this.notify('period'); return this.load('analysis');
    }
    async refreshRecords() {
      await Promise.all([this.load('analysis'), this.load('names'), ...(this.historyLoaded ? [this.load('history')] : [])]);
    }
    async saveRecord(draft, original = null) {
      const patch = A.validateRecord(draft, original?.categoria);
      const c = this.context(); if(!c.user) throw new Error('Inicia sesión para continuar.');
      if(original) await this.service.change(c.user, 'fricciones', original.id, patch, c.active);
      else await this.service.create(c.user, 'fricciones', patch, c.active);
      if(!c.active()) return false;
      await this.refreshRecords(); return c.active();
    }
    async deleteRecord(id, afterCommit = async () => {}) {
      const c = this.context(); if(!c.user) return false;
      await this.service.change(c.user,'fricciones',id,null,c.active);
      if(!c.active()) return false;
      await afterCommit(); if(!c.active()) return false;
      await this.refreshRecords(); return c.active();
    }
    get pendingProblems(){
      if(this.status.analysis?.loading||this.status.analysis?.error)return [];
      return A.analyze(this.analysis).problems.filter(p=>{const mark=this.dispositions[this.focusKeys[p.key]];return !mark||p.rows.some(r=>!F.includes(mark,r));});
    }
    get archivedProblems(){
      if(this.status.analysis?.loading||this.status.analysis?.error)return [];
      const pending=new Set(this.pendingProblems.map(p=>p.key));return A.analyze(this.analysis).problems.filter(p=>!pending.has(p.key));
    }
    reloadFocus(){this.dispositions=this.focusStore.load(this.user.id);this.status.focus={};this.notify('focus');}
    async omitProblem(problemKey){
      const c=this.context(), period=this.period, offset=this.weekOffset;
      if(!c.user||this.status.analysis?.loading||this.status.analysis?.error||this.status.focus?.error)throw Error('Actualiza el análisis antes de omitir.');
      const rows=this.analysis.filter(r=>A.problemKey(r.problema)===problemKey);if(!rows.length)return false;
      const hash=await F.key(problemKey);
      if(!c.active()||period!==this.period||offset!==this.weekOffset)return false;
      const next={...this.focusStore.load(c.user),[hash]:F.omitted(rows)};
      this.focusStore.save(c.user,next);this.dispositions=next;this.notify('focus');return true;
    }
    restoreProblem(problemKey){
      if(!this.user||!this.archivedProblems.some(p=>p.key===problemKey))throw Error('Este problema ya no está apartado en este período.');
      const next={...this.focusStore.load(this.user.id)};delete next[this.focusKeys[problemKey]];
      this.focusStore.save(this.user.id,next);this.dispositions=next;this.notify('focus');
    }
    clearActionDraft() { this.reviewedContext=null; this.actionDraft = ''; this.importance = ''; this.actionArea = ''; this.actionProblem = null; }
    hasActionDraft() { return !!(this.actionDraft.trim() || this.importance || this.actionArea); }
    prepareAction(problem, area = '', reviewedRows = []) { this.clearActionDraft(); this.actionProblem = problem; this.actionArea = A.validActionArea(area) || ''; this.reviewedContext=reviewedRows.length?reviewedRows.map(r=>r.id):null; }
    async saveAction() {
      const texto = this.actionDraft.trim(), importancia = Number(this.importance);
      if(!texto || [...texto].length > 300) throw new Error('Escribe una acción de 1 a 300 caracteres.');
      if(!Number.isInteger(importancia) || importancia < 1 || importancia > 5) throw new Error('Elige la importancia personal.');
      const c = this.context(); if(!c.user) return false;
      const problem=this.actionProblem, reviewed=this.reviewedContext, area=this.actionArea||null;this.actionNotice=null;
      await this.service.create(c.user,'palancas',{texto,importancia,completada:false,categoria:A.validActionArea(this.actionArea),problema_nombre:this.actionProblem?.name || null,problema_clave:this.actionProblem?.key || null},c.active);
      if(!c.active()) return false;
      this.clearActionDraft();
      if(this.actionFilter&&(this.actionFilter==='__none'?area!==null:area!==this.actionFilter))this.actionNotice='Acción guardada en '+(area||'Sin área')+'.';
      if(problem&&reviewed){
        try {
          const hash=await F.key(problem.key);if(!c.active())return false;
          const next={...this.focusStore.load(c.user)};next[hash]=F.reviewed(reviewed,next[hash]);
          this.focusStore.save(c.user,next);this.dispositions=next;this.notify('focus');
        }catch{if(c.active())this.actionNotice='Acción guardada. No se pudo retirar el foco; puedes omitirlo sin volver a guardar la acción.';}
      }
      if(!c.active())return false;await this.load('actions'); return c.active();
    }
    async changeAction(id,patch, afterCommit = async () => {}) {
      if(patch && Object.hasOwn(patch,'categoria')) patch = {...patch,categoria:A.validActionArea(patch.categoria)};
      const c = this.context(); if(!c.user) return false;
      await this.service.change(c.user,'palancas',id,patch,c.active);
      if(!c.active()) return false;
      await afterCommit();
      if(c.active()) await this.load('actions'); return c.active();
    }
  }
  if(typeof module !== 'undefined' && module.exports) module.exports = {Store};
  else root.ParetoState = {Store};
})(globalThis);
