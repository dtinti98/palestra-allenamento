import { figureSVG3 as figureSVG, pairSVG3 } from './figure3.js';
import { LIB, MUSCLES } from './exercises.js';
import { bodyMapSVG } from './bodymap.js';
import { makeStats } from './stats.js';
import { renderSchedeList, renderSchedaEdit, catalog, guessLoad } from './editor.js';
import { lineChart, barChart, pairBars, initTips } from './charts.js';

// ---------------------------------------------------------------- stato
const KEY = 'palestra.v1';
const $app = document.getElementById('app');
const EMPTY_DIARIO = { generato: null, pesate: [], misure: [], contesto: {}, piani: [], schede: [] };
let DATA = null;
const setData = () => { DATA = { ...EMPTY_DIARIO, ...(S.diario || {}) }; };
const hasScheda = () => DATA.schede.length > 0;
let S = loadState();

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && Array.isArray(s.sessions)) return { settings: {}, pesate: [], misure: [], ...s };
  } catch (e) { /* storage non disponibile */ }
  return { sessions: [], pesate: [], misure: [], exported: [], current: null, settings: {} };
}
function save() {
  setData();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Impossibile salvare sul dispositivo'); }
}

// ---------------------------------------------------------------- utilità
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 2) => (n == null || n === '' || Number.isNaN(+n) ? '–' : (+n).toLocaleString('it-IT', { maximumFractionDigits: d }));
const parseNum = (v) => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const dShort = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '');
const dLong = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) : '');
const STEP = { sum: 2, single: 1, barbell: 2.5, machine: 5, plate: 2.5, bw: 1.25, free: 1 };
const LOAD_LABEL = { sum: 'kg (somma manubri)', single: 'kg (un manubrio)', barbell: 'kg', machine: 'kg', plate: 'kg (disco)', bw: 'zavorra kg', free: 'kg' };

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

function restSeconds(txt, range) {
  if (txt) {
    const m = txt.match(/(\d+)\s*′(?:\s*(\d+)\s*″)?/);
    if (m) return +m[1] * 60 + (m[2] ? +m[2] : 0);
    const s = txt.match(/(\d+)\s*″/);
    if (s) return +s[1];
  }
  if (range && range[1] <= 6) return 180;
  if (range && range[1] <= 10) return 120;
  return 90;
}

// ---------------------------------------------------------------- dati
function schedaFor(dateISO) {
  const list = DATA.schede.filter((s) => s.inizio && s.inizio <= dateISO);
  return list.length ? list[list.length - 1] : DATA.schede[DATA.schede.length - 1];
}
function weekFor(scheda, dateISO) {
  let w = 1;
  scheda.settimane.forEach((d, i) => { if (d && d <= dateISO) w = i + 1; });
  return w;
}
function dayName(scheda, g) {
  const parts = (scheda.nome.split(' - ')[1] || '').split(' / ');
  const i = scheda.giorni.indexOf(g);
  return parts.length === scheda.giorni.length ? parts[i] : `Giorno ${g}`;
}
// scheda di una sessione: quella vera, o una scheda virtuale con gli esercizi dell'allenamento libero
function sessSch(sess) {
  if (!sess) return null;
  if (sess.libero) return { id: 'L' + sess.id, nome: `${sess.titolo || 'Allenamento libero'} - Libero`, giorni: ['L'], settimane: [], seduteSvolte: [], esercizi: sess.lista || [] };
  return DATA.schede.find((s) => s.id === sess.scheda) || null;
}
const sessLabel = (sess) => (sess.libero ? 'allenamento libero' : `giorno ${sess.giorno}`);
const exById = (id) => { for (const s of DATA.schede) for (const e of s.esercizi) if (e.id === id) return { ex: e, scheda: s }; return null; };
const libFor = (ex) => LIB[ex.illustrazione] || null;
const customFor = (ex) => (S.customEx || {})[ex.illustrazione] || null;
const musclesFor = (ex) => libFor(ex) || customFor(ex) || { primary: [], secondary: [] };
// miniatura: disegno del movimento, o mappa dei muscoli per gli esercizi creati sul telefono
function thumbHTML(ex, label) {
  const lib = libFor(ex); if (lib) return figureSVG(lib, 1, { ghost: true, label: label || lib.title });
  const c = customFor(ex); return c ? bodyMapSVG(c.primary, c.secondary || []) : '';
}

function bodyweight(dateISO) {
  const all = [...DATA.pesate, ...(S.pesate || [])].filter((x) => x.data <= (dateISO || '9999')).sort((a, b) => (a.data < b.data ? -1 : 1));
  if (!all.length) return 64;
  // come nel diario: media delle pesate della settimana (da lunedì); se non ce ne sono, le ultime 4
  const d = new Date((dateISO || todayISO()) + 'T12:00:00Z');
  const mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
  const week = all.filter((x) => x.data >= mon);
  const use = week.length ? week : all.slice(-4);
  return Math.round((use.reduce((a, b) => a + b.peso, 0) / use.length) * 100) / 100;
}

function sessionEntry(sess, ex) {
  const r = sess.esercizi[ex.id];
  if (!r || r.saltato) return null;
  const done = r.serie.filter((x) => x.fatto && x.carico != null);
  if (!done.length) return null;
  const reps = done.map((x) => x.reps ?? ex.reps);
  const loads = done.map((x) => x.carico);
  const top = Math.max(...loads);
  return {
    settimana: sess.settimana, data: sess.data, carico: top, reps: Math.round((reps.reduce((a, b) => a + b, 0) / reps.length) * 100) / 100,
    serie: done, fonte: 'app', sessione: sess.id,
  };
}

// storico di un esercizio: diario + allenamenti registrati nell'app (l'app prevale sulla stessa settimana)
function history(ex, { exclude } = {}) {
  if (ex.libero) return historyMov(ex.illustrazione, exclude);
  const out = new Map();
  for (const h of ex.storico) out.set(h.settimana, { ...h, fonte: 'diario' });
  for (const s of S.sessions) {
    if (s.id === exclude) continue;
    const e = sessionEntry(s, ex);
    if (e) out.set(e.settimana, e);
  }
  return [...out.values()].sort((a, b) => a.settimana - b.settimana);
}

