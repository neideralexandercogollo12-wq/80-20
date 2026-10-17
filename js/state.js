(function(root) {
  'use strict';
  const A = typeof module !== 'undefined' && module.exports ? require('./domain.js') : root.ParetoAnalysis;
  // All request generations belong to a verified account; no personal data is persisted here.
  class Store {
    constructor(service, notify = () => {}) {
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
        } else this[channel] = rows;
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
      this.notify('period'); return this.load('analysis');
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
    clearActionDraft() { this.actionDraft = ''; this.importance = ''; this.actionArea = ''; this.actionProblem = null; }
    hasActionDraft() { return !!(this.actionDraft.trim() || this.importance || this.actionArea); }
    prepareAction(problem, area = '') { this.clearActionDraft(); this.actionProblem = problem; this.actionArea = A.validActionArea(area) || ''; }
    async saveAction() {
      const texto = this.actionDraft.trim(), importancia = Number(this.importance);
      if(!texto || [...texto].length > 300) throw new Error('Escribe una acción de 1 a 300 caracteres.');
      if(!Number.isInteger(importancia) || importancia < 1 || importancia > 5) throw new Error('Elige la importancia personal.');
      const c = this.context(); if(!c.user) return false;
      await this.service.create(c.user,'palancas',{texto,importancia,completada:false,categoria:A.validActionArea(this.actionArea),problema_nombre:this.actionProblem?.name || null,problema_clave:this.actionProblem?.key || null},c.active);
      if(!c.active()) return false;
      this.clearActionDraft(); await this.load('actions'); return c.active();
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
