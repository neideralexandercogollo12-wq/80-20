(function (root) {
  "use strict";
  const areas = [
    [
      "Trabajo y estudio",
      "Presión, sobrecarga y dificultades para desconectar.",
    ],
    ["Relaciones y vínculos", "Familia, pareja, amistades, límites y soledad."],
    ["Salud y bienestar", "Sueño, energía, cuerpo y cuidado personal."],
    ["Dinero y seguridad", "Gastos, deudas y preocupación económica."],
    ["Hogar y vida diaria", "Tareas, trámites, transporte y organización."],
    [
      "Mundo interior",
      "Autocrítica, culpa, propósito, valores y espiritualidad.",
    ],
  ];
  const levels = ["Leve", "Baja", "Moderada", "Alta", "Muy alta"];
  function levelLabel(value) {
    const level = Number(value);
    if (!Number.isInteger(level) || level < 1 || level > 5)
      throw new Error("La intensidad debe estar entre 1 y 5.");
    return levels[level - 1];
  }
  const formatLevel = (value) => Number(value) + "/5 · " + levelLabel(value);
  const legacyAreas = ["Trabajo", "Cotidiano", "Familia", "Alma"];
  const areaLabel = (name) =>
    legacyAreas.includes(name) ? name + " (anterior)" : name;
  function categoryTotals(rows) {
    const totals = new Map(areas.map(([name]) => [name, 0]));
    for (const row of rows)
      totals.set(
        row.categoria,
        (totals.get(row.categoria) || 0) + Number(row.nivel),
      );
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }
  const cleanName = (value) =>
    String(value || "")
      .trim()
      .replace(/\s+/gu, " ");
  const problemKey = (value) =>
    cleanName(value)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase("es");
  function periodBounds(mode = "week", offset = 0, now = new Date()) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    if (mode === "week") {
      start.setDate(
        start.getDate() +
          (start.getDay() === 0 ? -6 : 1 - start.getDay()) +
          Math.min(0, offset) * 7,
      );
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
    } else {
      if (!["today", "30", "90"].includes(mode)) throw new Error("Período inválido.");
      start.setDate(start.getDate() - (mode === "today" ? 1 : Number(mode)) + 1);
      end.setDate(end.getDate() + 1);
    }
    return { start, end };
  }
  function analyze(rows) {
    const groups = new Map();
    let total = 0,
      unclassifiedCount = 0,
      unclassifiedLoad = 0;
    for (const row of rows) {
      const level = Number(row.nivel);
      if (!Number.isInteger(level) || level < 1 || level > 5)
        throw new Error("Hay un registro con intensidad inválida.");
      total += level;
      const key = problemKey(row.problema);
      if (!key) {
        unclassifiedCount++;
        unclassifiedLoad += level;
        continue;
      }
      if (!groups.has(key))
        groups.set(key, {
          key,
          name: cleanName(row.problema),
          count: 0,
          load: 0,
          rows: [],
        });
      const group = groups.get(key);
      group.count++;
      group.load += level;
      group.rows.push(row);
    }
    const classifiedLoad = total - unclassifiedLoad;
    const problems = [...groups.values()].sort(
      (a, b) =>
        b.load - a.load ||
        b.count - a.count ||
        a.key.localeCompare(b.key, "es"),
    );
    let cumulative = 0;
    for (const p of problems) {
      p.priority = cumulative < classifiedLoad * 0.8;
      cumulative += p.load;
      p.average = p.load / p.count;
      p.share = (p.load / classifiedLoad) * 100;
      p.cumulative = (cumulative / classifiedLoad) * 100;
      p.recurrent = p.count >= 2;
    }
    return {
      problems,
      total,
      classifiedLoad,
      unclassifiedCount,
      unclassifiedLoad,
      coverage: rows.length
        ? ((rows.length - unclassifiedCount) / rows.length) * 100
        : 0,
      priorityCount: problems.filter((p) => p.priority).length,
    };
  }
  const importanceLabels = ["Muy baja", "Baja", "Media", "Alta", "Muy alta"];
  function importanceLabel(value) {
    return Number.isInteger(value) && value >= 1 && value <= 5
      ? `${value} · ${importanceLabels[value - 1]}` : "Sin valorar";
  }
  function orderActions(rows) {
    return [...rows].sort((a, b) => Number(a.completada) - Number(b.completada)
      || (b.importancia ?? 0) - (a.importancia ?? 0)
      || new Date(a.created_at) - new Date(b.created_at)
      || a.id.localeCompare(b.id));
  }
  const contexts = Object.fromEntries(areas.map(([area], i) => [area, [
    "mi concentración o mi avance.", "mi comunicación o el cuidado de mis vínculos.",
    "mi descanso, energía o cuidado personal.", "mi organización económica o mi sensación de seguridad.",
    "mis tareas o rutinas cotidianas.", "mi claridad o tranquilidad interior."
  ][i]]));
  const prefixes = ["Apenas interfiere con", "Interfiere un poco con", "Interfiere de forma apreciable con", "Interfiere mucho con", "Dificulta seriamente"];
  const references = ["Apenas interfiere con lo que quiero hacer o cuidar.", "Interfiere un poco, pero puedo avanzar.", "Interfiere de forma apreciable y necesita atención.", "Interfiere mucho y me cuesta avanzar.", "Me bloquea o dificulta seriamente lo que quiero hacer o cuidar."];
  function frictionDescription(area, level) {
    if (!Number.isInteger(level) || level < 1 || level > 5) return "Elige un nivel para ver cómo se aplica a esta área";
    return contexts[area] ? prefixes[level - 1] + " " + contexts[area] : references[level - 1];
  }
  const historyOrder = (a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id.localeCompare(a.id);
  function scope(rows, bounds, area = null) {
    return rows.filter(r => (!bounds || (new Date(r.created_at) >= bounds.start && new Date(r.created_at) < bounds.end)) && (area === null || r.categoria === area));
  }
  function situationPoints(rows, bounds, area = null) {
    const ordered = scope(rows, bounds, area).sort((a,b) => b.nivel - a.nivel || new Date(b.created_at) - new Date(a.created_at) || a.id.localeCompare(b.id));
    const total = analyze(ordered).total;
    let sum = 0;
    return ordered.map((row, i) => {
      const priority = sum < total * 0.8; sum += Number(row.nivel);
      return {row, key:row.id, name:row.evento, position:i + 1, load:row.nivel, share:row.nivel / total * 100, cumulative:sum / total * 100, priority};
    });
  }
  function filterHistory(rows, {query = "", area = "", level = ""} = {}) {
    const q = problemKey(query);
    return rows.filter(r => (!area || r.categoria === area) && (!level || r.nivel === Number(level)) && (!q || problemKey(r.evento).includes(q) || problemKey(r.problema).includes(q))).sort(historyOrder);
  }
  function validateRecord(draft, originalArea = null) {
    const patch = { evento:String(draft.evento || "").trim(), emocion:String(draft.emocion || "").trim(), categoria:draft.categoria, problema:cleanName(draft.problema) || null, nivel:Number(draft.nivel) };
    const length = s => [...(s || "")].length;
    if (length(patch.evento) < 1 || length(patch.evento) > 500) throw new Error("Escribe una situación de 1 a 500 caracteres.");
    if (length(patch.emocion) > 80) throw new Error("La emoción admite hasta 80 caracteres.");
    if (length(patch.problema) > 120) throw new Error("El problema admite hasta 120 caracteres.");
    levelLabel(patch.nivel);
    if (!areas.some(([name]) => name === patch.categoria) && patch.categoria !== originalArea) throw new Error("Elige una de las seis áreas actuales.");
    return patch;
  }
  function problemContexts(rows) {
    const grouped = new Map();
    for (const r of rows) {
      const key = problemKey(r.problema); if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, {key, name:cleanName(r.problema), loads:new Map()});
      const p = grouped.get(key); p.loads.set(r.categoria, (p.loads.get(r.categoria) || 0) + Number(r.nivel));
    }
    return [...grouped.values()].map(p => {
      const max = Math.max(...p.loads.values());
      return {key:p.key, name:p.name, areas:[...p.loads].filter(([a,n]) => n === max && areas.some(([v]) => v === a)).map(([a]) => a).sort((a,b)=>a.localeCompare(b,'es'))};
    }).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  }
  function filterActions(rows, area = '') {
    return orderActions(rows.filter(r => !area || (area === '__none' ? !r.categoria : r.categoria === area)));
  }
  function validActionArea(area) {
    if (area && !areas.some(([n])=>n === area)) throw new Error('Elige una de las seis áreas actuales.');
    return area || null;
  }
  const sage = level => level <= 2 ? "#B7CCC0" : level === 3 ? "#96B8A5" : "#769B87";
  const api = {
    frictionDescription, historyOrder, scope, situationPoints, filterHistory, validateRecord, sage,
    importanceLabels, importanceLabel, orderActions, problemContexts, filterActions, validActionArea,
    levels,
    levelLabel,
    formatLevel,
    areas,
    legacyAreas,
    areaLabel,
    categoryTotals,
    cleanName,
    problemKey,
    periodBounds,
    analyze,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ParetoAnalysis = api;
})(globalThis);