// tutte le volte di un movimento: schede (diario + app) e allenamenti liberi, in ordine di data
function historyMov(key, exclude) {
  const out = [];
  for (const sch of DATA.schede) for (const e of sch.esercizi) if (e.illustrazione === key) for (const h of history(e, { exclude })) out.push({ ...h, dove: `S${sch.id}` });
  for (const s of S.sessions) {
    if (!s.libero || s.id === exclude) continue;
    for (const x of s.lista || []) if (x.illustrazione === key) { const e = sessionEntry(s, x); if (e) out.push({ ...e, settimana: null, dove: 'Libero' }); }
  }
  return out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

function doneDays(scheda, week) {
  const set = new Set(scheda.seduteSvolte[week - 1] || []);
  for (const s of S.sessions) if (s.scheda === scheda.id && s.settimana === week && s.chiusa) set.add(s.giorno);
  return set;
}

// ripetizioni serie per serie (8/8/8). Il diario ha solo la media: se è intera le serie sono quelle,
// altrimenti si ricostruiscono dal totale (≈), con le serie più alte all'inizio.
function repsText(h, nSerie) {
  if (h.serie) return h.serie.map((x) => fmt(x.reps)).join('/');
  const n = nSerie || 0, r = h.reps;
  if (!n || r == null) return `${fmt(r ?? '')}`;
  const tot = Math.round(r * n);
  if (Math.abs(tot - r * n) > 0.05) return `${fmt(r)} di media`;
  const base = Math.floor(tot / n), extra = tot - base * n;
  const sets = Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
  return (extra ? '≈ ' : '') + sets.join('/');
}
function loadText(ex, h) {
  if (ex.tipoCarico === 'bw') {
    const bw = h.pesoCorporeo ?? h.serie?.[0]?.pesoCorporeo;
    const z = bw != null ? Math.round((h.carico - bw) * 4) / 4 : null;
    return z != null ? `${z > 0 ? '+' + fmt(z) : 'corpo libero'} (${fmt(h.carico)} kg)` : `${fmt(h.carico)} kg`;
  }
  return `${fmt(h.carico)} kg`;
}
function lastLine(ex, exclude) {
  const h = history(ex, { exclude });
  const l = h[h.length - 1];
  return l ? `Sett. ${l.settimana}: ${loadText(ex, l)} × ${repsText(l, ex.serie)}` : 'Nessun carico registrato';
}

// doppia progressione: tutte le serie in cima al range -> segnalarlo (decide il PT di quanto salire)
function atTop(ex, h) {
  if (!h || !ex.range) return false;
  const top = ex.range[1];
  if (h.serie) return h.serie.length >= ex.serie && h.serie.every((x) => (x.reps ?? 0) >= top);
  return h.repsRegistrate && h.reps >= top;
}

// ---------------------------------------------------------------- shell
const view = { anim: null };
function setTop(title, subtitle = '', back = null) {
  document.getElementById('title').textContent = title;
  document.getElementById('subtitle').textContent = subtitle;
  const b = document.getElementById('back');
  b.hidden = !back;
  b.onclick = () => { location.hash = back; };
  document.title = `${title} · Palestra`;
}
function setTab(tab) {
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function animate(el, lib, label) {
  stopAnim();
  if (!el || !lib) return;
  let playing = false, t0 = performance.now(), last = 0;
  const btn = el.parentElement.querySelector('.play');
  const frame = (now) => {
    if (!el.isConnected) return stopAnim();
    if (playing && now - last > 50) {
      last = now;
      const p = ((now - t0) % 2800) / 2800;
      const t = (1 - Math.cos(p * Math.PI * 2)) / 2;
      el.innerHTML = figureSVG(lib, t, { label });
    }
    view.anim = requestAnimationFrame(frame);
  };
  view.anim = requestAnimationFrame(frame);
  if (btn) btn.onclick = () => {
    playing = !playing;
    if (playing) t0 = performance.now();
    btn.textContent = playing ? '❚❚ Pausa' : '▶ Movimento';
    if (!playing) el.innerHTML = figureSVG(lib, 1, { ghost: true, label });
  };
}
function stopAnim() { if (view.anim) cancelAnimationFrame(view.anim); view.anim = null; }

// ---------------------------------------------------------------- HOME
function renderWelcome() {
  setTop('Allenamento', 'Nessuna scheda caricata');
  setTab('home');
  $app.innerHTML = `<div class="card hero"><h1>Benvenuto</h1><div class="muted">Questa app ti guida negli allenamenti della tua scheda, serie per serie, e tiene lo storico sul telefono.</div></div>
    <div class="section-title">Per iniziare</div>
    <div class="card settings">
      <div style="font-size:15px"><b>Hai un backup?</b> Importalo qui: carica scheda, carichi, pesate e misure. I dati restano solo su questo telefono.</div>
      <label class="btn primary block" style="cursor:pointer;justify-content:center">Importa un backup<input type="file" id="imp" accept="application/json,.json" hidden></label>
    </div>
    <div class="card settings" style="margin-top:12px">
      <div style="font-size:15px"><b>Parti da zero?</b> Crea la tua scheda (giornate, esercizi dalla lista, serie, ripetizioni, recupero e superserie) oppure importala da un file.</div>
      <a class="btn primary block" href="#/schede">Crea o importa una scheda</a>
    </div>
    <div class="card settings" style="margin-top:12px">
      <div style="font-size:15px">Senza scheda puoi già sfogliare gli esercizi con i disegni e segnare pesate e misure.</div>
      <div style="display:grid;gap:8px"><a class="btn" href="#/esercizi">Vedi gli esercizi</a><a class="btn" href="#/storico/peso">Pesate e misure</a></div>
    </div>${freeCardHTML()}`;
  bindImport();
}

function renderHome() {
  if (!hasScheda()) return renderWelcome();
  const today = todayISO();
  const sch = schedaFor(today);
  const week = weekFor(sch, today);
  setTop('Allenamento', `Scheda ${sch.id} · settimana ${week} (dal ${dShort(sch.settimane[week - 1])})`);
  setTab('home');
  const done = doneDays(sch, week);
  const next = sch.giorni.find((g) => !done.has(g));
  const cur = S.current && S.sessions.find((s) => s.id === S.current);
  let h = '';
  if (cur) {
    const curSch = sessSch(cur);
    const exs = curSch.esercizi.filter((e) => e.giorno === cur.giorno);
    const nDone = exs.filter((e) => isExDone(cur, e)).length;
    h += `<a class="card resume" href="#/sessione"><div class="grow"><b>Allenamento in corso · ${esc(sessLabel(cur))}</b><div class="muted">${nDone} di ${exs.length} esercizi fatti${cur.libero ? '' : ` · ${esc(dayName(curSch, cur.giorno))}`}</div></div><span class="btn primary small">Riprendi</span></a>`;
  }
  {
    const dow = new Date(today + 'T12:00:00Z').getUTCDay();
    const mon = mondayOf(today), prev = addDays(mon, -7);
    const target = dow === 0 ? mon : dow === 1 ? prev : null;
    if (target && exportWeeks().includes(target) && !(S.exported || []).includes(target)) {
      h += `<a class="card resume" href="#/storico/impostazioni" style="border-color:var(--accent-2)"><div class="grow"><b>Fine settimana: esporta i dati</b><div class="muted">Settimana dal ${dShort(target)}, da caricare in chat per diario e dashboard</div></div><span class="btn small">Esporta</span></a>`;
    }
  }
  h += `<div class="card hero"><h1>${esc(sch.nome.split(' - ')[0])}</h1><div class="muted">${esc(sch.nome.split(' - ')[1] || '')}</div>
    <div class="muted">Dal ${dShort(sch.inizio)} al ${dShort(sch.fine)} · ${sch.giorni.length} giorni a settimana</div>
    <a class="btn small" href="#/schede" style="margin-top:10px;justify-self:start">Gestisci le schede</a></div>`;
  h += `<div class="section-title">Scegli la giornata</div><div class="days">`;
  for (const g of sch.giorni) {
    const n = sch.esercizi.filter((e) => e.giorno === g);
    const series = n.reduce((a, e) => a + e.serie, 0);
    const cls = done.has(g) ? 'done' : g === next ? 'next' : '';
    const badge = done.has(g) ? 'Fatto' : g === next ? 'Prossimo' : '';
    h += `<a class="card day ${cls}" href="#/giorno/${g}">${badge ? `<span class="badge">${badge}</span>` : ''}
      <span class="letter">${g}</span><span class="name">${esc(dayName(sch, g))}</span>
      <span class="meta">${n.length} esercizi · ${series} serie</span></a>`;
  }
  h += `</div>`;
  h += freeCardHTML();
  if (DATA.generato) h += `<p class="muted" style="font-size:13px;margin-top:18px">Carichi del diario aggiornati al ${esc(DATA.generato.slice(0, 10).split('-').reverse().join('/'))}. Gli allenamenti che registri qui restano salvati su questo dispositivo.</p>`;
  $app.innerHTML = h;
}

// ---------------------------------------------------------------- ANTEPRIMA GIORNATA
function renderDay(g) {
  if (!hasScheda()) { location.hash = '#/'; return; }
  const today = todayISO();
  const sch = schedaFor(today);
  const week = weekFor(sch, today);
  const exs = sch.esercizi.filter((e) => e.giorno === g);
  if (!exs.length) { location.hash = '#/'; return; }
  const cur = S.current && S.sessions.find((s) => s.id === S.current);
  // la giornata già iniziata si riapre e basta
  if (cur && !cur.libero && cur.scheda === sch.id && cur.giorno === g) { location.hash = '#/sessione'; return; }
  setTop(`Giorno ${g} · ${dayName(sch, g)}`, `${exs.length} esercizi`, '#/');
  setTab('home');
  const links = ssLinks(sch.id, g, exs);
  let h = cur ? switchBannerHTML(cur, `il giorno ${g}`) : '';
  h += `<div class="ex-list">`;
  exs.forEach((e, i) => {
    const lib = libFor(e);
    if (i > 0) {
      const on = links.has(exs[i - 1].id);
      h += `<button class="ss-link${on ? ' on' : ''}" data-ss="${i - 1}" aria-pressed="${on}">${on ? '⛓ In superserie · tocca per separare' : '+ Superserie con il precedente'}</button>`;
    }
    h += `<a class="card ex-item${links.has(e.id) || (i > 0 && links.has(exs[i - 1].id)) ? ' in-ss' : ''}" href="#/esercizio/${esc(e.illustrazione)}?from=${encodeURIComponent(e.id)}">
      <div class="thumb paper">${thumbHTML(e)}</div>
      <div class="grow"><h3>${i + 1}. ${esc(e.nome)}</h3>
      <div class="sub">${e.serie} × ${e.range ? (e.range[0] === e.range[1] ? e.range[0] : e.range.join('–')) : e.reps} · rec. ${esc(e.recupero || fmtRest(restSeconds(null, e.range)))}</div>
      <div class="last">${esc(lastLine(e))}</div></div></a>`;
  });
  h += `</div>`;
  const opts = sch.settimane.map((d, i) => d ? `<option value="${i + 1}" ${i + 1 === week ? 'selected' : ''}>Settimana ${i + 1} (dal ${dShort(d)})</option>` : '').join('');
  h += `<div class="card settings" style="margin-top:14px"><label>Registra nella <select id="week">${opts}</select></label></div>`;
  h += `<div class="sticky-cta"><button class="btn primary block" id="start">Inizia allenamento · giorno ${g}</button></div>`;
  $app.innerHTML = h;
  document.getElementById('start').onclick = () => startSession(sch, g, +document.getElementById('week').value);
  bindSwitchBanner(() => startSession(sch, g, +document.getElementById('week').value));
  $app.querySelectorAll('[data-ss]').forEach((b) => { b.onclick = () => { const k = +b.dataset.ss; setSsLink(sch.id, g, exs, exs[k].id, !links.has(exs[k].id)); route(); }; });
}
// Superserie: per ogni scheda e giornata, gli id degli esercizi legati al successivo.
// Se Danilo non ha mai scelto, valgono gli esercizi che nel diario hanno «superset» nel nome.
const ssKey = (schId, g) => `${schId}-${g}`;
function ssLinks(schId, g, exs) {
  const saved = S.settings.superserie && S.settings.superserie[ssKey(schId, g)];
  if (saved) return new Set(saved);
  const out = new Set();
  exs.forEach((e, i) => { if (exs[i + 1] && /superset/i.test(e.nome) && /superset/i.test(exs[i + 1].nome)) out.add(e.id); });
  return out;
}
function setSsLink(schId, g, exs, id, on) {
  const L = ssLinks(schId, g, exs);
  if (on) L.add(id); else L.delete(id);
  S.settings.superserie = { ...(S.settings.superserie || {}), [ssKey(schId, g)]: [...L] };
  save();
}
// indici della superserie che contiene l'esercizio idx (null se è da solo)
function ssGroup(schId, g, exs, idx) {
  const L = ssLinks(schId, g, exs);
  let a = idx, b = idx;
  while (a > 0 && L.has(exs[a - 1].id)) a--;
  while (b < exs.length - 1 && L.has(exs[b].id)) b++;
  return b > a ? Array.from({ length: b - a + 1 }, (_, k) => a + k) : null;
}
function ssRest(exs, grp) {
  for (const k of grp) { const m = (exs[k].note || '').match(/(\d+)\s*″\s*tra i giri/); if (m) return +m[1]; }
  const last = exs[grp[grp.length - 1]];
  return restSeconds(last.recupero, last.range);
}
const fmtRest = (s) => (s >= 60 ? `${Math.floor(s / 60)}′${s % 60 ? (s % 60) + '″' : ''}` : `${s}″`);

function startSession(sch, g, week) {
  const cur = S.current && S.sessions.find((s) => s.id === S.current);
  if (cur && !cur.libero && cur.scheda === sch.id && cur.giorno === g && cur.settimana === week) { location.hash = '#/sessione'; return; }
  closeOrDiscard(cur);
  const sess = {
    id: 's' + Date.now().toString(36), scheda: sch.id, settimana: week, giorno: g, data: todayISO(), inizio: Date.now(),
    idx: 0, esercizi: {}, chiusa: false, pesoCorporeo: bodyweight(todayISO()),
  };
  S.sessions.push(sess);
  S.current = sess.id;
  save();
  location.hash = '#/sessione';
}

// ---------------------------------------------------------------- ALLENAMENTO APERTO
// Chiude l'allenamento aperto: si salva se ha almeno una serie fatta, altrimenti si scarta.
function closeOrDiscard(cur) {
  if (!cur) return;
  const any = Object.values(cur.esercizi).some((r) => !r.saltato && r.serie.some((x) => x.fatto));
  if (any) { cur.chiusa = true; cur.fine = cur.fine || Date.now(); } else S.sessions = S.sessions.filter((s) => s.id !== cur.id);
  S.current = null; stopTimer();
}
function switchBannerHTML(cur, nuovo) {
  const any = Object.values(cur.esercizi).some((r) => !r.saltato && r.serie.some((x) => x.fatto));
  return `<div class="card switch-banner" role="alert"><b>Hai un allenamento in corso (${esc(sessLabel(cur))}).</b>
    <div class="small">Vuoi concluderlo e iniziare ${esc(nuovo)}? ${any ? 'Le serie già fatte vengono salvate.' : 'Non ha serie fatte, quindi viene scartato.'}</div>
    <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn primary small" id="swGo">Concludi e inizia</button><a class="btn small" href="#/sessione">Torna all'allenamento</a></div></div>`;
}
function bindSwitchBanner(onGo) { const b = document.getElementById('swGo'); if (b) b.onclick = onGo; }

// ---------------------------------------------------------------- ALLENAMENTO LIBERO
// Fuori scheda: esercizi aggiunti man mano. Non conta come seduta della scheda,
// ma entra nei carichi del movimento, nel tonnellaggio, nello storico e nell'export.
function freeCardHTML() {
  return `<div class="section-title">Fuori scheda</div><a class="card free-card" href="#/libero"><div class="grow"><b>Allenamento libero</b><div class="muted">Aggiungi gli esercizi man mano. Non conta nella scheda, ma salva carichi e tonnellaggio.</div></div><span class="btn small">Inizia</span></a>`;
}
function renderFreeStart() {
  const cur = S.current && S.sessions.find((s) => s.id === S.current);
  if (cur && cur.libero) { location.hash = '#/sessione'; return; }
  const start = () => {
    closeOrDiscard(S.current && S.sessions.find((s) => s.id === S.current));
    const sess = { id: 's' + Date.now().toString(36), libero: true, scheda: null, settimana: null, giorno: 'L', titolo: 'Allenamento libero', data: todayISO(), inizio: Date.now(),
      idx: 0, esercizi: {}, lista: [], chiusa: false, pesoCorporeo: bodyweight(todayISO()), aggiungi: true };
    S.sessions.push(sess); S.current = sess.id; save(); location.hash = '#/sessione';
  };
  if (!cur) return start();
  setTop('Allenamento libero', 'Fuori scheda', '#/'); setTab('home');
  $app.innerHTML = switchBannerHTML(cur, 'un allenamento libero');
  bindSwitchBanner(start);
}
let freeQuery = '';
function renderFreePicker(sess) {
  stopAnim();
  const exs = sess.lista || [];
  setTop('Aggiungi un esercizio', exs.length ? `Allenamento libero · ${exs.length} esercizi` : 'Allenamento libero · fuori scheda', exs.length ? null : '#/');
  setTab('');
  const q = freeQuery.trim().toLowerCase();
  const items = catalog(S).filter((c) => !q || c.title.toLowerCase().includes(q) || c.primary.some((m) => (MUSCLES[m] || m).toLowerCase().includes(q)));
  const recent = [...new Set(S.sessions.filter((s) => s.libero && s.id !== sess.id).flatMap((s) => (s.lista || []).map((x) => x.illustrazione)))].slice(-8).reverse();
  let h = `<div class="card settings"><label>Cerca<input id="fq" type="search" value="${esc(freeQuery)}" placeholder="nome o muscolo, es. panca, glutei" autocomplete="off"></label></div>`;
  if (!q && recent.length) h += `<div class="section-title">Usati di recente</div><div class="pick-list">${recent.map((k) => catalog(S).find((c) => c.key === k)).filter(Boolean).map(pickHTML).join('')}</div>`;
  h += `<div class="section-title">${q ? `${items.length} risultati` : 'Tutti gli esercizi'}</div><div class="pick-list">${items.slice(0, q ? 60 : 200).map(pickHTML).join('')}</div>`;
  if (!items.length) h += `<div class="muted">Nessun esercizio trovato. Puoi crearlo da Gestisci le schede.</div>`;
  h += `<div class="sticky-cta" style="display:grid;gap:8px">${exs.length ? '<button class="btn block" id="fBack">Torna all\'allenamento</button>' : '<button class="btn ghost block" id="fCancel">Annulla</button>'}</div>`;
  $app.innerHTML = h;
  const inp = document.getElementById('fq');
  inp.oninput = () => { freeQuery = inp.value; const pos = inp.selectionStart; renderFreePicker(sess); const n = document.getElementById('fq'); n.focus(); n.setSelectionRange(pos, pos); };
  $app.querySelectorAll('[data-key]').forEach((b) => { b.onclick = () => addFreeEx(sess, b.dataset.key); });
  const fb = document.getElementById('fBack'); if (fb) fb.onclick = () => { sess.aggiungi = false; save(); route(); };
  const fc = document.getElementById('fCancel'); if (fc) fc.onclick = () => { closeOrDiscard(sess); save(); location.hash = '#/'; };
}
const pickHTML = (c) => `<button class="card pick-item" data-key="${esc(c.key)}"><b>${esc(c.title)}</b><span class="muted small">${esc(c.primary.map((m) => MUSCLES[m] || m).join(', '))}${c.custom ? ' · creato da te' : ''}</span></button>`;
function addFreeEx(sess, key) {
  const c = catalog(S).find((x) => x.key === key); if (!c) return;
  const prev = historyMov(key, sess.id).slice(-1)[0];
  const tipo = guessLoad(c.title);
  const ex = { id: 'x' + Date.now().toString(36), giorno: 'L', nome: c.title, illustrazione: key, serie: prev && prev.serie ? Math.max(1, Math.min(10, prev.serie.length)) : 3,
    reps: null, range: null, recupero: '90″', tipoCarico: tipo, storico: [], note: '', libero: true };
  sess.lista = [...(sess.lista || []), ex];
  sess.idx = sess.lista.length - 1; sess.aggiungi = false; freeQuery = '';
  save(); window.scrollTo(0, 0); route();
}
function bindFreeSession(sess, e, rec) {
  const add = document.getElementById('freeAdd'); if (add) add.onclick = () => { sess.aggiungi = true; save(); window.scrollTo(0, 0); route(); };
  const sa = document.getElementById('setAdd');
  if (sa) sa.onclick = () => { const l = rec.serie[rec.serie.length - 1] || {}; rec.serie.push({ carico: l.carico ?? null, zavorra: l.zavorra ?? null, reps: null, fatto: false }); e.serie = rec.serie.length; save(); route(); };
  const sd = document.getElementById('setDel');
  if (sd) sd.onclick = () => { rec.serie.pop(); e.serie = rec.serie.length; save(); route(); };
  const xd = document.getElementById('exDel');
  if (xd) xd.onclick = () => {
    if (rec.serie.some((x) => x.fatto) && !confirm(`Togliere ${e.nome} con le serie già fatte?`)) return;
    sess.lista = sess.lista.filter((x) => x.id !== e.id); delete sess.esercizi[e.id];
    sess.idx = Math.max(0, Math.min(sess.idx, sess.lista.length - 1)); if (!sess.lista.length) sess.aggiungi = true;
    save(); route();
  };
}
function liberoExport(x) {
  const esercizi = [];
  for (const e of x.lista || []) {
    const r = x.esercizi[e.id];
    if (!r || r.saltato) continue;
    const done = r.serie.filter((y) => y.fatto && y.carico != null);
    if (!done.length) continue;
    const reps = done.map((y) => y.reps);
    const L = LIB[e.illustrazione] || (S.customEx || {})[e.illustrazione];
    const o = { esercizio: e.nome, id_movimento: e.illustrazione, muscolo_primario: L && L.primary ? L.primary[0] || null : null, tipo_carico: e.tipoCarico,
      serie: done.map((y) => ({ carico: y.carico, reps: y.reps })), carico_max: Math.max(...done.map((y) => y.carico)),
      reps_medie: Math.round((reps.reduce((a, b) => a + b, 0) / reps.length) * 100) / 100,
      tonnellaggio: Math.round(done.reduce((a, y) => a + y.carico * (y.reps || 0), 0)) };
    if (e.tipoCarico === 'bw') { o.zavorra = done[0].zavorra ?? 0; o.peso_corporeo = done[0].pesoCorporeo ?? x.pesoCorporeo; }
    esercizi.push(o);
  }
  return { data: x.data, titolo: x.titolo || 'Allenamento libero', esercizi, tonnellaggio_totale: esercizi.reduce((a, b) => a + b.tonnellaggio, 0) };
}

// ---------------------------------------------------------------- SESSIONE GUIDATA
// numeri lunghi (102,5) più piccoli, così restano leggibili nello stepper
const fitNum = (el) => { const n = String(el.value).length; el.classList.toggle('long', n >= 5); el.classList.toggle('xlong', n >= 6); };
function isExDone(sess, e) {
  const r = sess.esercizi[e.id];
  return !!r && (r.saltato || (r.serie.filter((x) => x.fatto).length >= e.serie));
}
function ensureRec(sess, e) {
  if (!sess.esercizi[e.id]) {
    const h = history(e, { exclude: sess.id });
    const l = h[h.length - 1];
    let c = l ? l.carico : e.caricoIniziale ?? null;
    let z = null;
    if (e.tipoCarico === 'bw') {
      const bwThen = l ? (l.pesoCorporeo ?? l.serie?.[0]?.pesoCorporeo ?? sess.pesoCorporeo) : sess.pesoCorporeo;
      z = l ? Math.max(0, Math.round((l.carico - bwThen) * 4) / 4) : e.caricoIniziale ?? 0;
      c = null;
    }
    sess.esercizi[e.id] = { saltato: false, serie: Array.from({ length: e.serie }, () => ({ carico: c, zavorra: z, reps: null, fatto: false })) };
  }
  return sess.esercizi[e.id];
}

function renderSession() {
  const sess = S.current && S.sessions.find((s) => s.id === S.current);
  if (!sess) { location.hash = '#/'; return; }
  const sch = sessSch(sess);
  if (!sch) { S.current = null; save(); location.hash = '#/'; return; }
  document.body.classList.add('in-session');
  const exs = sch.esercizi.filter((e) => e.giorno === sess.giorno);
  if (sess.libero && (sess.aggiungi || !exs.length)) return renderFreePicker(sess);
  if (sess.idx >= exs.length) { location.hash = '#/riepilogo'; return; }
  const e = exs[sess.idx];
  const lib = libFor(e);
  const rec = ensureRec(sess, e);
  save();
  if (sess.libero) setTop(`Libero · ${sess.idx + 1}/${exs.length}`, `${dLong(sess.data)} · fuori scheda`, '#/');
  else setTop(`Giorno ${sess.giorno} · ${sess.idx + 1}/${exs.length}`, `Settimana ${sess.settimana} · ${dayName(sch, sess.giorno)}`, '#/');
  setTab('');

  const hist = history(e, { exclude: sess.id });
  const lastH = hist[hist.length - 1];
  const range = e.range ? (e.range[0] === e.range[1] ? `${e.range[0]}` : e.range.join('–')) : e.reps != null ? `${e.reps}` : 'rip.';
  const grp = ssGroup(sch.id, sess.giorno, exs, sess.idx);
  const rest = grp ? ssRest(exs, grp) : restSeconds(e.recupero, e.range);
  const prim = musclesFor(e).primary, sec = musclesFor(e).secondary || [];

  const linksP = ssLinks(sch.id, sess.giorno, exs);
  let h = `<div class="progress">${exs.map((x, i) => `<i class="${i === sess.idx ? 'cur' : sess.esercizi[x.id]?.saltato ? 'skip' : isExDone(sess, x) ? 'done' : ''}${linksP.has(x.id) ? ' ss' : ''}"></i>`).join('')}</div>`;
  h += `<div class="ex-head"><div><h2>${esc(e.nome)}</h2><div class="target">${e.libero ? `<b>${rec.serie.length} serie</b>` : `<b>${e.serie} serie × ${range} rip.</b>`} · recupero ${fmtRest(rest)}${grp ? ' dopo il giro' : ''}</div></div></div>`;
  if (grp) {
    const others = grp.filter((k) => k !== sess.idx).map((k) => exs[k].nome).join(' e ');
    h += `<div class="ss-banner"><b>⛓ Superserie</b> con ${esc(others)}: una serie per esercizio, poi recupero. <button id="ssOff">Separa</button></div>`;
  } else if (exs[sess.idx + 1]) {
    h += `<div class="ss-banner off"><button id="ssOn">+ Fai in superserie con ${esc(exs[sess.idx + 1].nome)}</button></div>`;
  }
  h += `<div class="split"><div class="figure-wrap session-fig"><div class="paper" id="fig">${lib ? figureSVG(lib, 1, { ghost: true, label: lib.title }) : customFor(e) ? bodyMapSVG(prim, sec) : ''}</div>${lib ? '<button class="play">▶ Movimento</button>' : ''}</div><div style="display:flex;flex-direction:column;gap:10px">`;
  h += `<div class="chips">${prim.map((m) => `<span class="chip"><span class="dot"></span>${esc(MUSCLES[m])}</span>`).join('')}${sec.map((m) => `<span class="chip sec"><span class="dot"></span>${esc(MUSCLES[m])}</span>`).join('')}</div>`;
  h += `<div class="card prev"><h3>Le volte scorse</h3>`;
  if (hist.length) {
    h += `<table class="num"><tr><th>${e.libero ? 'Quando' : 'Sett.'}</th><th>Carico</th><th>Rip.</th></tr>`;
    hist.slice(-3).reverse().forEach((x, i) => {
      h += `<tr class="${i === 0 ? 'best' : ''}"><td>${e.libero ? `${dShort(x.data)} <span class="muted">${esc(x.dove || '')}</span>` : `${x.settimana}${x.data ? ` <span class="muted">(${dShort(x.data)})</span>` : ''}`}</td><td>${esc(loadText(e, x))}</td><td>${esc(repsText(x, e.serie))}</td></tr>`;
    });
    h += `</table>`;
    if (atTop(e, lastH)) h += `<div class="hint">L'ultima volta sei arrivato in cima al range (${e.range[1]} rip.) in tutte le serie: con la doppia progressione puoi salire di carico. Di quanto lo decide il PT.</div>`;
  } else h += `<div class="muted">Nessun dato precedente.</div>`;
  h += `</div></div></div>`;
  const note = (e.note || '').replace(/Rec\.[^.]*\.\s*/, '').replace(/Rip\.[^.]*\.?\s*/, '').trim();
  if (note) h += `<div class="note" style="margin-top:12px">${esc(note)}</div>`;

  // serie
  const curSet = rec.serie.findIndex((x) => !x.fatto);
  const isBw = e.tipoCarico === 'bw';
  h += `<div class="sets">`;
  rec.serie.forEach((x, i) => {
    const cl = x.fatto ? 'done' : i === curSet ? 'cur' : '';
    const lv = isBw ? x.zavorra : x.carico;
    h += `<div class="card set ${cl}" data-i="${i}"><span class="n">${i + 1}</span>
      <div class="field"><label>${LOAD_LABEL[e.tipoCarico] || 'kg'}</label><div class="stepper"><button data-act="load-" aria-label="Meno carico">−</button><input data-f="load" inputmode="decimal" value="${lv ?? ''}" placeholder="kg" aria-label="Carico serie ${i + 1}"><button data-act="load+" aria-label="Più carico">+</button></div></div>
      <div class="field"><label>Ripetizioni</label><div class="stepper"><button data-act="reps-" aria-label="Meno ripetizioni">−</button><input data-f="reps" inputmode="numeric" value="${x.reps ?? ''}" placeholder="${esc(range)}" aria-label="Ripetizioni serie ${i + 1}"><button data-act="reps+" aria-label="Più ripetizioni">+</button></div></div>
      <button class="tick" data-act="done" aria-label="Serie ${i + 1} fatta"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button></div>`;
  });
  h += `</div>`;
  if (e.libero) h += `<div class="row" style="gap:8px;margin-top:8px"><button class="btn small ghost" id="setAdd">+ Serie</button>${rec.serie.length > 1 && !rec.serie[rec.serie.length - 1].fatto ? '<button class="btn small ghost" id="setDel">− Serie</button>' : ''}<span class="grow"></span><button class="btn small ghost" id="exDel">Togli esercizio</button></div>`;
  if (isBw) h += `<div class="bw-info">Peso corporeo usato: <b>${fmt(sess.pesoCorporeo)} kg</b>. Il carico è peso corporeo + zavorra (senza zavorra, solo peso corporeo). Il peso viene dalle pesate di questa settimana.</div>`;

  const allDone = curSet === -1;
  const last = sess.idx === exs.length - 1;
  h += `<div class="nav-row"><button class="btn ghost" id="prev" ${sess.idx === 0 ? 'disabled' : ''} aria-label="Esercizio precedente">←</button>`;
  sessCtx = { sess, e, rec, curSet, rest, exs, allDone, last };
  h += `<div id="mainSlot">${mainBtnHTML()}</div>`;
  h += `</div><div class="rest-adj" id="restAdj" ${timer ? '' : 'hidden'}><button data-t="-15">−15″</button><button data-t="+15">+15″</button></div><div class="links">${sess.libero ? '<button id="freeAdd">+ Aggiungi esercizio</button>' : ''}<button id="skip">${sess.idx === exs.length - 1 ? 'Vai al riepilogo' : 'Prossimo esercizio'}</button><button id="list">Lista esercizi</button><button id="finish">Termina</button></div>`;
  $app.innerHTML = h;
  if (lib) animate(document.getElementById('fig'), lib, lib.title);

  // eventi
  const setsEl = $app.querySelector('.sets');
  setsEl.querySelectorAll('.stepper input').forEach(fitNum);
  setsEl.addEventListener('input', (ev) => {
    if (ev.target.matches('.stepper input')) fitNum(ev.target);
    const row = ev.target.closest('.set'); if (!row) return;
    const s = rec.serie[+row.dataset.i];
    if (ev.target.dataset.f === 'load') { const v = parseNum(ev.target.value); if (isBw) s.zavorra = v; else s.carico = v; }
    if (ev.target.dataset.f === 'reps') s.reps = parseNum(ev.target.value);
    save();
  });
  setsEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    const row = b.closest('.set'); const i = +row.dataset.i; const s = rec.serie[i];
    const act = b.dataset.act;
    if (act === 'load+' || act === 'load-') {
      const k = isBw ? 'zavorra' : 'carico';
      const step = STEP[e.tipoCarico] || 1;
      s[k] = Math.max(0, Math.round(((s[k] ?? 0) + (act === 'load+' ? step : -step)) * 100) / 100);
      row.querySelector('[data-f=load]').value = s[k]; fitNum(row.querySelector('[data-f=load]'));
      save(); return;
    }
    if (act === 'reps+' || act === 'reps-') {
      const base = s.reps ?? (e.range ? e.range[1] : e.reps) ?? 0;
      s.reps = Math.max(0, s.reps == null ? base : base + (act === 'reps+' ? 1 : -1));
      row.querySelector('[data-f=reps]').value = s.reps;
      save(); return;
    }
    if (act === 'done') toggleSet(sess, e, rec, i, rest, exs);
  });
  bindMainBtn();
  document.getElementById('restAdj').onclick = (ev) => { const t = ev.target.dataset.t; if (t) adjustTimer(t === '+15' ? 15 : -15); };
  document.getElementById('prev').onclick = () => { sess.idx = Math.max(0, sess.idx - 1); save(); window.scrollTo(0, 0); route(); };
  // passa al prossimo lasciando le serie come sono (in superserie: dopo tutto il gruppo)
  document.getElementById('skip').onclick = () => {
    if (rec.saltato) rec.saltato = false;
    sess.idx = (grp ? grp[grp.length - 1] : sess.idx) + 1; save(); window.scrollTo(0, 0); route();
  };
  const ssOff = document.getElementById('ssOff');
  if (ssOff) ssOff.onclick = () => { for (const k of grp.slice(0, -1)) setSsLink(sch.id, sess.giorno, exs, exs[k].id, false); route(); };
  const ssOn = document.getElementById('ssOn');
  if (ssOn) ssOn.onclick = () => { setSsLink(sch.id, sess.giorno, exs, e.id, true); route(); };
  document.getElementById('list').onclick = () => showList(sess, exs);
  document.getElementById('finish').onclick = () => { location.hash = '#/riepilogo'; };
  if (sess.libero) bindFreeSession(sess, e, rec);
  keepAwake();
}

