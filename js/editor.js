// Creazione e modifica delle schede, direttamente sul telefono.
// Le schede vivono in S.diario.schede (come quelle importate dal backup del diario):
// gli esercizi che restano conservano il loro storico dei carichi.
import { LIB, MUSCLES } from './exercises.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LETTERS = 'ABCDEFGHIJ'.split('');
const RECUPERI = ['30″', '45″', '60″', '75″', '90″', '2′', '2′30″', '3′', '4′'];
export const TIPI_CARICO = [
  ['barbell', 'Bilanciere'], ['machine', 'Macchina o cavi'], ['sum', 'Due manubri (somma)'], ['single', 'Un manubrio'],
  ['plate', 'Disco'], ['bw', 'Corpo libero + zavorra'], ['free', 'Altro'],
];
// gruppo muscolare per i grafici dello Storico, dal muscolo principale
const GRUPPO = {
  petto: 'Petto', dorso: 'Dorso', trapezi: 'Dorso', lombari: 'Catena posteriore', femorali: 'Catena posteriore',
  deltoidi: 'Spalle', 'deltoidi-ant': 'Spalle', 'deltoidi-post': 'Spalle', bicipiti: 'Bicipiti', avambracci: 'Bicipiti',
  tricipiti: 'Tricipiti', glutei: 'Glutei', abduttori: 'Glutei', quadricipiti: 'Quadricipiti',
};
const clean = (s) => String(s || '').replace(/\s+-\s+|\s+\/\s+/g, ' ').trim();

export function guessLoad(title) {
  const t = title.toLowerCase();
  if (/zavorr|trazion|dip\b|parallele/.test(t)) return 'bw';
  if (/un manubrio|manubrio su panca|singol/.test(t)) return 'single';
  if (/manubri/.test(t)) return 'sum';
  if (/bilanciere|\bez\b|stacco|squat|military|pendlay/.test(t)) return 'barbell';
  if (/disco/.test(t)) return 'plate';
  return 'machine';
}

// catalogo per la scelta: movimenti disegnati + esercizi creati sul telefono
export function catalog(S) {
  const out = Object.entries(LIB).map(([k, L]) => ({ key: k, title: L.title, primary: L.primary, secondary: L.secondary, custom: false }));
  for (const [k, c] of Object.entries(S.customEx || {})) out.push({ key: k, title: c.title, primary: c.primary, secondary: c.secondary || [], custom: true });
  return out.sort((a, b) => a.title.localeCompare(b.title, 'it'));
}
const catItem = (S, key) => catalog(S).find((c) => c.key === key);

// ---------------------------------------------------------------- bozza <-> scheda
const mondayOf = (iso) => { const d = new Date(iso + 'T12:00:00Z'); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10); };
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const rangeTxt = (e) => (e.range ? (e.range[0] === e.range[1] ? `${e.range[0]}` : `${e.range[0]}-${e.range[1]}`) : `${e.reps ?? ''}`);

function toDraft(sch, S, dayName, ssLinks) {
  const giorni = [...new Set([...(sch.giorni || []), ...sch.esercizi.map((e) => e.giorno)])];
  return {
    id: sch.id, titolo: sch.nome.split(' - ')[0], inizio: sch.inizio, settimane: sch.fine ? Math.max(1, Math.round((Date.parse(sch.fine) - Date.parse(sch.inizio)) / 6048e5)) : sch.settimane.length || 8,
    giorni: giorni.map((g) => {
      const exs = sch.esercizi.filter((e) => e.giorno === g);
      const links = ssLinks(sch.id, g, exs);
      return {
        g, nome: dayName(sch, g),
        esercizi: exs.map((e) => ({ id: e.id, nome: e.nome, key: e.illustrazione, serie: e.serie, reps: rangeTxt(e), recupero: e.recupero || '', tipoCarico: e.tipoCarico || 'machine', ss: links.has(e.id) })),
      };
    }),
  };
}
function newDraft(today) {
  return { id: null, titolo: 'Nuova scheda', inizio: mondayOf(today), settimane: 8, giorni: [{ g: 'A', nome: 'Giorno A', esercizi: [] }] };
}

function parseReps(t) {
  const m = String(t).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) { const a = Math.min(+m[1], +m[2]), b = Math.max(+m[1], +m[2]); return { range: [a, b], reps: Math.round((a + b) / 2) }; }
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n > 0 ? { range: [n, n], reps: n } : null;
}

