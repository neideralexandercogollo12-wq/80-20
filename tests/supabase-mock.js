window.mock = {
  user: JSON.parse(sessionStorage.getItem("mock-user") || "null"),
  callback: null,
  fail: false,
  nextDelay: 0,
  fricciones: [],
  palancas: [],
};
const now = new Date(),
  today = new Date();
today.setHours(0, 0, 0, 0);
const recent = new Date(today);
recent.setHours(12);
for (let i = 0; i < 16; i++) {
  const date = new Date(recent);
  if (i === 3) date.setDate(date.getDate() - 15);
  if (i > 3) date.setDate(date.getDate() - 45);
  window.mock.fricciones.push({
    id: "f" + String(i).padStart(3, "0"),
    user_id: "u1",
    categoria: "Trabajo",
    evento: "Evento " + i,
    emocion: "Frustración",
    nivel: i === 0 ? 5 : 3,
    nivel_original_10: i === 0 ? 9 : 5,
    problema: i === 2 ? null : i % 2 ? "Interrupciones" : "Ruido",
    created_at: date.toISOString(),
  });
}
function query(table) {
  let op = "read",
    payload,
    filters = [],
    orders = [],
    range = [0, 999],
    columns;
  const q = {
    select(c) {
      columns = c;
      return q;
    },
    insert(row) {
      op = "insert";
      payload = row;
      return q;
    },
    update(row) {
      op = "update";
      payload = row;
      return q;
    },
    delete() {
      op = "delete";
      return q;
    },
    eq(k, v) {
      filters.push((r) => r[k] === v);
      return q;
    },
    gte(k, v) {
      filters.push((r) => r[k] >= v);
      return q;
    },
    lt(k, v) {
      filters.push((r) => r[k] < v);
      return q;
    },
    order(k, o) {
      orders.push([k, o]);
      return q;
    },
    range(a, b) {
      range = [a, b];
      return q;
    },
    then(resolve, reject) {
      const delay = window.mock.nextDelay;
      window.mock.nextDelay = 0;
      const fail = window.mock.fail;
      return new Promise((done) =>
        setTimeout(() => {
          if (fail)
            return done({ error: { message: "Error de prueba" }, data: null });
          const rows = window.mock[table];
          let matching = rows.filter((r) => filters.every((f) => f(r)));
          if (op === "insert") {
            const row = {
              id: "new" + rows.length,
              created_at: new Date().toISOString(),
              ...payload,
            };
            rows.push(row);
            matching = [row];
          }
          if (op === "update")
            matching.forEach((r) => Object.assign(r, payload));
          if (op === "delete")
            window.mock[table] = rows.filter((r) => !matching.includes(r));
          matching.sort((a, b) => {
            for (const [k, o] of orders) {
              if (a[k] !== b[k])
                return (a[k] < b[k] ? -1 : 1) * (o.ascending ? 1 : -1);
            }
            return 0;
          });
          done({
            data: matching.slice(range[0], range[1] + 1).map((r) => ({ ...r })),
            error: null,
          });
        }, delay),
      ).then(resolve, reject);
    },
  };
  return q;
}
window.supabase = {
  createClient: () => ({
    from: query,
    auth: {
      async getUser() {
        return { data: { user: window.mock.user }, error: null };
      },
      onAuthStateChange(fn) {
        window.mock.callback = fn;
        queueMicrotask(() => fn('INITIAL_SESSION', window.mock.user ? {user:window.mock.user} : null));
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signInWithPassword() {
        window.mock.user = { id: "u1" };
        sessionStorage.setItem("mock-user", JSON.stringify(window.mock.user));
        window.mock.callback("SIGNED_IN", { user: window.mock.user });
        return { data: { user: window.mock.user }, error: null };
      },
      async signOut() {
        window.mock.user = null;
        sessionStorage.removeItem("mock-user");
        window.mock.callback("SIGNED_OUT", null);
        return { error: null };
      },
    },
  }),
};