function toggleSet(sess, e, rec, i, rest, exs) {
  const s = rec.serie[i];
  if (s.fatto) { s.fatto = false; save(); route(); return; }
  const isBw = e.tipoCarico === 'bw';
  const row = $app.querySelector(`.set[data-i="${i}"]`);
  const lv = parseNum(row.querySelector('[data-f=load]').value);
  const rv = parseNum(row.querySelector('[data-f=reps]').value);
  if (isBw) s.zavorra = lv ?? 0; else s.carico = lv;
  if (!isBw && s.carico == null && e.tipoCarico !== 'free') { toast('Scrivi il carico della serie'); row.querySelector('[data-f=load]').focus(); return; }
  s.reps = rv ?? e.reps ?? (e.range ? e.range[1] : null); // vuoto = ripetizioni prescritte, come nel diario
  if (s.reps == null) { toast('Scrivi le ripetizioni della serie'); row.querySelector('[data-f=reps]').focus(); return; }
  if (isBw) { s.pesoCorporeo = sess.pesoCorporeo; s.carico = Math.round((sess.pesoCorporeo + (s.zavorra || 0)) * 100) / 100; }
  if (e.tipoCarico === 'free' && s.carico == null) s.carico = 0;
  s.fatto = true;
  // il carico si propaga alle serie successive non ancora fatte
  rec.serie.slice(i + 1).forEach((n) => { if (!n.fatto) { if (isBw) n.zavorra = s.zavorra; else n.carico = s.carico; } });
  save();
  const sch = sessSch(sess);
  const grp = sch && ssGroup(sch.id, sess.giorno, exs, sess.idx);
  if (grp) {
    const recs = grp.map((k) => ensureRec(sess, exs[k]));
    const rounds = Math.max(...recs.map((r) => r.serie.length));
    let next = null;
    for (let r = 0; r < rounds && !next; r++) for (let j = 0; j < grp.length && !next; j++) if (recs[j].serie[r] && !recs[j].serie[r].fatto) next = { k: grp[j], r };
    const endOfDay = grp[grp.length - 1] === exs.length - 1;
    if (next && next.r === i && next.k > sess.idx) { stopTimer(); sess.idx = next.k; }
    else if (next) { startTimer(rest, `Serie ${next.r + 1} · ${exs[next.k].nome}`); sess.idx = next.k; }
    else { if (!endOfDay) startTimer(rest, 'Prossimo esercizio'); sess.idx = grp[grp.length - 1]; }
    save(); window.scrollTo(0, 0); route(); return;
  }
  const lastSet = rec.serie.every((x) => x.fatto);
  const lastEx = sess.idx === exs.length - 1;
  if (!(lastSet && lastEx)) startTimer(rest, lastSet ? 'Prossimo esercizio' : `Serie ${i + 2}`);
  route();
}

