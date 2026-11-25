// Calcoli dei progressi, fatti in locale sul telefono.
// Riprendono le definizioni della dashboard «Report progresso bulk».

const DAY = 864e5;
const t = (iso) => Date.parse(iso + 'T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

export function makeStats(DATA, S, today) {
  const first = [...DATA.pesate, ...(S.pesate || []), ...(S.misure || [])].map((x) => x.data).sort()[0] || today;
  const start = DATA.schede.length ? DATA.schede[0].inizio : iso(t(first) - ((new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7) * DAY);
  const gw = (d) => Math.floor((t(d) - t(start)) / (7 * DAY)) + 1; // settimana globale: 1 = 07/09/2026
  const monday = (w) => iso(t(start) + (w - 1) * 7 * DAY);

  // ---- pesate: diario + inserite nell'app (l'app prevale sulla stessa data)
  const pm = new Map(DATA.pesate.map((p) => [p.data, { ...p, fonte: 'diario' }]));
  for (const p of S.pesate || []) pm.set(p.data, { ...p, fonte: 'app' });
  const pesate = [...pm.values()].filter((p) => p.data <= today).sort((a, b) => (a.data < b.data ? -1 : 1));
  pesate.forEach((p) => {
    const from = t(p.data) - 6 * DAY;
    p.media7 = r2(avg(pesate.filter((q) => t(q.data) >= from && q.data <= p.data).map((q) => q.peso)));
  });

  const tendenza = (() => {
    if (pesate.length < 2) return null;
    const pts = pesate.map((p) => [t(p.data) / DAY, p.peso]);
    const mx = avg(pts.map((p) => p[0])), my = avg(pts.map((p) => p[1]));
    let num = 0, den = 0;
    for (const p of pts) { num += (p[0] - mx) * (p[1] - my); den += (p[0] - mx) ** 2; }
    return den ? (num / den) * 7 : null;
  })();

  // ---- carichi: righe per scheda, settimana ed esercizio (diario + app)
  const sessEntry = (sess, ex) => {
    const r = sess.esercizi[ex.id];
    if (!r || r.saltato) return null;
    const done = r.serie.filter((x) => x.fatto && x.carico != null);
    if (!done.length) return null;
    return { carico: Math.max(...done.map((x) => x.carico)), reps: avg(done.map((x) => x.reps ?? ex.reps)), serieFatte: done.length,
      tonn: done.reduce((s, x) => s + x.carico * (x.reps ?? ex.reps), 0), fonte: 'app' };
  };
  const carichi = [];
  for (const sch of DATA.schede) {
    for (const ex of sch.esercizi) {
      const byW = new Map();
      for (const h of ex.storico) byW.set(h.settimana, { carico: h.carico, reps: h.reps, repsFatte: h.repsRegistrate ? h.reps : null, piu: !!h.piu, fonte: 'diario' });
      for (const s of S.sessions || []) {
        if (s.scheda !== sch.id) continue;
        const e = sessEntry(s, ex);
        if (e) byW.set(s.settimana, { carico: e.carico, reps: e.reps, repsFatte: e.reps, piu: false, fonte: 'app', tonnApp: e.tonn });
      }
      for (const [w, v] of byW) {
        const date = sch.settimane[w - 1];
        if (!date) continue;
        carichi.push({ scheda: sch.id, settimana: w, globale: gw(date), data: date, giorno: ex.giorno, esercizio: ex.nome, id: ex.id,
          gruppo: ex.gruppo, riferimento: ex.riferimento, serie: ex.serie, ...v,
          tonn: v.tonnApp ?? ex.serie * (v.reps ?? ex.reps) * v.carico });
      }
    }
  }

  // ---- settimane
  const settimane = [];
  for (const sch of DATA.schede) {
    sch.settimane.forEach((d, i) => {
      if (!d || d > today || (sch.fine && d > sch.fine)) return;
      const w = i + 1;
      const sed = new Set(sch.seduteSvolte[i] || []);
      for (const s of S.sessions || []) if (s.scheda === sch.id && s.settimana === w && s.chiusa) sed.add(s.giorno);
      const rows = carichi.filter((c) => c.scheda === sch.id && c.settimana === w);
      if (!rows.length && !sed.size && d < sch.inizio) return;
      const pw = pesate.filter((p) => p.data >= d && t(p.data) < t(d) + 7 * DAY).map((p) => p.peso);
      settimane.push({ scheda: sch.id, settimana: w, globale: gw(d), dal: d, sedute: sed.size, previsti: sch.giorni.length,
        completa: sed.size >= sch.giorni.length, peso: r2(avg(pw)), nPesate: pw.length,
        tonn: Math.round(rows.reduce((s, r) => s + r.tonn, 0)), serie: rows.reduce((s, r) => s + r.serie, 0) });
    });
  }
  // una settimana globale può comparire in due schede (fine/inizio): tieni quella con più dati
  const byG = new Map();
  for (const s of settimane) { const o = byG.get(s.globale); if (!o || s.tonn > o.tonn) byG.set(s.globale, s); }
  const sett = [...byG.values()].sort((a, b) => a.globale - b.globale);
  // peso medio per ogni settimana con pesate (anche senza allenamenti)
  const pesoSett = [];
  if (pesate.length) {
    for (let w = 1; w <= gw(today); w++) {
      const d = monday(w);
      const pw = pesate.filter((p) => p.data >= d && t(p.data) < t(d) + 7 * DAY).map((p) => p.peso);
      if (pw.length) pesoSett.push({ globale: w, dal: d, peso: r2(avg(pw)), n: pw.length });
    }
  }
  const isFull = (sch, w) => settimane.some((s) => s.scheda === sch && s.settimana === w && s.completa);

  // ---- massimali stimati (Epley) sugli esercizi di riferimento, solo settimane complete
  const massimali = [];
  {
    const best = new Map();
    for (const c of carichi) {
      if (!c.riferimento || !isFull(c.scheda, c.settimana)) continue;
      const e1 = c.carico * (1 + (c.repsFatte ?? c.reps) / 30);
      const k = `${c.scheda}|${c.settimana}|${c.riferimento}`;
      if (!best.has(k) || e1 > best.get(k).e1rm) best.set(k, { scheda: c.scheda, settimana: c.settimana, globale: c.globale, base: c.riferimento, e1rm: Math.round(e1 * 10) / 10 });
    }
    massimali.push(...[...best.values()].sort((a, b) => a.globale - b.globale));
  }
  const forza = (() => {
    const sums = new Map();
    for (const m of massimali) { const k = `${m.scheda}|${m.settimana}`; const o = sums.get(k) || { scheda: m.scheda, settimana: m.settimana, globale: m.globale, n: 0, tot: 0 }; o.n++; o.tot += m.e1rm; sums.set(k, o); }
    const bases = new Map();
    for (const m of massimali) { if (!bases.has(m.scheda)) bases.set(m.scheda, new Set()); bases.get(m.scheda).add(m.base); }
    const complete = [...sums.values()].filter((o) => o.n === bases.get(o.scheda).size).sort((a, b) => a.globale - b.globale);
    if (!complete.length) return null;
    const sch = complete[complete.length - 1].scheda;
    const cs = complete.filter((o) => o.scheda === sch);
    const a = cs[0], b = cs[cs.length - 1];
    return { tot: Math.round(b.tot * 10) / 10, settimana: b.settimana, globale: b.globale, scheda: sch, delta: a !== b ? (b.tot - a.tot) / a.tot : 0 };
  })();

  // ---- tonnellaggio: ultima settimana completa e precedente completa della stessa scheda
  const tonnKpi = (() => {
    const full = settimane.filter((s) => s.completa && s.tonn > 0).sort((a, b) => a.globale - b.globale);
    const l = full[full.length - 1];
    if (!l) return null;
    const p = full.filter((s) => s.scheda === l.scheda && s.globale < l.globale).pop();
    return { tonn: l.tonn, globale: l.globale, settimana: l.settimana, scheda: l.scheda, delta: p ? (l.tonn - p.tonn) / p.tonn : null };
  })();

  // ---- gruppi muscolari: tonnellaggio per scheda, settimana completa e gruppo; sintesi prima/ultima settimana completa
  const gruppiSett = (schId) => {
    const acc = new Map();
    for (const c of carichi) {
      if (c.scheda !== schId || !c.gruppo || !isFull(c.scheda, c.settimana)) continue;
      const k = `${c.settimana}|${c.gruppo}`;
      acc.set(k, (acc.get(k) || 0) + c.tonn);
    }
    return [...acc].map(([k, v]) => { const [w, g] = k.split('|'); return { settimana: +w, gruppo: g, tonn: Math.round(v) }; });
  };
  const gruppiSintesi = (schId) => {
    const sch = DATA.schede.find((s) => s.id === schId);
    const fullW = settimane.filter((s) => s.scheda === schId && s.completa).map((s) => s.settimana);
    const first = fullW.length ? Math.min(...fullW) : null, last = fullW.length ? Math.max(...fullW) : null;
    const out = new Map();
    for (const ex of sch.esercizi) {
      if (!ex.gruppo) continue;
      const g = out.get(ex.gruppo) || { gruppo: ex.gruppo, esercizi: 0, serie: 0, prima: 0, ultima: 0 };
      g.esercizi++; g.serie += ex.serie;
      out.set(ex.gruppo, g);
    }
    for (const c of carichi) {
      if (c.scheda !== schId || !c.gruppo) continue;
      const g = out.get(c.gruppo); if (!g) continue;
      if (c.settimana === first) g.prima += c.tonn;
      if (c.settimana === last) g.ultima += c.tonn;
    }
    return { first, last, rows: [...out.values()].map((g) => ({ ...g, prima: Math.round(g.prima), ultima: Math.round(g.ultima),
      variazione: first !== last && g.prima ? (g.ultima - g.prima) / g.prima : null })) };
  };

  // ---- composizione corporea
  // misure del diario + quelle inserite nell'app (stessa data: vince l'app)
  const mApp = (S.misure || []).map((m) => {
    const o = { ...m, fonte: 'app' };
    if (m.peso != null && m.grasso_pct != null) { o.massa_grassa = Math.round(m.peso * m.grasso_pct) / 100; o.massa_magra = Math.round((m.peso - m.peso * m.grasso_pct / 100) * 100) / 100; }
    return o;
  });
  // stessa data nel diario e nell'app: si uniscono i campi, l'app vince su quelli inseriti
  const byDate = new Map((DATA.misure || []).map((m) => [m.data, { ...m, fonte: 'diario' }]));
  for (const m of mApp) {
    const d = byDate.get(m.data);
    const o = d ? { ...d } : { ...m };
    if (d) for (const [k, v] of Object.entries(m)) if (v != null) o[k] = v;
    if (o.peso != null && o.grasso_pct != null) { o.massa_grassa = Math.round(o.peso * o.grasso_pct) / 100; o.massa_magra = Math.round((o.peso - o.peso * o.grasso_pct / 100) * 100) / 100; }
    byDate.set(m.data, o);
  }
  const misure = [...byDate.values()]
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  const delta = (k) => { const L = misure.filter((m) => m[k] != null); return L.length >= 2 ? L[L.length - 1][k] - L[0][k] : null; };
  const composizione = misure.length >= 2 ? { peso: delta('peso'), magra: delta('massa_magra'), grassa: delta('massa_grassa'), vita: delta('vita'), braccio: delta('braccio'), muscolare: delta('massa_muscolare'), dal: misure[0].data, al: misure[misure.length - 1].data } : null;

  const pw = pesoSett;
  const kpiPeso = pw.length ? { peso: pw[pw.length - 1].peso, globale: pw[pw.length - 1].globale, delta: pw.length > 1 ? pw[pw.length - 1].peso - pw[pw.length - 2].peso : null } : null;

  return { gw, monday, pesate, tendenza, carichi, settimane, sett, pesoSett, massimali, forza, tonnKpi, gruppiSett, gruppiSintesi,
    misure, composizione, kpiPeso, isFull };
}
