(function(root) {
  'use strict';
  const fields = 'id,categoria,evento,emocion,nivel,nivel_original_10,problema,created_at';
  const actionFields = 'id,texto,completada,importancia,created_at,categoria,problema_nombre,problema_clave';
  class Cancelled extends Error {}
  function check(active) { if (!active()) throw new Cancelled('Solicitud cancelada.'); }
  class Service {
    constructor(db) { this.db = db; this.onSessionError = () => {}; }
    fail(error) {
      if(error && (['PGRST301','PGRST302','PGRST303'].includes(error.code) || error.status === 401)) this.onSessionError();
      if(error) throw error;
    }
    async read(user, {table = 'fricciones', bounds, active = () => true} = {}) {
      const rows = [];
      for(let from = 0; ; from += 500) {
        check(active);
        let q = this.db.from(table).select(table === 'fricciones' ? fields : actionFields)
          .eq('user_id', user).order('created_at', {ascending:false}).order('id', {ascending:false});
        if(bounds) q = q.gte('created_at', bounds.start.toISOString()).lt('created_at', bounds.end.toISOString());
        const {data, error} = await q.range(from, from + 499);
        check(active); this.fail(error);
        rows.push(...(data || []));
        if(!data || data.length < 500) return rows;
      }
    }
    async create(user, table, values, active = () => true) {
      check(active);
      const {error} = await this.db.from(table).insert({...values, user_id:user});
      check(active); this.fail(error);
    }
    async change(user, table, id, patch, active = () => true) {
      check(active);
      let q = patch === null ? this.db.from(table).delete() : this.db.from(table).update(patch);
      const {data, error} = await q.eq('user_id', user).eq('id', id).select('id');
      check(active); this.fail(error);
      if(!data?.length) throw new Error('El registro ya no está disponible. Actualiza para comprobarlo.');
    }
  }
  const api = {Service, Cancelled};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ParetoService = api;
})(globalThis);