function showList(sess, exs) {
  const sch = sessSch(sess);
  let h = `<div class="ex-list">`;
  exs.forEach((x, i) => {
    const r = sess.esercizi[x.id];
    const st = r?.saltato ? 'saltato' : isExDone(sess, x) ? 'fatto' : r ? `${r.serie.filter((s) => s.fatto).length}/${x.serie} serie` : '';
    h += `<button class="card ex-item ${isExDone(sess, x) ? 'done' : ''}" data-i="${i}" style="text-align:left;border:1px solid var(--line);cursor:pointer;${i === sess.idx ? 'border-color:var(--accent)' : ''}">
      <div class="thumb paper">${thumbHTML(x, x.nome)}</div>
      <div class="grow"><h3>${i + 1}. ${esc(x.nome)}</h3><div class="sub">${esc(st)}</div></div></button>`;
  });
  h += `</div>`;
  stopAnim();
  setTop(sess.libero ? 'Allenamento libero · esercizi' : `Giorno ${sess.giorno} · esercizi`, sess.libero ? dLong(sess.data) : dayName(sch, sess.giorno), '#/sessione');
  $app.innerHTML = h;
  $app.querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => { sess.idx = +b.dataset.i; save(); route(); }; });
  document.getElementById('back').onclick = () => route();
}

// ---------------------------------------------------------------- timer di recupero
// Il recupero si vede sul pulsante principale: il bordo si riempie mentre scorre il tempo.
let timer = null;
let sessCtx = null;
const mmss = (l) => `${Math.floor(l / 60)}:${String(l % 60).padStart(2, '0')}`;
const timerLeft = () => (timer ? Math.max(0, Math.ceil((timer.end - Date.now()) / 1000)) : 0);

function mainBtnHTML(go = false) {
  const c = sessCtx; if (!c) return '';
  // il recupero non blocca: il pulsante resta usabile, il bordo si riempie col tempo
  const ring = timer ? '<svg class="ring" aria-hidden="true"><path pathLength="100"/></svg>' : '';
  const clock = timer ? `<small class="rest-clock">Recupero <b class="num" id="restClock">${mmss(timerLeft())}</b></small>` : '';
  const cls = `${timer ? ' resting' : ''}${go ? ' go' : ''}`;
  return c.allDone
    ? `<button class="btn primary${cls}" id="next">${ring}<span class="rest-txt"><span>${c.last ? 'Fine allenamento' : 'Prossimo esercizio →'}</span>${clock}</span></button>`
    : `<button class="btn ok${cls}" id="doneSet">${ring}<span class="rest-txt"><span>Serie ${c.curSet + 1} fatta ✓</span>${clock}</span></button>`;
}
function bindMainBtn() {
  const c = sessCtx; if (!c) return;
  const ds = document.getElementById('doneSet');
  if (ds) ds.onclick = () => toggleSet(c.sess, c.e, c.rec, c.curSet, c.rest, c.exs);
  const nx = document.getElementById('next');
  if (nx) nx.onclick = () => { c.sess.idx += 1; save(); window.scrollTo(0, 0); route(); };
  if (timer) { layoutRing(); drawTimer(); }
  const adj = document.getElementById('restAdj'); if (adj) adj.hidden = !timer;
}
// bordo arrotondato che parte dal centro in alto e gira in senso orario
function layoutRing() {
  const btn = document.querySelector('#mainSlot .btn'); if (!btn || !btn.querySelector('.ring')) return;
  const svg = btn.querySelector('.ring'), path = svg.querySelector('path');
  const w = btn.offsetWidth, h = btn.offsetHeight, sw = 4, i = sw / 2;
  const r = Math.min(parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 14, h / 2) - i / 2;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  path.setAttribute('d', `M${w / 2},${i} H${w - r - i} A${r},${r} 0 0 1 ${w - i},${r + i} V${h - r - i} A${r},${r} 0 0 1 ${w - r - i},${h - i} H${r + i} A${r},${r} 0 0 1 ${i},${h - r - i} V${r + i} A${r},${r} 0 0 1 ${r + i},${i} Z`);
}
function drawTimer() {
  if (!timer) return;
  const l = timerLeft();
  const btn = document.querySelector('#mainSlot .btn');
  if (btn && btn.querySelector('.ring')) {
    const done = Math.min(100, Math.max(0, (1 - (timer.end - Date.now()) / (timer.total * 1000)) * 100));
    btn.querySelector('.ring path').style.strokeDashoffset = String(100 - done);
    const ck = document.getElementById('restClock'); if (ck) ck.textContent = mmss(l);
  }
  if (l <= 0) endRest(true);
}
function endRest(natural) {
  if (!timer) return;
  clearInterval(timer.iv); timer = null;
  const slot = document.getElementById('mainSlot');
  if (slot) { slot.innerHTML = mainBtnHTML(natural); bindMainBtn(); }
}
function startTimer(sec, nextLabel) {
  if (timer) clearInterval(timer.iv);
  timer = { end: Date.now() + sec * 1000, total: sec, nextLabel, iv: null };
  timer.iv = setInterval(drawTimer, 200);
}
function adjustTimer(d) {
  if (!timer) return;
  timer.end += d * 1000;
  timer.total = Math.max(timer.total, Math.ceil((timer.end - Date.now()) / 1000));
  drawTimer();
}
function stopTimer() { if (timer) { clearInterval(timer.iv); timer = null; } }
window.addEventListener('resize', layoutRing);
let wake = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { /* non supportato */ }
}

// ---------------------------------------------------------------- RIEPILOGO
function sessionText(sess) {
  const sch = sessSch(sess);
  if (!sch) return `Allenamento giorno ${sess.giorno} · ${dLong(sess.data)} (scheda ${sess.scheda} non caricata)`;
  const exs = sch.esercizi.filter((e) => e.giorno === sess.giorno);
  const lines = [sess.libero ? `Allenamento libero · ${dLong(sess.data)} (fuori scheda)` : `Allenamento giorno ${sess.giorno} (${dayName(sch, sess.giorno)}) · Scheda ${sch.id}, settimana ${sess.settimana} · ${dLong(sess.data)}`];
  for (const e of exs) {
    const r = sess.esercizi[e.id];
    if (r && r.saltato) { lines.push(`${e.nome}: saltato`); continue; }
    if (!r) { lines.push(`${e.nome}: non fatto`); continue; }
    const done = r.serie.filter((x) => x.fatto);
    if (!done.length) { lines.push(`${e.nome}: non fatto`); continue; }
    const loads = [...new Set(done.map((x) => (e.tipoCarico === 'bw' ? x.zavorra : x.carico)))];
    const reps = done.map((x) => fmt(x.reps)).join('/');
    if (e.tipoCarico === 'bw') {
      lines.push(`${e.nome}: zavorra ${loads.map((z) => fmt(z)).join('-')} kg (peso corporeo ${fmt(sess.pesoCorporeo)}) × ${reps}`);
    } else if (loads.length === 1) {
      lines.push(`${e.nome}: ${fmt(loads[0])} × ${reps}`);
    } else {
      lines.push(`${e.nome}: ${done.map((x) => `${fmt(x.carico)}×${fmt(x.reps)}`).join(', ')}`);
    }
  }
  return lines.join('\n');
}
function tonnage(sess) {
  let t = 0, n = 0;
  for (const r of Object.values(sess.esercizi)) for (const x of r.serie) if (x.fatto && !r.saltato) { t += (x.carico || 0) * (x.reps || 0); n++; }
  return { t: Math.round(t), n };
}

function renderSummary() {
  const sess = S.current && S.sessions.find((s) => s.id === S.current);
  if (!sess) { location.hash = '#/storico'; return; }
  const sch = sessSch(sess);
  if (!sch) { location.hash = '#/'; return; }
  document.body.classList.add('in-session');
  stopAnim();
  setTop('Riepilogo allenamento', sess.libero ? `Allenamento libero · ${dShort(sess.data)}` : `Giorno ${sess.giorno} · settimana ${sess.settimana}`, '#/sessione');
  const { t, n } = tonnage(sess);
  const mins = Math.round((Date.now() - sess.inizio) / 60000);
  const txt = sessionText(sess);
  let h = `<div class="stat-row"><div class="card stat"><b>${n}</b><span>serie fatte</span></div><div class="card stat"><b>${fmt(t, 0)}</b><span>kg di tonnellaggio</span></div><div class="card stat"><b>${mins}′</b><span>durata</span></div></div>`;
  h += `<div class="section-title">Da incollare nella chat del diario</div><textarea class="export" id="txt" readonly>${esc(txt)}</textarea>`;
  h += `<div style="display:grid;gap:10px;margin-top:12px"><button class="btn" id="copy">Copia il testo</button>`;
  if (navigator.share) h += `<button class="btn" id="share">Condividi…</button>`;
  h += `<button class="btn primary" id="close">Salva e chiudi l'allenamento</button><button class="btn ghost" id="resume">Torna all'allenamento</button></div>`;
  $app.innerHTML = h;
  document.getElementById('copy').onclick = async () => {
    try { await navigator.clipboard.writeText(txt); toast('Testo copiato'); } catch (e) { const ta = document.getElementById('txt'); ta.select(); document.execCommand('copy'); toast('Testo copiato'); }
  };
  const sh = document.getElementById('share');
  if (sh) sh.onclick = () => navigator.share({ title: 'Allenamento', text: txt }).catch(() => {});
  document.getElementById('close').onclick = () => {
    sess.chiusa = true; sess.fine = Date.now(); S.current = null; save(); stopTimer();
    try { wake && wake.release(); } catch (e) { /* niente */ }
    if (sess.libero && !tonnage(sess).n) { S.sessions = S.sessions.filter((s) => s.id !== sess.id); save(); toast('Allenamento libero vuoto: non salvato'); location.hash = '#/'; return; }
    toast(sess.libero ? 'Allenamento libero salvato' : `Allenamento del giorno ${sess.giorno} salvato`);
    location.hash = '#/';
  };
  document.getElementById('resume').onclick = () => { if (sess.idx >= sch.esercizi.filter((e) => e.giorno === sess.giorno).length) sess.idx = Math.max(0, sess.idx - 1); save(); location.hash = '#/sessione'; };
}