function fromDraft(d, old, S) {
  const id = d.id ?? Math.max(0, ...(S.diario?.schede || []).map((s) => +s.id || 0)) + 1;
  const start = mondayOf(d.inizio);
  // le colonne del diario possono andare oltre la fine della scheda: si tengono se l'inizio non cambia
  const nCol = old && old.inizio === start ? Math.max(d.settimane, (old.settimane || []).length) : d.settimane;
  const settimane = Array.from({ length: nCol }, (_, i) => addDays(start, i * 7));
  const oldEx = new Map((old?.esercizi || []).map((e) => [e.id, e]));
  const esercizi = [];
  let n = 0;
  for (const day of d.giorni) {
    for (const x of day.esercizi) {
      const pr = parseReps(x.reps) || { range: [10, 10], reps: 10 };
      const cat = catItem(S, x.key);
      const prev = oldEx.get(x.id);
      esercizi.push({
        ...(prev || { storico: [], riferimento: null, note: '' }),
        id: x.id || `u${Date.now().toString(36)}${n++}`, giorno: day.g, nome: String(x.nome || '').replace(/\s+/g, ' ').trim() || (cat ? cat.title : 'Esercizio'),
        illustrazione: x.key, serie: Math.max(1, Math.min(10, +x.serie || 3)),
        // ripetizioni di riferimento del diario: si tengono se il range non cambia
        reps: prev && prev.range && pr.range.join() === prev.range.join() ? prev.reps : pr.reps, range: pr.range,
        recupero: x.recupero || null, tipoCarico: x.tipoCarico || 'machine',
        gruppo: prev?.gruppo ?? (cat ? GRUPPO[cat.primary[0]] || null : null),
        note: prev ? (prev.note || '').replace(/Rec\.[^.]*\.\s*/, x.recupero ? `Rec. ${x.recupero}. ` : '') : '',
      });
    }
  }
  const titolo = clean(d.titolo) || `Scheda ${id}`;
  return {
    ...(old || {}),
    id, nome: `${titolo} - ${d.giorni.map((x) => clean(x.nome) || `Giorno ${x.g}`).join(' / ')}`,
    inizio: start, fine: old && old.inizio === start && old.fine && Math.round((Date.parse(old.fine) - Date.parse(start)) / 6048e5) === d.settimane ? old.fine : addDays(start, d.settimane * 7 - 1),
    giorni: d.giorni.map((x) => x.g), settimane,
    seduteSvolte: Array.from({ length: nCol }, (_, i) => (old?.seduteSvolte || [])[i] || []),
    esercizi,
  };
}

// ---------------------------------------------------------------- pagine
let draft = null, draftOld = null, picker = null;

export function renderSchedeList(ctx) {
  const { DATA, S, $app, setTop, setTab, dShort, todayISO, schedaFor } = ctx;
  setTop('Le tue schede', 'Crea una scheda nuova o modifica quelle esistenti', '#/');
  setTab('home');
  const cur = DATA.schede.length ? schedaFor(todayISO()) : null;
  let h = `<a class="btn primary block" href="#/scheda/nuova" style="margin-bottom:14px">+ Nuova scheda</a>`;
  if (!DATA.schede.length) h += `<div class="card empty">Nessuna scheda ancora. Creane una: scegli le giornate, gli esercizi dalla lista, serie, ripetizioni e recupero.</div>`;
  for (const s of DATA.schede.slice().reverse()) {
    const n = s.esercizi.length;
    const stato = cur && s.id === cur.id ? 'In corso' : s.inizio > todayISO() ? 'Da iniziare' : 'Passata';
    h += `<a class="card sch-item" href="#/scheda/${s.id}"><div class="grow"><b>${esc(s.nome.split(' - ')[0])}</b><div class="muted">${esc(s.nome.split(' - ')[1] || '')}</div>
      <div class="muted small">Dal ${dShort(s.inizio)} al ${dShort(s.fine)} · ${s.giorni.length} giornate · ${n} esercizi</div></div><span class="badge ${stato === 'In corso' ? 'on' : ''}">${stato}</span></a>`;
  }
  $app.innerHTML = h;
}