// ---------------------------------------------------------------- LIBRERIA
let libFilter = 'tutti', libQuery = '';
function usedKeys() {
  const m = new Map();
  for (const s of DATA.schede) for (const e of s.esercizi) if (e.illustrazione && (LIB[e.illustrazione] || (S.customEx || {})[e.illustrazione])) {
    if (!m.has(e.illustrazione)) m.set(e.illustrazione, []);
    m.get(e.illustrazione).push({ e, s });
  }
  return m;
}
function renderLibrary() {
  setTop('Esercizi', hasScheda() ? 'Gli esercizi della tua scheda e gli altri disponibili' : 'Tutti gli esercizi disponibili');
  setTab('esercizi');
  const used = usedKeys();
  const lastSch = (k) => (used.has(k) ? Math.max(...used.get(k).map((x) => x.s.id)) : 0);
  const CUS = S.customEx || {};
  const T = (k) => (LIB[k] || CUS[k]).title;
  const keys = [...Object.keys(LIB), ...Object.keys(CUS)].sort((a, b) => lastSch(b) - lastSch(a) || T(a).localeCompare(T(b), 'it'));
  const groups = ['tutti', 'petto', 'dorso', 'deltoidi', 'bicipiti', 'tricipiti', 'glutei', 'femorali', 'quadricipiti', 'polpacci', 'addome', 'trapezi'];
  let h = `<input class="search" id="q" type="search" placeholder="Cerca un esercizio" value="${esc(libQuery)}">`;
  h += `<div class="filters">${groups.map((g) => `<button data-g="${g}" aria-pressed="${g === libFilter}">${g === 'tutti' ? 'Tutti' : esc(MUSCLES[g])}</button>`).join('')}</div><div class="grid" id="grid"></div>`;
  $app.innerHTML = h;
  const draw = () => {
    const q = libQuery.trim().toLowerCase();
    const list = keys.filter((k) => {
      const L = LIB[k] || CUS[k];
      const ms = [...L.primary, ...(L.secondary || [])];
      const okG = libFilter === 'tutti' || ms.some((m) => m === libFilter || (libFilter === 'deltoidi' && m.startsWith('deltoidi')));
      const okQ = !q || L.title.toLowerCase().includes(q) || (used.get(k) || []).some((x) => x.e.nome.toLowerCase().includes(q));
      return okG && okQ;
    });
    document.getElementById('grid').innerHTML = list.map((k) => {
      const L = LIB[k] || CUS[k];
      const sch = [...new Set((used.get(k) || []).map((x) => x.s.id))].map((i) => `Scheda ${i}`).join(', ');
      return `<a class="card tile" href="#/esercizio/${k}"><div class="paper">${LIB[k] ? figureSVG(L, 1, { ghost: true, label: L.title }) : bodyMapSVG(L.primary, L.secondary || [])}</div><h3>${esc(L.title)}</h3><div class="sub">${esc(L.primary.map((m) => MUSCLES[m]).join(', '))}${sch ? ` · ${sch}` : ''}</div></a>`;
    }).join('') || '<div class="empty">Nessun esercizio trovato</div>';
  };
  draw();
  $app.querySelector('.filters').onclick = (ev) => {
    const g = ev.target.dataset.g; if (!g) return;
    libFilter = g; $app.querySelectorAll('.filters button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.g === g)); draw();
  };
  document.getElementById('q').oninput = (ev) => {
    libQuery = ev.target.value;
    if (libQuery.trim() && libFilter !== 'tutti') { libFilter = 'tutti'; $app.querySelectorAll('.filters button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.g === 'tutti')); }
    draw();
  };
}

function chartSVG(points) {
  if (points.length < 2) return '';
  const W = 320, H = 130, P = { l: 34, r: 10, t: 12, b: 22 };
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 5; y1 += 5; }
  const pad = (y1 - y0) * 0.15; y0 -= pad; y1 += pad;
  const X = (v) => P.l + ((v - x0) / (x1 - x0 || 1)) * (W - P.l - P.r);
  const Y = (v) => H - P.b - ((v - y0) / (y1 - y0)) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento del carico">`;
  for (const v of [y0 + pad, y1 - pad]) s += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${fmt(v, 1)}</text>`;
  s += `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round"/>`;
  points.forEach((p, i) => {
    s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3.6" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"><title>${esc(p.label)}: ${fmt(p.y)} kg</title></circle>`;
    if (i === 0 || i === points.length - 1 || points.length <= 6) s += `<text x="${X(p.x)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(p.short)}</text>`;
  });
  s += `<text x="${X(points[points.length - 1].x)}" y="${Y(points[points.length - 1].y) - 8}" text-anchor="end" font-size="11" font-weight="700" fill="var(--text)">${fmt(points[points.length - 1].y)}</text>`;
  return s + '</svg>';
}

function renderExercise(key, from) {
  const L = LIB[key];
  const C = !L && (S.customEx || {})[key];
  if (C) {
    const fromEx = from && exById(from);
    setTop(C.title, 'Esercizio creato da te', fromEx ? `#/giorno/${fromEx.ex.giorno}` : '#/esercizi');
    setTab(fromEx ? 'home' : 'esercizi');
    $app.innerHTML = `<div class="bodymap"><div class="paper">${bodyMapSVG(C.primary, C.secondary || [])}</div></div>
      <div class="chips" style="margin-top:12px">${C.primary.map((m) => `<span class="chip"><span class="dot"></span>${esc(MUSCLES[m])}</span>`).join('')}${(C.secondary || []).map((m) => `<span class="chip sec"><span class="dot"></span>${esc(MUSCLES[m])}</span>`).join('')}</div>`;
    return;
  }
  if (!L) { location.hash = '#/esercizi'; return; }
  const used = usedKeys().get(key) || [];
  const fromEx = from && exById(from);
  const back = fromEx ? `#/giorno/${fromEx.ex.giorno}` : '#/esercizi';
  setTop(L.title, used.map((x) => x.e.nome).filter((v, i, a) => a.indexOf(v) === i).join(' · '), back);
  setTab(fromEx ? 'home' : 'esercizi');
  let h = `<div class="paper pair" style="margin-bottom:12px">${pairSVG3(L)}</div>` + `<div class="split"><div class="figure-wrap"><div class="paper" id="fig">${figureSVG(L, 1, { ghost: true, label: L.title })}</div><button class="play">▶ Movimento</button></div>`;
  h += `<div class="bodymap"><div class="paper">${bodyMapSVG(L.primary, L.secondary)}</div><div class="legend"><span><i style="background:var(--accent)"></i>principale</span><span><i style="background:var(--accent-2)"></i>secondario</span></div></div></div>`;
  h += `<div class="chips" style="margin-top:12px">${L.primary.map((m) => `<span class="chip"><span class="dot"></span>${esc(MUSCLES[m])}</span>`).join('')}${L.secondary.map((m) => `<span class="chip sec"><span class="dot"></span>${esc(MUSCLES[m])}</span>`).join('')}</div>`;
  h += `<div class="section-title">Esecuzione</div><div class="card" style="padding:12px 14px"><ul class="tips">${L.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  const ordered = [...used].sort((a, b) => (fromEx && a.e.id === fromEx.ex.id ? -1 : fromEx && b.e.id === fromEx.ex.id ? 1 : b.s.id - a.s.id));
  for (const { e, s } of ordered) {
    const hist = history(e);
    h += `<div class="section-title">${esc(e.nome)} · Scheda ${s.id}, giorno ${esc(e.giorno)}</div>`;
    h += `<div class="card prev"><div class="muted" style="font-size:14px;margin-bottom:6px">${e.serie} × ${e.range ? (e.range[0] === e.range[1] ? e.range[0] : e.range.join('–')) : e.reps}${e.recupero ? ` · rec. ${esc(e.recupero)}` : ''}</div>`;
    if (hist.length) {
      const pts = hist.map((x) => ({ x: x.settimana, y: x.carico, label: `Sett. ${x.settimana}`, short: `S${x.settimana}` }));
      h += `<div class="chart">${chartSVG(pts)}</div>`;
      h += `<table class="num"><tr><th>Sett.</th><th>Carico</th><th>Rip.</th></tr>${hist.slice().reverse().map((x) => `<tr><td>${x.settimana}${x.data ? ` <span class="muted">(${dShort(x.data)})</span>` : ''}</td><td>${esc(loadText(e, x))}</td><td>${esc(repsText(x, e.serie))}</td></tr>`).join('')}</table>`;
    } else h += `<div class="muted">Nessun carico registrato.</div>`;
    h += `</div>`;
  }
  const lib = historyMov(key).filter((x) => x.dove === 'Libero');
  if (lib.length) {
    const ex0 = { tipoCarico: guessLoad(L.title) };
    h += `<div class="section-title">Negli allenamenti liberi</div><div class="card prev"><table class="num"><tr><th>Data</th><th>Carico</th><th>Rip.</th></tr>${lib.slice().reverse().map((x) => `<tr><td>${dShort(x.data)}</td><td>${esc(loadText(ex0, x))}</td><td>${esc(repsText(x))}</td></tr>`).join('')}</table></div>`;
  }
  $app.innerHTML = h;
  animate(document.getElementById('fig'), L, L.title);
}

// ---------------------------------------------------------------- STORICO E PROGRESSI
const SUBS = [['riepilogo', 'Riepilogo'], ['peso', 'Peso'], ['forza', 'Forza'], ['volume', 'Volume'], ['allenamenti', 'Allenamenti'], ['impostazioni', 'Impostazioni ed export']];
const SCH_COL = { 1: '#5b8bb5', 2: 'var(--accent)' };
const PAL = ['#e2492f', '#3f86c6', '#2f9a62', '#c08414', '#8a5cc2', '#cf4f8f'];
let storicoScheda = null, pesoRange = 60, esSel = null, misuraKey = 'vita';

// campi delle misure, con la colonna del foglio «Peso e misure» del diario
const MISURE = [ // chiave, etichetta, unità, passo, colonna del diario
  ['peso', 'Peso', 'kg', '0.1', 'B'],
  ['grasso_pct', 'Grasso corporeo (BF)', '%', '0.1', 'D'],
  ['viscerale', 'Grasso viscerale', '%', '0.1', 'E'],
  ['massa_muscolare', 'Massa muscolare', 'kg', '0.1', null],
  ['vita', 'Vita', 'cm', '0.5', 'H'],
  ['fianchi', 'Glutei', 'cm', '0.5', 'I'],
  ['torace', 'Torace', 'cm', '0.5', 'J'],
  ['braccio', 'Bicipite', 'cm', '0.5', 'K'],
  ['coscia', 'Coscia', 'cm', '0.5', 'L'],
  ['basale', 'Metabolismo basale', 'kcal', '1', 'M'],
];
const etaAl = (nascita, iso = todayISO()) => {
  if (!nascita) return null;
  const [y, m, d] = nascita.split('-').map(Number), [Y, M, D] = iso.split('-').map(Number);
  return Y - y - (M < m || (M === m && D < d) ? 1 : 0);
};
const MISURE_CALC = [['massa_magra', 'Massa magra', 'kg'], ['massa_grassa', 'Massa grassa', 'kg']];
const misuraLabel = (k) => ([...MISURE, ...MISURE_CALC].find((m) => m[0] === k) || [k, k])[1];
const misuraUnit = (k) => ([...MISURE, ...MISURE_CALC].find((m) => m[0] === k) || [k, k, ''])[2];

function misuraForm() {
  const today = todayISO();
  return `<details class="card weigh misura" id="misura"><summary><h3>Nuova misurazione</h3><span class="muted" style="font-size:13px">Peso, BF, circonferenze. Compila solo quello che hai misurato.</span></summary>
    <label class="mrow"><span>Data</span><input type="date" id="mdate" value="${today}" max="${today}"></label>
    ${MISURE.map(([k, l, u, st]) => `<label class="mrow"><span>${l}</span><span class="minp"><input type="text" inputmode="decimal" autocomplete="off" data-m="${k}" aria-label="${l} in ${u}"><small>${u}</small></span></label>`).join('')}
    <div class="muted" id="mcalc" style="font-size:13px">Con peso e BF calcolo massa magra e massa grassa, come nel diario.</div>
    <button class="btn primary block" id="msave">Salva misurazione</button></details>`;
}
function bindMisura() {
  const el = document.getElementById('misura'); if (!el) return;
  const val = (k) => parseNum(el.querySelector(`[data-m="${k}"]`).value);
  const calc = () => {
    const pz = val('peso'), bf = val('grasso_pct');
    document.getElementById('mcalc').innerHTML = pz && bf != null ? `Massa grassa <b>${fmt(pz * bf / 100, 2)} kg</b> · massa magra <b>${fmt(pz - pz * bf / 100, 2)} kg</b>` : 'Con peso e BF calcolo massa magra e massa grassa, come nel diario.';
  };
  el.querySelectorAll('[data-m]').forEach((i) => { i.oninput = calc; });
  document.getElementById('msave').onclick = () => {
    const d = document.getElementById('mdate').value || todayISO();
    const m = { data: d };
    for (const [k] of MISURE) { const v = val(k); if (v != null) m[k] = v; }
    if (Object.keys(m).length === 1) { toast('Inserisci almeno una misura'); return; }
    if (m.peso != null && (m.peso < 30 || m.peso > 200)) { toast('Peso non valido'); return; }
    if (m.grasso_pct != null && (m.grasso_pct <= 0 || m.grasso_pct >= 60)) { toast('BF non valido'); return; }
    const LIM = { viscerale: [0, 60], massa_muscolare: [10, 120], vita: [40, 200], fianchi: [40, 200], torace: [40, 200], braccio: [15, 80], coscia: [25, 120], basale: [800, 4000] };
    for (const [k, [lo, hi]] of Object.entries(LIM)) if (m[k] != null && (m[k] < lo || m[k] > hi)) { toast(`${misuraLabel(k)} non valido`); return; }
    S.misure = (S.misure || []).filter((x) => x.data !== d); S.misure.push(m);
    if (m.peso != null) { S.pesate = (S.pesate || []).filter((x) => x.data !== d); S.pesate.push({ data: d, peso: m.peso }); }
    save(); toast(`Misurazione del ${dShort(d)} salvata`); route();
  };
}
const sign = (n, d = 1) => (n == null ? '–' : `${n > 0 ? '+' : ''}${fmt(n, d)}`);
const pct = (n) => (n == null ? '–' : `${n > 0 ? '+' : ''}${fmt(n * 100, 0)}%`);
const tone = (n) => (n == null || Math.abs(n) < 1e-4 ? '' : n > 0 ? 'up' : 'down');
const kpiCard = (lbl, val, unit, sub, cls = '') => `<div class="card kpi ${cls}"><span class="kpi-l">${lbl}</span><b class="num">${val}<small>${unit}</small></b><span class="kpi-s">${sub}</span></div>`;

function pesataForm(st) {
  const last = st.pesate[st.pesate.length - 1];
  const today = todayISO();
  const oggi = st.pesate.find((p) => p.data === today);
  return `<div class="card weigh" id="weigh"><div class="row" style="align-items:flex-start"><div class="grow"><h3>Pesata del giorno</h3>
    <div class="muted" style="font-size:13px">${oggi ? `Oggi hai già ${fmt(oggi.peso)} kg${oggi.fonte === 'diario' ? ' (dal diario)' : ''}: salvando la sostituisci.` : last ? `Ultima: ${fmt(last.peso)} kg il ${dShort(last.data)}` : ''}</div></div>
    <input type="date" id="wdate" value="${today}" max="${today}" aria-label="Data della pesata"></div>
    <div class="ss-row weigh-row"><button data-w="-" aria-label="Meno 0,1 kg">−</button><div class="ss-num"><b><input id="wkg" inputmode="decimal" value="${fmt(oggi ? oggi.peso : last ? last.peso : 64)}" aria-label="Peso in kg"></b><small>kg</small></div><button class="plus" data-w="+" aria-label="Più 0,1 kg">+</button></div>
    <button class="btn primary block" id="wsave">Salva pesata</button></div>`;
}
function bindPesata() {
  const el = document.getElementById('weigh'); if (!el) return;
  const inp = document.getElementById('wkg');
  el.querySelectorAll('[data-w]').forEach((b) => { b.onclick = () => { const v = parseNum(inp.value) ?? 64; inp.value = fmt(Math.round((v + (b.dataset.w === '+' ? 0.1 : -0.1)) * 100) / 100); }; });
  document.getElementById('wsave').onclick = () => {
    const v = parseNum(inp.value); const d = document.getElementById('wdate').value || todayISO();
    if (v == null || v < 30 || v > 200) { toast('Peso non valido'); return; }
    S.pesate = (S.pesate || []).filter((p) => p.data !== d); S.pesate.push({ data: d, peso: v });
    for (const m of S.misure || []) if (m.data === d && m.peso != null) m.peso = v;
    save();
    toast(`Pesata del ${dShort(d)} salvata: ${fmt(v)} kg`); route();
  };
}

function renderHistory(sub = 'riepilogo') {
  const subs = hasScheda() ? SUBS : SUBS.filter(([k]) => k === 'peso' || k === 'allenamenti' || k === 'impostazioni');
  if (!subs.some(([k]) => k === sub)) sub = subs[0][0];
  setTop('Storico', 'Progressi calcolati sul telefono');
  setTab('storico');
  const today = todayISO();
  const st = makeStats(DATA, S, today);
  const curSch = hasScheda() ? schedaFor(today).id : null;
  if (storicoScheda == null) storicoScheda = curSch;
  let h = `<div class="segs" role="tablist">${subs.map(([k, l]) => `<a href="#/storico/${k}" role="tab" aria-selected="${k === sub}">${l}</a>`).join('')}</div>`;
  const schSel = () => `<div class="sch-sel">${DATA.schede.map((x) => `<button data-sch="${x.id}" aria-pressed="${x.id === storicoScheda}">Scheda ${x.id}</button>`).join('')}</div>`;

  if (sub === 'riepilogo') {
    const kp = st.kpiPeso, fz = st.forza, tk = st.tonnKpi;
    h += `<p class="lead">${st.tendenza != null ? `Il peso ${st.tendenza >= 0 ? 'sale' : 'scende'} di <b>${fmt(Math.abs(st.tendenza), 2)} kg a settimana</b>.` : ''}
      ${fz ? ` Nella scheda ${fz.scheda} la somma dei massimali stimati è <b>${fmt(fz.tot, 1)} kg</b>, ${pct(fz.delta)} dalla prima settimana completa.` : ''}</p>`;
    h += `<div class="kpis">`;
    h += kpiCard('Peso medio, ultima settimana', kp ? fmt(kp.peso, 2) : '–', ' kg', kp ? `<span class="${tone(kp.delta)}">${sign(kp.delta, 2)} kg</span> sulla settimana prima · sett. ${kp.globale}` : '');
    h += kpiCard('Tendenza del peso', st.tendenza != null ? sign(st.tendenza, 2) : '–', ' kg/sett.', 'retta su tutte le pesate');
    h += kpiCard('Forza stimata', fz ? fmt(fz.tot, 1) : '–', ' kg', fz ? `<span class="${tone(fz.delta)}">${pct(fz.delta)}</span> nella scheda ${fz.scheda} · sett. ${fz.globale}` : 'serve una settimana completa');
    h += kpiCard('Tonnellaggio, ultima sett. completa', tk ? fmt(tk.tonn, 0) : '–', ' kg', tk ? `<span class="${tone(tk.delta)}">${pct(tk.delta)}</span> sulla precedente · sett. ${tk.globale}` : '');
    h += `</div>`;
    h += pesataForm(st);
    const last = st.pesate.slice(-30);
    h += `<div class="card chart-card"><h3>Peso, ultimi 30 giorni</h3>${lineChart({ series: [
      { name: 'Pesata', color: 'var(--muted)', width: 1.2, r: 2.6, points: last.map((p) => ({ x: Date.parse(p.data), y: p.peso, tip: `${dShort(p.data)}: ${fmt(p.peso)} kg` })), endLabel: false },
      { name: 'Media 7 giorni', color: 'var(--accent)', dots: false, width: 2.6, points: last.map((p) => ({ x: Date.parse(p.data), y: p.media7, tip: `${dShort(p.data)}: media ${fmt(p.media7, 2)} kg` })) },
    ], xLabels: xDates(last.map((p) => p.data)), yFmt: (v) => fmt(v, 1) })}</div>`;
  }

  if (sub === 'peso') {
    h += pesataForm(st);
    const ps = pesoRange ? st.pesate.filter((p) => Date.parse(p.data) >= Date.parse(today) - pesoRange * 864e5) : st.pesate;
    h += `<div class="card chart-card"><div class="row"><h3 class="grow">Peso giornaliero e media a 7 giorni</h3></div>
      <div class="sch-sel">${[[30, '30 g'], [60, '60 g'], [0, 'Tutto']].map(([v, l]) => `<button data-range="${v}" aria-pressed="${v === pesoRange}">${l}</button>`).join('')}</div>
      ${lineChart({ series: [
        { name: 'Pesata', color: 'var(--muted)', width: 1.2, r: 2.4, points: ps.map((p) => ({ x: Date.parse(p.data), y: p.peso, tip: `${dShort(p.data)}: ${fmt(p.peso)} kg${p.fonte === 'app' ? ' (app)' : ''}` })), endLabel: false },
        { name: 'Media 7 giorni', color: 'var(--accent)', dots: false, width: 2.6, points: ps.map((p) => ({ x: Date.parse(p.data), y: p.media7, tip: `${dShort(p.data)}: media ${fmt(p.media7, 2)} kg` })) },
      ], xLabels: xDates(ps.map((p) => p.data)), yFmt: (v) => fmt(v, 1) })}</div>`;
    const pw = st.pesoSett;
    h += `<div class="card chart-card"><h3>Peso medio per settimana</h3><div class="muted small">Media delle pesate di ogni settimana (da lunedì). Le settimane con poche pesate sono meno affidabili.</div>
      ${lineChart({ series: [{ name: 'Peso medio', color: 'var(--accent)', area: true, points: pw.map((w) => ({ x: w.globale, y: w.peso, hollow: w.n < 3, tip: `Sett. ${w.globale} (dal ${dShort(w.dal)}): ${fmt(w.peso, 2)} kg · ${w.n} pesate` })) }],
        xLabels: pw.filter((w, i) => i % Math.ceil(pw.length / 6) === 0 || i === pw.length - 1).map((w) => ({ x: w.globale, label: `S${w.globale}` })), yFmt: (v) => fmt(v, 1) })}</div>`;
    h += `<div class="section-title">Misure e composizione corporea</div>`;
    h += misuraForm();
    {
      const c = st.composizione;
      const alt = S.settings.altezza;
      const lastPeso = st.kpiPeso ? st.kpiPeso.peso : null;
      const cards = [];
      const eta = etaAl(S.settings.nascita);
      if (alt && lastPeso) cards.push(kpiCard('BMI', fmt(lastPeso / (alt / 100) ** 2, 1), '', `altezza ${fmt(alt, 0)} cm · peso medio ultima sett.`));
      if (eta != null) cards.push(kpiCard('Età', String(eta), ' anni', `data di nascita ${dShort(S.settings.nascita)}/${S.settings.nascita.slice(0, 4)}`));
      const lm = st.misure.filter((m) => m.massa_muscolare != null).pop();
      if (lm) cards.push(kpiCard('Massa muscolare', fmt(lm.massa_muscolare, 1), ' kg', c && c.muscolare != null ? `<span class="${tone(c.muscolare)}">${sign(c.muscolare, 1)} kg</span> dalla prima misura` : `misurata il ${dShort(lm.data)}`));
      if (c) {
        if (c.peso != null) cards.push(kpiCard('Peso', sign(c.peso, 1), ' kg', `dal ${dShort(c.dal)}`));
        if (c.magra != null) cards.push(kpiCard('Massa magra', sign(c.magra, 2), ' kg', `dal ${dShort(c.dal)}`));
        if (c.grassa != null) cards.push(kpiCard('Massa grassa', sign(c.grassa, 2), ' kg', `dal ${dShort(c.dal)}`));
        if (c.vita != null) cards.push(kpiCard('Vita', sign(c.vita, 1), ' cm', `dal ${dShort(c.dal)}`));
        if (c.braccio != null) cards.push(kpiCard('Bicipite', sign(c.braccio, 1), ' cm', `dal ${dShort(c.dal)}`));
      }
      if (!alt || !S.settings.nascita) cards.push(`<div class="card kpi"><span class="kpi-l">${!alt ? 'BMI' : 'Età'}</span><span class="kpi-s">Inserisci ${!alt && !S.settings.nascita ? 'altezza e data di nascita' : !alt ? 'l\'altezza' : 'la data di nascita'} in Storico → Impostazioni ed export.</span></div>`);
      if (cards.length) h += `<div class="kpis">${cards.join('')}</div>`;
      if (c) h += `<div class="muted small" style="margin:6px 2px 10px">Variazioni dalla prima all'ultima misurazione. La bioimpedenza varia con idratazione e orario: leggila come tendenza.</div>`;
    }
    if (st.misure.length) {
      const keys = [...MISURE.map((m) => m[0]), ...MISURE_CALC.map((m) => m[0])].filter((k) => k !== 'peso' && st.misure.some((m) => m[k] != null));
      if (!keys.includes(misuraKey)) misuraKey = keys[0];
      if (misuraKey) {
        const pts = st.misure.filter((m) => m[misuraKey] != null);
        h += `<div class="card chart-card"><div class="row"><h3 class="grow">Andamento</h3><select id="mkey" aria-label="Misura">${keys.map((k) => `<option value="${k}" ${k === misuraKey ? 'selected' : ''}>${misuraLabel(k)}</option>`).join('')}</select></div>
          ${lineChart({ series: [{ name: misuraLabel(misuraKey), color: 'var(--accent)', width: 2.4, r: 3.4, points: pts.map((m) => ({ x: Date.parse(m.data), y: m[misuraKey], tip: `${dShort(m.data)}: ${fmt(m[misuraKey], misuraKey === 'basale' ? 0 : 2)} ${misuraUnit(misuraKey)}${m.fonte === 'app' ? ' (app)' : ''}` })) }],
            xLabels: xDates(pts.map((m) => m.data)), yFmt: (v) => fmt(v, misuraKey === 'basale' ? 0 : 1), legend: false })}
          ${pts.length < 2 ? '<div class="muted small">Serve almeno un\'altra misurazione per vedere l\'andamento.</div>' : ''}</div>`;
      }
      const cols = [['peso', 'Peso'], ['grasso_pct', 'BF %'], ['massa_magra', 'Magra'], ['massa_grassa', 'Grassa'], ['massa_muscolare', 'Muscol.'], ['viscerale', 'Visc. %'], ['vita', 'Vita'], ['fianchi', 'Glutei'], ['torace', 'Torace'], ['braccio', 'Bicip.'], ['coscia', 'Coscia'], ['basale', 'Basale']]
        .filter(([k]) => st.misure.some((m) => m[k] != null));
      h += `<div class="card table-wrap"><table class="tbl num"><tr><th>Data</th>${cols.map(([, l]) => `<th>${l}</th>`).join('')}<th></th></tr>
        ${st.misure.slice().reverse().map((m) => `<tr><td>${dShort(m.data)}${m.fonte === 'app' ? '' : '<br><small class="muted">diario</small>'}</td>${cols.map(([k]) => `<td>${m[k] == null ? '–' : fmt(m[k], k === 'basale' ? 0 : k === 'massa_magra' || k === 'massa_grassa' ? 2 : 1)}</td>`).join('')}
          <td>${m.fonte === 'app' ? `<button class="btn small ghost" data-delm="${m.data}" aria-label="Elimina misurazione">✕</button>` : ''}</td></tr>`).join('')}</table></div>`;
    }
    const mine = (S.pesate || []).slice().sort((a, b) => (a.data < b.data ? 1 : -1));
    if (mine.length) {
      h += `<div class="section-title">Pesate inserite nell'app</div><div class="card" style="padding:6px 14px">${mine.map((p) => `<div class="row li"><span class="grow">${dLong(p.data)}</span><b class="num">${fmt(p.peso)} kg</b><button class="btn small ghost" data-delw="${p.data}" aria-label="Elimina">✕</button></div>`).join('')}</div>
        <button class="btn block" id="copyw" style="margin-top:10px">Copia le pesate per il diario</button>`;
    }
  }

  if (sub === 'forza') {
    const sch = DATA.schede.find((x) => x.id === storicoScheda);
    h += schSel();
    const ms = st.massimali.filter((m) => m.scheda === sch.id);
    const bases = [...new Set(ms.map((m) => m.base))];
    h += `<div class="card chart-card"><h3>Massimali stimati degli esercizi di riferimento</h3><div class="muted small">1RM stimato in kg (Epley: carico × (1 + rip./30)), solo settimane complete. Sono limiti inferiori, non massimali testati.</div>
      ${ms.length ? lineChart({ series: bases.map((b, i) => ({ name: b, color: PAL[i % PAL.length], points: ms.filter((m) => m.base === b).map((m) => ({ x: m.globale, y: m.e1rm, tip: `${b} · sett. ${m.globale}: ${fmt(m.e1rm, 1)} kg` })) })),
        xLabels: [...new Set(ms.map((m) => m.globale))].map((g) => ({ x: g, label: `S${g}` })), yFmt: (v) => fmt(v, 0) }) : '<div class="chart-empty">Ancora nessuna settimana completa in questa scheda.</div>'}</div>`;
    const exs = sch.esercizi.filter((e) => st.carichi.some((c) => c.id === e.id));
    if (!esSel || !exs.some((e) => e.id === esSel)) esSel = (exs.find((e) => e.riferimento) || exs[0])?.id;
    if (exs.length) {
      const rows = st.carichi.filter((c) => c.id === esSel).sort((a, b) => a.settimana - b.settimana);
      h += `<div class="card chart-card"><h3>Andamento di un esercizio</h3><select id="essel" class="sel">${exs.map((e) => `<option value="${e.id}" ${e.id === esSel ? 'selected' : ''}>${esc(e.giorno)} · ${esc(e.nome)}</option>`).join('')}</select>
        ${lineChart({ series: [{ name: 'Carico', color: 'var(--accent)', points: rows.map((r) => ({ x: r.globale, y: r.carico, hollow: r.piu, label: r.repsFatte != null ? `×${fmt(r.repsFatte, 1)}` : '', tip: `Sett. ${r.globale}: ${fmt(r.carico)} kg × ${fmt(r.reps, 2)}${r.piu ? ' · «+»' : ''}${r.fonte === 'app' ? ' (app)' : ''}` })) }],
          xLabels: rows.map((r) => ({ x: r.globale, label: `S${r.globale}` })), yFmt: (v) => fmt(v, 1) })}
        <div class="muted small">Sotto il punto le ripetizioni medie per serie, se registrate. Il cerchio vuoto segna i carichi «+».</div></div>`;
    }
    h += `<div class="section-title">Carichi registrati (kg)</div><div class="muted small" style="margin:-4px 2px 8px">«40 × 9,7» = carico × ripetizioni medie. In grassetto i carichi «+». Trazioni e dip: peso corporeo + zavorra.</div>`;
    const weeks = [...new Set(st.carichi.filter((c) => c.scheda === sch.id).map((c) => c.settimana))].sort((a, b) => a - b);
    for (const g of sch.giorni) {
      const list = sch.esercizi.filter((e) => e.giorno === g);
      h += `<div class="card table-wrap" style="margin-bottom:10px"><table class="tbl num loads"><tr><th class="sticky">Giorno ${g}</th>${weeks.map((w) => `<th>S${w}</th>`).join('')}<th>Var.</th></tr>`;
      for (const e of list) {
        const rs = st.carichi.filter((c) => c.id === e.id);
        const vals = weeks.map((w) => rs.find((r) => r.settimana === w));
        const got = vals.filter(Boolean);
        const v = got.length > 1 ? (got[got.length - 1].carico - got[0].carico) / got[0].carico : null;
        h += `<tr><td class="sticky">${esc(e.nome)}</td>${vals.map((r) => `<td class="${r && r.piu ? 'b' : ''}">${r ? `${fmt(r.carico)}${r.repsFatte != null ? `<small> × ${fmt(r.repsFatte, 1)}</small>` : ''}` : ''}</td>`).join('')}<td class="${tone(v)}">${v == null ? '' : pct(v)}</td></tr>`;
      }
      h += `</table></div>`;
    }
  }

  if (sub === 'volume') {
    const ws = st.settimane.filter((s) => s.tonn > 0).sort((a, b) => a.globale - b.globale);
    h += `<div class="card chart-card"><h3>Tonnellaggio per settimana</h3><div class="muted small">Serie × ripetizioni × carico. Il colore distingue la scheda; le barre chiare sono settimane incomplete. Fra schede diverse il volume non è confrontabile.</div>
      ${barChart({ bars: ws.map((s) => ({ label: `S${s.globale}`, segs: [{ v: s.tonn, color: SCH_COL[s.scheda] || 'var(--accent)', light: !s.completa, tip: `Sett. ${s.globale} (scheda ${s.scheda}): ${fmt(s.tonn, 0)} kg · ${s.sedute}/${s.previsti} sedute${s.completa ? '' : ' · incompleta'}` }] })),
        yFmt: (v) => (v >= 1000 ? `${fmt(v / 1000, 0)}k` : fmt(v, 0)), labelEvery: Math.ceil(ws.length / 8) })}
      <div class="chart-legend">${DATA.schede.map((x) => `<span><i style="background:${SCH_COL[x.id]}"></i>Scheda ${x.id}</span>`).join('')}</div></div>`;
    h += schSel();
    const gs = st.gruppiSintesi(storicoScheda);
    h += `<div class="card chart-card"><h3>Tonnellaggio per gruppo muscolare</h3><div class="muted small">${gs.first ? `Prima (S${st.gw(DATA.schede.find((x) => x.id === storicoScheda).settimane[gs.first - 1])}) e ultima (S${st.gw(DATA.schede.find((x) => x.id === storicoScheda).settimane[gs.last - 1])}) settimana completa della scheda.` : 'Nessuna settimana completa in questa scheda.'} Ogni esercizio conta nel gruppo che lavora di più.</div>
      ${pairBars(gs.rows.filter((r) => r.prima || r.ultima).sort((a, b) => b.ultima - a.ultima).map((r) => ({ nome: r.gruppo, prima: r.prima, ultima: r.ultima, delta: r.variazione, tipA: `${r.gruppo}, prima settimana: ${fmt(r.prima, 0)} kg`, tipB: `${r.gruppo}, ultima settimana: ${fmt(r.ultima, 0)} kg` })))}
      <div class="chart-legend"><span><i style="background:var(--muted);opacity:.5"></i>prima</span><span><i style="background:var(--accent)"></i>ultima</span></div></div>`;
    h += `<div class="card table-wrap"><table class="tbl num"><tr><th>Gruppo</th><th>Esercizi</th><th>Serie/sett.</th><th>Prima</th><th>Ultima</th><th>Var.</th></tr>
      ${gs.rows.sort((a, b) => b.serie - a.serie).map((r) => `<tr><td>${esc(r.gruppo)}</td><td>${r.esercizi}</td><td>${r.serie}</td><td>${fmt(r.prima, 0)}</td><td>${fmt(r.ultima, 0)}</td><td class="${tone(r.variazione)}">${pct(r.variazione)}</td></tr>`).join('')}</table></div>`;
    h += `<div class="section-title">Settimane</div><div class="card table-wrap"><table class="tbl num"><tr><th>Sett.</th><th>Dal</th><th>Sedute</th><th>Serie</th><th>Tonn.</th><th>Peso</th></tr>
      ${st.sett.slice().reverse().map((s) => `<tr class="${s.completa ? '' : 'dim'}"><td>S${s.globale}</td><td>${dShort(s.dal)}</td><td>${s.sedute}/${s.previsti}</td><td>${s.serie}</td><td>${fmt(s.tonn, 0)}</td><td>${fmt(s.peso, 2)}</td></tr>`).join('')}</table></div>`;    if (st.liberiSett.length) {
      h += `<div class="section-title">Allenamenti liberi</div><div class="muted small" style="margin:-4px 0 8px">Fuori scheda: tonnellaggio a parte, non entra nei confronti tra settimane della scheda.</div>
        <div class="card table-wrap"><table class="tbl num"><tr><th>Sett.</th><th>Dal</th><th>Sedute</th><th>Serie</th><th>Tonn.</th></tr>
        ${st.liberiSett.slice().reverse().map((s) => `<tr><td>S${s.globale}</td><td>${dShort(s.dal)}</td><td>${s.sedute}</td><td>${s.serie}</td><td>${fmt(s.tonn, 0)}</td></tr>`).join('')}</table></div>`;
    }
  }


  if (sub === 'allenamenti') h += historyListHTML();
  if (sub === 'impostazioni') h += settingsHTML();
  $app.innerHTML = h;

  $app.querySelectorAll('[data-sch]').forEach((b) => { b.onclick = () => { storicoScheda = +b.dataset.sch; esSel = null; route(); }; });
  $app.querySelectorAll('[data-range]').forEach((b) => { b.onclick = () => { pesoRange = +b.dataset.range; route(); }; });
  const es = document.getElementById('essel'); if (es) es.onchange = () => { esSel = es.value; route(); };
  $app.querySelectorAll('[data-delm]').forEach((b) => { b.onclick = () => { if (!confirm('Eliminare questa misurazione?')) return; S.misure = (S.misure || []).filter((m) => m.data !== b.dataset.delm); save(); route(); }; });
  const mk = document.getElementById('mkey'); if (mk) mk.onchange = () => { misuraKey = mk.value; route(); };
  $app.querySelectorAll('[data-delw]').forEach((b) => { b.onclick = () => { S.pesate = (S.pesate || []).filter((p) => p.data !== b.dataset.delw); save(); route(); }; });
  const cw = document.getElementById('copyw');
  if (cw) cw.onclick = async () => {
    const txt = 'Pesate: ' + (S.pesate || []).slice().sort((a, b) => (a.data < b.data ? -1 : 1)).map((p) => `${dShort(p.data)} ${fmt(p.peso)} kg`).join(' · ');
    try { await navigator.clipboard.writeText(txt); toast('Pesate copiate'); } catch (e) { toast(txt); }
  };
  bindPesata();
  bindMisura();
  if (sub === 'allenamenti') bindHistoryList();
  if (sub === 'impostazioni') bindSettings();
}
function xDates(dates) {
  if (!dates.length) return [];
  const n = Math.min(5, dates.length), out = [];
  for (let i = 0; i < n; i++) { const d = dates[Math.round((i * (dates.length - 1)) / Math.max(1, n - 1))]; out.push({ x: Date.parse(d), label: dShort(d) }); }
  return out;
}

function historyListHTML() {
  const list = S.sessions.filter((s) => s.chiusa || s.id === S.current).slice().reverse();
  let h = '';
  if (!list.length) h += `<div class="card empty">Ancora nessun allenamento registrato qui.<br>Lo storico del diario lo trovi nelle altre sezioni e nella scheda di ogni esercizio.</div>`;
  for (const s of list) {
    const { t, n } = tonnage(s);
    const lines = sessionText(s).split('\n').slice(1);
    h += `<div class="card hist-session" style="margin-bottom:10px"><div class="row"><div class="grow"><h3>${s.libero ? 'Allenamento libero' : `Giorno ${esc(s.giorno)}`} · ${dLong(s.data)}${s.id === S.current ? ' · in corso' : ''}</h3>
      <div class="muted" style="font-size:13px">${s.libero ? 'Fuori scheda' : `Scheda ${s.scheda}, settimana ${s.settimana}`} · ${n} serie · ${fmt(t, 0)} kg</div></div>
      <button class="btn small ghost" data-copy="${s.id}">Copia</button><button class="btn small ghost" data-del="${s.id}" aria-label="Elimina">✕</button></div>
      <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`;
  }
  return h;
}
function settingsHTML() {
  const theme = S.settings.theme || 'auto';
  let h = `<div class="section-title" style="margin-top:0">Impostazioni</div><div class="card settings">
    <label>Data di nascita<input type="date" id="nascita" value="${S.settings.nascita ?? ''}" max="${todayISO()}"></label>
    <label>Altezza (cm)<input type="number" step="1" inputmode="numeric" id="altezza" value="${S.settings.altezza ?? ''}" placeholder="es. 175"></label>
    <label>Tema<select id="theme"><option value="auto" ${theme === 'auto' ? 'selected' : ''}>Automatico</option><option value="light" ${theme === 'light' ? 'selected' : ''}>Chiaro</option><option value="dark" ${theme === 'dark' ? 'selected' : ''}>Scuro</option></select></label></div>`;
  h += exportHTML();
  return h;
}
function bindHistoryList() {
  $app.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      if (!confirm('Eliminare questo allenamento dallo storico dell\'app?')) return;
      S.sessions = S.sessions.filter((s) => s.id !== b.dataset.del);
      if (S.current === b.dataset.del) S.current = null;
      save(); route();
    };
  });
  $app.querySelectorAll('[data-copy]').forEach((b) => {
    b.onclick = async () => { try { await navigator.clipboard.writeText(sessionText(S.sessions.find((s) => s.id === b.dataset.copy))); toast('Testo copiato'); } catch (e) { toast('Copia non riuscita'); } };
  });
}
function bindSettings() {
  document.getElementById('nascita').onchange = (ev) => { const v = ev.target.value; S.settings.nascita = /^\d{4}-\d{2}-\d{2}$/.test(v) && v > '1920' ? v : null; save(); };
  document.getElementById('altezza').onchange = (ev) => { const v = parseNum(ev.target.value); S.settings.altezza = v && v > 100 && v < 230 ? v : null; if (v != null && !S.settings.altezza) { toast('Altezza non valida'); ev.target.value = ''; } save(); };
  document.getElementById('theme').onchange = (ev) => { S.settings.theme = ev.target.value; save(); applyTheme(); };
  bindExport();
}