export function renderSchedaEdit(id, ctx) {
  const { DATA, S, $app, setTop, setTab, todayISO, dayName, ssLinks, toast } = ctx;
  const key = id === 'nuova' ? 'nuova' : +id;
  if (!draft || draft._for !== key) {
    picker = null;
    if (key === 'nuova') { draft = newDraft(todayISO()); draftOld = null; }
    else {
      const sch = DATA.schede.find((s) => s.id === key);
      if (!sch) { location.hash = '#/schede'; return; }
      draft = toDraft(sch, S, dayName, ssLinks); draftOld = sch;
    }
    draft._for = key;
  }
  setTop(key === 'nuova' ? 'Nuova scheda' : `Modifica scheda ${key}`, 'Le modifiche valgono quando premi Salva', '#/schede');
  setTab('home');
  if (picker) return renderPicker(ctx);

  const d = draft;
  let h = `<div class="card settings">
    <label>Nome<input id="sTit" value="${esc(d.titolo)}" maxlength="60"></label>
    <label>Inizio (lunedì)<input type="date" id="sIni" value="${d.inizio}"></label>
    <label>Settimane<input type="number" id="sSet" min="1" max="26" inputmode="numeric" value="${d.settimane}"></label></div>`;
  d.giorni.forEach((day, gi) => {
    h += `<div class="section-title row" style="align-items:center"><span class="grow">Giornata ${day.g}</span>${d.giorni.length > 1 ? `<button class="btn small ghost" data-delday="${gi}">Elimina giornata</button>` : ''}</div>
      <div class="card ed-day"><label class="ed-name">Nome<input data-dname="${gi}" value="${esc(day.nome)}" maxlength="40"></label>`;
    if (!day.esercizi.length) h += `<div class="muted small" style="padding:6px 0">Nessun esercizio: aggiungine uno dalla lista.</div>`;
    day.esercizi.forEach((x, xi) => {
      const cat = catItem(S, x.key);
      h += `<div class="ed-ex${x.ss ? ' ss' : ''}" data-g="${gi}" data-x="${xi}">
        <div class="row"><b class="grow">${xi + 1}. <input class="ed-nome" data-f="nome" value="${esc(x.nome)}" aria-label="Nome dell'esercizio"></b>
          <button class="ic" data-a="up" aria-label="Sposta su" ${xi === 0 ? 'disabled' : ''}>↑</button><button class="ic" data-a="down" aria-label="Sposta giù" ${xi === day.esercizi.length - 1 ? 'disabled' : ''}>↓</button><button class="ic" data-a="del" aria-label="Togli">✕</button></div>
        <div class="muted small">${cat ? esc(cat.primary.map((m) => MUSCLES[m]).join(', ')) + (cat.custom ? ' · creato da te' : '') : ''}</div>
        <div class="ed-grid">
          <label>Serie<input type="number" min="1" max="10" inputmode="numeric" data-f="serie" value="${x.serie}"></label>
          <label>Ripetizioni<input data-f="reps" value="${esc(x.reps)}" placeholder="8-10" inputmode="text"></label>
          <label>Recupero<select data-f="recupero"><option value="">—</option>${[...new Set([...RECUPERI, x.recupero].filter(Boolean))].map((r) => `<option ${r === x.recupero ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
          <label>Carico<select data-f="tipoCarico">${TIPI_CARICO.map(([v, l]) => `<option value="${v}" ${v === x.tipoCarico ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div></div>`;
      if (xi < day.esercizi.length - 1) h += `<button class="ss-link${x.ss ? ' on' : ''}" data-ss="${gi}:${xi}" aria-pressed="${x.ss}">${x.ss ? '⛓ In superserie · tocca per separare' : '+ Superserie con il successivo'}</button>`;
    });
    h += `<button class="btn block" data-add="${gi}" style="margin-top:10px">+ Aggiungi esercizio</button></div>`;
  });
  if (d.giorni.length < LETTERS.length) h += `<button class="btn ghost block" id="addDay" style="margin-top:12px">+ Aggiungi giornata</button>`;
  h += `<div class="sticky-cta" style="display:grid;gap:8px"><button class="btn primary block" id="sSave">Salva la scheda</button></div>`;
  if (draftOld) h += `<button class="btn ghost block" id="sDel" style="margin-top:18px;color:var(--accent)">Elimina questa scheda</button>`;
  $app.innerHTML = h;

  // eventi
  const num = (v, lo, hi, dflt) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; };
  document.getElementById('sTit').oninput = (ev) => { d.titolo = ev.target.value; };
  document.getElementById('sIni').onchange = (ev) => { if (ev.target.value) d.inizio = ev.target.value; };
  document.getElementById('sSet').onchange = (ev) => { d.settimane = num(ev.target.value, 1, 26, d.settimane); ev.target.value = d.settimane; };
  $app.querySelectorAll('[data-dname]').forEach((i) => { i.oninput = () => { d.giorni[+i.dataset.dname].nome = i.value; }; });
  $app.querySelectorAll('.ed-ex').forEach((row) => {
    const x = d.giorni[+row.dataset.g].esercizi[+row.dataset.x];
    row.querySelectorAll('[data-f]').forEach((i) => {
      i.onchange = i.oninput = () => { const f = i.dataset.f; x[f] = f === 'serie' ? num(i.value, 1, 10, x.serie) : i.value; };
    });
    row.querySelectorAll('[data-a]').forEach((b) => {
      b.onclick = () => {
        const list = d.giorni[+row.dataset.g].esercizi, k = +row.dataset.x;
        if (b.dataset.a === 'del') list.splice(k, 1);
        // spostando un esercizio i legami di superserie restano sulle posizioni
        const swap = (i, j) => { [list[i], list[j]] = [list[j], list[i]]; [list[i].ss, list[j].ss] = [list[j].ss, list[i].ss]; };
        if (b.dataset.a === 'up' && k > 0) swap(k - 1, k);
        if (b.dataset.a === 'down' && k < list.length - 1) swap(k, k + 1);
        if (list.length) list[list.length - 1].ss = false;
        renderSchedaEdit(id, ctx);
      };
    });
  });
  $app.querySelectorAll('[data-ss]').forEach((b) => { b.onclick = () => { const [gi, xi] = b.dataset.ss.split(':').map(Number); const x = d.giorni[gi].esercizi[xi]; x.ss = !x.ss; renderSchedaEdit(id, ctx); }; });
  $app.querySelectorAll('[data-add]').forEach((b) => { b.onclick = () => { picker = { gi: +b.dataset.add, q: '', create: false }; renderSchedaEdit(id, ctx); window.scrollTo(0, 0); }; });
  $app.querySelectorAll('[data-delday]').forEach((b) => { b.onclick = () => { const gi = +b.dataset.delday; if (d.giorni[gi].esercizi.length && !confirm(`Eliminare la giornata ${d.giorni[gi].g} con i suoi esercizi?`)) return; d.giorni.splice(gi, 1); renderSchedaEdit(id, ctx); }; });
  const ad = document.getElementById('addDay');
  if (ad) ad.onclick = () => { const g = LETTERS.find((l) => !d.giorni.some((x) => x.g === l)); d.giorni.push({ g, nome: `Giorno ${g}`, esercizi: [] }); renderSchedaEdit(id, ctx); };
  document.getElementById('sSave').onclick = () => {
    if (!d.giorni.some((x) => x.esercizi.length)) { toast('Aggiungi almeno un esercizio'); return; }
    const bad = d.giorni.flatMap((x) => x.esercizi).find((x) => !parseReps(x.reps));
    if (bad) { toast(`Ripetizioni non valide per ${bad.nome}: scrivi ad esempio 10 o 8-10`); return; }
    if (draftOld && mondayOf(d.inizio) !== draftOld.inizio && (draftOld.esercizi.some((e) => e.storico.length) || (S.sessions || []).some((s) => s.scheda === draftOld.id))
      && !confirm('Cambiando la data di inizio, le settimane già registrate si spostano con la nuova data. Continuare?')) return;
    const sch = fromDraft(d, draftOld, S);
    const schede = (S.diario?.schede || []).filter((s) => s.id !== sch.id);
    schede.push(sch); schede.sort((a, b) => (a.inizio < b.inizio ? -1 : a.inizio > b.inizio ? 1 : a.id - b.id));
    S.diario = { ...(S.diario || { generato: null, pesate: [], misure: [], contesto: {}, piani: [] }), schede, modificato: new Date().toISOString() };
    // superserie: legami salvati per giornata
    const ss = { ...(S.settings.superserie || {}) };
    for (const day of d.giorni) {
      const ids = sch.esercizi.filter((e) => e.giorno === day.g);
      ss[`${sch.id}-${day.g}`] = day.esercizi.map((x, i) => (x.ss && ids[i + 1] ? ids[i].id : null)).filter(Boolean);
    }
    S.settings.superserie = ss;
    ctx.save(); draft = null; toast(`Scheda «${clean(d.titolo)}» salvata`); location.hash = '#/schede';
  };
  const del = document.getElementById('sDel');
  if (del) del.onclick = () => {
    if (!confirm('Eliminare questa scheda? Gli allenamenti già registrati restano nello storico, ma senza scheda non si possono più aprire.')) return;
    S.diario.schede = S.diario.schede.filter((s) => s.id !== draftOld.id); S.diario.modificato = new Date().toISOString();
    const cur = S.current && (S.sessions || []).find((s) => s.id === S.current);
    if (cur && cur.scheda === draftOld.id) { cur.chiusa = true; S.current = null; }
    ctx.save(); draft = null; location.hash = '#/schede';
  };
}

function renderPicker(ctx) {
  const { S, $app, toast } = ctx;
  const day = draft.giorni[picker.gi];
  if (picker.create) {
    const opts = Object.entries(MUSCLES);
    $app.innerHTML = `<div class="card settings"><div style="font-size:15px"><b>Nuovo esercizio</b> per la giornata ${day.g}</div>
      <label>Nome<input id="cNome" value="${esc(picker.q)}" maxlength="50" placeholder="es. Pressa 45°"></label>
      <div class="small muted">Muscoli principali</div><div class="chips pick" id="cPri">${opts.map(([k, l]) => `<button data-m="${k}">${esc(l)}</button>`).join('')}</div>
      <div class="small muted">Muscoli secondari (facoltativi)</div><div class="chips pick" id="cSec">${opts.map(([k, l]) => `<button data-m="${k}">${esc(l)}</button>`).join('')}</div>
      <label>Carico<select id="cLoad">${TIPI_CARICO.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <button class="btn primary block" id="cSave">Crea e aggiungi</button><button class="btn ghost block" id="cBack">Indietro</button></div>`;
    const toggle = (box) => box.addEventListener('click', (ev) => { const b = ev.target.closest('[data-m]'); if (b) b.classList.toggle('on'); });
    toggle(document.getElementById('cPri')); toggle(document.getElementById('cSec'));
    document.getElementById('cNome').oninput = (ev) => { document.getElementById('cLoad').value = guessLoad(ev.target.value); };
    document.getElementById('cLoad').value = guessLoad(picker.q);
    document.getElementById('cBack').onclick = () => { picker.create = false; ctx.rerender(); };
    document.getElementById('cSave').onclick = () => {
      const nome = clean(document.getElementById('cNome').value);
      const pri = [...document.querySelectorAll('#cPri .on')].map((b) => b.dataset.m);
      const sec = [...document.querySelectorAll('#cSec .on')].map((b) => b.dataset.m).filter((m) => !pri.includes(m));
      if (!nome) { toast('Scrivi il nome dell\'esercizio'); return; }
      if (!pri.length) { toast('Scegli almeno un muscolo principale'); return; }
      const key = 'c_' + nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now().toString(36).slice(-4);
      S.customEx = { ...(S.customEx || {}), [key]: { title: nome, primary: pri, secondary: sec } };
      ctx.save();
      day.esercizi.push({ id: null, nome, key, serie: 3, reps: '8-10', recupero: '90″', tipoCarico: document.getElementById('cLoad').value, ss: false });
      picker = null; toast(`«${nome}» creato e aggiunto`); ctx.rerender();
    };
    return;
  }
  const list = catalog(S);
  const draw = () => {
    const q = picker.q.trim().toLowerCase();
    const f = list.filter((c) => !q || c.title.toLowerCase().includes(q) || c.primary.some((m) => MUSCLES[m].toLowerCase().includes(q)));
    document.getElementById('pList').innerHTML = f.map((c) => `<button class="card pick-item" data-k="${c.key}"><b>${esc(c.title)}</b><span class="muted small">${esc(c.primary.map((m) => MUSCLES[m]).join(', '))}${c.custom ? ' · creato da te' : ''}</span></button>`).join('') ||
      `<div class="card empty">Nessun esercizio con «${esc(picker.q)}».</div>`;
  };
  $app.innerHTML = `<div class="row" style="gap:8px;margin-bottom:10px"><button class="btn ghost" id="pBack">← Indietro</button><span class="muted grow">Giornata ${day.g}: scegli un esercizio</span></div>
    <input class="search" id="pq" type="search" placeholder="Cerca per nome o muscolo" value="${esc(picker.q)}">
    <button class="btn block" id="pNew" style="margin:10px 0">+ Non c'è? Crea un esercizio nuovo</button>
    <div id="pList" class="pick-list"></div>`;
  draw();
  document.getElementById('pq').oninput = (ev) => { picker.q = ev.target.value; draw(); };
  document.getElementById('pBack').onclick = () => { picker = null; ctx.rerender(); };
  document.getElementById('pNew').onclick = () => { picker.create = true; ctx.rerender(); };
  document.getElementById('pList').onclick = (ev) => {
    const b = ev.target.closest('[data-k]'); if (!b) return;
    const c = list.find((x) => x.key === b.dataset.k);
    day.esercizi.push({ id: null, nome: c.title, key: c.key, serie: 3, reps: '8-10', recupero: '90″', tipoCarico: guessLoad(c.title), ss: false });
    picker = null; toast(`${c.title} aggiunto alla giornata ${day.g}`); ctx.rerender();
  };
}