// ---------------------------------------------------------------- EXPORT / IMPORT
const colLetter = (n) => { let c = ''; while (n > 0) { const m = (n - 1) % 26; c = String.fromCharCode(65 + m) + c; n = Math.floor((n - 1) / 26); } return c; };
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const mondayOf = (iso) => { const d = new Date(iso + 'T12:00:00Z'); return addDays(iso, -((d.getUTCDay() + 6) % 7)); };

// settimane (da lunedì) che hanno allenamenti o pesate registrati nell'app
function exportWeeks() {
  const set = new Set();
  for (const x of S.sessions) if (x.chiusa || x.id === S.current) {
    const sch = !x.libero && DATA.schede.find((k) => k.id === x.scheda);
    set.add(sch && sch.settimane[x.settimana - 1] ? sch.settimane[x.settimana - 1] : mondayOf(x.data));
  }
  for (const p of S.pesate || []) set.add(mondayOf(p.data));
  for (const m of S.misure || []) set.add(mondayOf(m.data));
  return [...set].sort().reverse();
}

function weekExport(mon, st) {
  const al = addDays(mon, 6);
  const all = S.sessions.filter((x) => {
    const sch = !x.libero && DATA.schede.find((k) => k.id === x.scheda);
    const d = sch && sch.settimane[x.settimana - 1] ? sch.settimane[x.settimana - 1] : mondayOf(x.data);
    return d === mon && (x.chiusa || x.id === S.current);
  });
  const sessions = all.filter((x) => !x.libero), liberiS = all.filter((x) => x.libero);
  const pesate = (S.pesate || []).filter((p) => p.data >= mon && p.data <= al).sort((a, b) => (a.data < b.data ? -1 : 1));
  const misure = (S.misure || []).filter((m) => m.data >= mon && m.data <= al).sort((a, b) => (a.data < b.data ? -1 : 1));
  const misureDiario = misure.map((m) => {
    const o = { data: m.data, colonne: {} };
    for (const [k, , , , col] of MISURE) if (m[k] != null) { o[k] = m[k]; o.colonne[k] = col || 'nessuna colonna nel diario'; }
    if (m.peso != null && m.grasso_pct != null) { o.massa_grassa = Math.round(m.peso * m.grasso_pct) / 100; o.massa_magra = Math.round((m.peso - m.peso * m.grasso_pct / 100) * 100) / 100; }
    return o;
  });
  const sch = (sessions.length ? DATA.schede.find((k) => k.id === sessions[0].scheda) : schedaFor(mon)) || { id: null, settimane: [], esercizi: [], seduteSvolte: [], giorni: [] };
  const w = sch.settimane.indexOf(mon) + 1 || (sch.id != null ? weekFor(sch, mon) : null);
  const rows = sch.esercizi.map((e) => +String(e.id).split('-r')[1]).filter(Number.isFinite);
  const firstRow = rows.length ? Math.min(...rows) : null;
  const sedute = [...new Set([...(sch.seduteSvolte[w - 1] || []), ...sessions.filter((x) => x.chiusa).map((x) => x.giorno)])].sort();
  const righe = [];
  for (const x of sessions) {
    for (const e of sch.esercizi.filter((k) => k.giorno === x.giorno)) {
      const r = x.esercizi[e.id];
      if (!r || r.saltato) continue;
      const done = r.serie.filter((y) => y.fatto && y.carico != null);
      if (!done.length) continue;
      const reps = done.map((y) => y.reps);
      const carichi = [...new Set(done.map((y) => y.carico))];
      const row = +String(e.id).split('-r')[1];
      const ok = Number.isFinite(row) && w;
      const o = {
        giorno: x.giorno, data: x.data, esercizio: e.nome, riga: ok ? row : null,
        cella_carico: ok ? colLetter(5 + w - 1) + row : null, carico: Math.max(...carichi),
        cella_reps: ok ? colLetter(23 + w - 1) + row : null, reps_media: Math.round((reps.reduce((a, b) => a + b, 0) / reps.length) * 100) / 100,
        reps, serie_fatte: done.length, serie_previste: e.serie,
      };
      if (carichi.length > 1) o.carichi_per_serie = done.map((y) => y.carico);
      if (e.tipoCarico === 'bw') { o.zavorra = done[0].zavorra ?? 0; o.peso_corporeo = done[0].pesoCorporeo ?? x.pesoCorporeo; }
      righe.push(o);
    }
  }
  const week = st.sett.find((k) => k.dal === mon);
  const testo = [
    `Settimana dal ${dShort(mon)} al ${dShort(al)}` + (sch.id != null ? ` · Scheda ${sch.id}, settimana ${w} · sedute ${sedute.join(' ') || 'nessuna'}` : ''),
    ...all.map((x) => sessionText(x)),
    pesate.length ? 'Pesate: ' + pesate.map((p) => `${dShort(p.data)} ${fmt(p.peso)} kg`).join(' · ') : 'Pesate: nessuna inserita nell\'app',
    ...misure.map((m) => `Misure del ${dShort(m.data)}: ` + MISURE.filter(([k]) => m[k] != null).map(([k, l, u]) => `${l.toLowerCase()} ${fmt(m[k])}${u === '%' ? '%' : ' ' + u}`).join(' · ')),
  ].join('\n\n');
  return {
    settimana: { dal: mon, al, globale: st.gw(mon), scheda: sch.id, settimana_scheda: w, sedute_svolte: sedute.join(' '), cella_sedute: w && firstRow ? colLetter(5 + w - 1) + (firstRow - 2) : null },
    riepilogo: week ? { tonnellaggio: week.tonn, serie: week.serie, peso_medio: week.peso } : null,
    testo, diario: { allenamento: righe, pesate: pesate.map((p) => ({ data: p.data, peso: p.peso })), misure: misureDiario },
    liberi: liberiS.map(liberoExport),
    sessions: all, pesate, misure,
  };
}

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const meseLabel = (ym) => `${MESI[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
const schedaOfWeek = (mon) => (DATA.schede.find((k) => k.settimane.includes(mon) && (!k.fine || mon <= k.fine)) || schedaFor(mon) || { id: 0 }).id;

// periodi esportabili: settimana, mese, da inizio scheda, totale (solo dove l'app ha dati)
function exportOptions(per) {
  const ws = exportWeeks();
  const done = new Set(S.exported || []);
  const tag = (list) => (list.length && list.every((m) => done.has(m)) ? ' · già esportat' + (list.length > 1 ? 'i' : 'a') : '');
  if (per === 'settimana') return ws.map((m) => ({ v: m, t: `dal ${dShort(m)}${tag([m])}` }));
  if (per === 'mese') return [...new Set(ws.map((m) => m.slice(0, 7)))].map((ym) => ({ v: ym, t: meseLabel(ym) + tag(ws.filter((m) => m.startsWith(ym))) }));
  if (per === 'scheda') return [...new Set(ws.map(schedaOfWeek))].sort((a, b) => b - a).map((id) => ({ v: String(id), t: `Scheda ${id}` + tag(ws.filter((m) => schedaOfWeek(m) === id)) }));
  return [{ v: 'tutto', t: `Tutto (${ws.length} settiman${ws.length === 1 ? 'a' : 'e'})` + tag(ws) }];
}

function exportWeeksFor(per, key) {
  const ws = exportWeeks();
  if (per === 'settimana') return ws.filter((m) => m === key);
  if (per === 'mese') return ws.filter((m) => m.startsWith(key));
  if (per === 'scheda') return ws.filter((m) => String(schedaOfWeek(m)) === key);
  return ws;
}

function buildExport(per, key) {
  const st = makeStats(DATA, S, todayISO());
  const weeks = exportWeeksFor(per, key).sort().map((m) => weekExport(m, st));
  const dal = weeks.length ? weeks[0].settimana.dal : null, al = weeks.length ? weeks[weeks.length - 1].settimana.al : null;
  const etichetta = per === 'settimana' ? `settimana dal ${dShort(key)}` : per === 'mese' ? meseLabel(key) : per === 'scheda' ? `Scheda ${key} da inizio scheda` : 'tutti i dati dell\'app';
  return {
    tipo: 'palestra-export', versione: 2, creato: new Date().toISOString(),
    profilo: { nascita: S.settings.nascita || null, eta: etaAl(S.settings.nascita), altezza: S.settings.altezza || null },
    periodo: { tipo: per, chiave: key, etichetta, dal, al, settimane: weeks.length },
    nota: 'Export dell\'app Palestra, diviso per settimane. Le celle si riferiscono al foglio «Allenamento» del Diario_palestra (carico in colonna E+settimana della scheda, ripetizioni medie in W+settimana). Pesate e misure vanno nel foglio «Peso e misure», sulla riga della data, nelle colonne indicate (grasso e viscerale in percentuale: nel foglio si scrivono come frazione, 13% = 0,13). Trazioni e dip: carico = peso corporeo + zavorra. Manubri: somma dei due, tranne gli esercizi per lato. «liberi»: allenamenti fuori scheda, senza celle del diario (foglio «Allenamenti liberi», tonnellaggio a parte).',
    settimane: weeks.map((w) => ({ settimana: w.settimana, riepilogo: w.riepilogo, diario: w.diario, liberi: w.liberi })),
    testo: [`Export ${etichetta}`, ...weeks.map((w) => w.testo)].join('\n\n————\n\n'),
    sessions: weeks.flatMap((w) => w.sessions), pesate: weeks.flatMap((w) => w.pesate), misure: weeks.flatMap((w) => w.misure),
  };
}

const PERIODI = [['settimana', 'Settimana'], ['mese', 'Mese'], ['scheda', 'Da inizio scheda'], ['totale', 'Totale']];
let expPer = 'settimana';

function exportHTML() {
  const ws = exportWeeks();
  let h = `<div class="section-title">Export per Claude</div><div class="card settings">`;
  if (!ws.length) h += `<div class="muted" style="font-size:14px">Quando registri allenamenti, pesate o misure nell'app, qui puoi esportarli in un file da darmi in chat per aggiornare diario e dashboard.</div>`;
  else {
    h += `<div class="segs" id="expp" role="group" aria-label="Periodo">${PERIODI.map(([v, t]) => `<button data-per="${v}" aria-pressed="${v === expPer}">${t}</button>`).join('')}</div>
      <label id="expwl"${expPer === 'totale' ? ' hidden' : ''}>${{ settimana: 'Settimana', mese: 'Mese', scheda: 'Scheda', totale: '' }[expPer]}<select id="expw">${exportOptions(expPer).map((o) => `<option value="${o.v}">${o.t}</option>`).join('')}</select></label>
      ${expPer === 'totale' ? `<div style="font-size:14px">${exportOptions('totale')[0].t}</div>` : ''}
      <div class="muted" style="font-size:13px">Il file contiene allenamenti e pesate del periodo, divisi per settimana, con le celle del diario da aggiornare. Caricalo nella chat del progetto e io aggiorno diario e dashboard.</div>
      <div style="display:grid;gap:8px"><button class="btn primary" id="expShare">Esporta</button><button class="btn" id="expCopy">Copia il testo</button></div>`;
  }
  h += `</div><div class="section-title">Backup e ripristino</div><div style="display:grid;gap:10px">
    <button class="btn" id="exp">Esporta tutto (backup completo)</button>
    <label class="btn ghost" style="cursor:pointer">Importa un file (export o backup)<input type="file" id="imp" accept="application/json,.json" hidden></label>
    <div class="muted" style="font-size:13px">L'import di un backup carica il diario (scheda, carichi, pesate e misure) e aggiunge allenamenti, pesate e misure dell'app che mancano, senza cancellare niente.</div>
    <button class="btn ghost" id="wipe" style="color:var(--accent)">Cancella tutti i dati da questo telefono</button></div>`;
  return h;
}

async function deliverFile(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}

function bindExport() {
  const sel = document.getElementById('expw');
  const key = () => (expPer === 'totale' ? 'tutto' : sel.value);
  $app.querySelectorAll('[data-per]').forEach((b) => { b.onclick = () => { expPer = b.dataset.per; route(); }; });
  const sh = document.getElementById('expShare');
  if (sh) sh.onclick = async () => {
    const k = key(); const ex = buildExport(expPer, k);
    if (!ex.settimane.length) { toast('Niente da esportare'); return; }
    const ok = await deliverFile(`palestra_${expPer}_${k}.json`, ex);
    if (ok) { S.exported = [...new Set([...(S.exported || []), ...ex.settimane.map((w) => w.settimana.dal)])]; save(); toast(`Esportato: ${ex.periodo.etichetta}`); route(); }
  };
  const cp = document.getElementById('expCopy');
  if (cp) cp.onclick = async () => { const t = buildExport(expPer, key()).testo; try { await navigator.clipboard.writeText(t); toast('Testo copiato'); } catch (e) { toast('Copia non riuscita'); } };
  document.getElementById('exp').onclick = () => deliverFile(`palestra_backup_${todayISO()}.json`, { tipo: 'palestra-backup', versione: 1, creato: new Date().toISOString(), ...S });
  document.getElementById('wipe').onclick = () => {
    if (!confirm('Cancellare scheda, allenamenti, pesate, misure e impostazioni da questo telefono? Fai prima un backup se ti servono.')) return;
    S = { sessions: [], pesate: [], misure: [], exported: [], current: null, settings: {} }; save(); applyTheme(); location.hash = '#/'; route();
  };
  bindImport();
}

function bindImport() {
  const inp = document.getElementById('imp'); if (!inp) return;
  inp.onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      // diario (scheda, carichi, pesate e misure del file Excel): dal backup o da un diario.json
      const dia = d && d.diario && Array.isArray(d.diario.schede) ? d.diario : d && Array.isArray(d.schede) && Array.isArray(d.pesate) ? d : null;
      if (!dia && !Array.isArray(d.sessions) && !Array.isArray(d.pesate) && !Array.isArray(d.misure)) throw new Error('formato');
      if (dia && S.diario && S.diario.generato && dia.generato && dia.generato < S.diario.generato && !confirm('Il diario nel file è più vecchio di quello già caricato. Sostituirlo lo stesso?')) { ev.target.value = ''; return; }
      if (dia && S.diario && S.diario.modificato && S.diario.modificato !== dia.modificato && !confirm('Hai creato o modificato delle schede nell\'app: il diario nel file le sostituisce. Continuare?')) { ev.target.value = ''; return; }
      if (dia) S.diario = { ...EMPTY_DIARIO, ...dia };
      if (d.customEx && typeof d.customEx === 'object') for (const [k, v] of Object.entries(d.customEx)) if (v && v.title && Array.isArray(v.primary) && !(S.customEx || {})[k]) S.customEx = { ...(S.customEx || {}), [k]: v };
      const ids = new Set(S.sessions.map((x) => x.id));
      const add = (d.sessions || []).filter((x) => x && x.id && x.esercizi && !ids.has(x.id)).map((x) => ({ ...x, chiusa: true }));
      S.sessions.push(...add);
      const dates = new Set((S.pesate || []).map((p) => p.data));
      const addW = dia === d ? [] : (d.pesate || []).filter((p) => p && /^\d{4}-\d{2}-\d{2}$/.test(p.data) && typeof p.peso === 'number' && !dates.has(p.data));
      S.pesate = [...(S.pesate || []), ...addW];
      const mdates = new Set((S.misure || []).map((m) => m.data));
      const addM = dia === d ? [] : (d.misure || []).filter((m) => m && /^\d{4}-\d{2}-\d{2}$/.test(m.data) && !mdates.has(m.data)).map((m) => {
        const o = { data: m.data }; for (const [k] of MISURE) if (typeof m[k] === 'number') o[k] = m[k]; return o;
      }).filter((m) => Object.keys(m).length > 1);
      S.misure = [...(S.misure || []), ...addM];
      if (d.settings && typeof d.settings === 'object') for (const [k, v] of Object.entries(d.settings)) if (S.settings[k] == null && v != null) S.settings[k] = v;
      save(); applyTheme();
      const parts = [];
      if (dia) parts.push(`diario con ${dia.schede.length} ${dia.schede.length === 1 ? 'scheda' : 'schede'}, ${dia.pesate.length} pesate e ${(dia.misure || []).length} misurazioni`);
      if (add.length || addW.length || addM.length || !dia) parts.push(`${add.length} allenamenti, ${addW.length} pesate e ${addM.length} misurazioni dall'app`);
      toast('Importato: ' + parts.join(' + ')); route();
    } catch (e) { toast('File non valido'); }
    ev.target.value = '';
  };
}

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}

// ---------------------------------------------------------------- router
const edCtx = () => ({ DATA, S, $app, setTop, setTab, dShort, todayISO, schedaFor, dayName, ssLinks, toast, save: () => save(), rerender: () => route() });
function route() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);
  document.body.classList.remove('in-session');
  stopAnim();
  if (!parts.length) return renderHome();
  if (parts[0] === 'giorno') return renderDay(parts[1]);
  if (parts[0] === 'sessione') return renderSession();
  if (parts[0] === 'libero') return renderFreeStart();
  if (parts[0] === 'riepilogo') return renderSummary();
  if (parts[0] === 'esercizi') return renderLibrary();
  if (parts[0] === 'esercizio') return renderExercise(parts[1], params.get('from'));
  if (parts[0] === 'storico') return renderHistory(parts[1]);
  if (parts[0] === 'schede') return renderSchedeList(edCtx());
  if (parts[0] === 'scheda') return renderSchedaEdit(parts[1] || 'nuova', edCtx());
  return renderHome();
}

async function boot() {
  applyTheme();
  setData();
  initTips();
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); route(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.current) keepAwake(); });
  route();
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
