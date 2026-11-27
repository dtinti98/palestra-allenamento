// Calcolatrice nella schermata esercizio: percentuale di un carico e dischi da montare per lato.
// Bilancieri, maniglie e dischi stanno in S.settings (bilancieri/maniglie: [{nome, kg}], dischi: [kg], bilSel/manSel: indice, manComp),
// così finiscono anche nel backup completo.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 2) => (n == null || Number.isNaN(+n) ? '–' : (+n).toLocaleString('it-IT', { maximumFractionDigits: d }));
const num = (v) => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
export const DISCHI_STD = [25, 20, 15, 10, 5, 2.5, 1.25];
export const ICON_CALC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 14.5h.01M12 14.5h.01M16 14.5h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>';

// ---- dischi: quali carichi per lato si possono montare (dischi in coppia, quantità illimitata)
const U = 0.25; // unità di calcolo in kg
function plateTable(dischi, maxSide = 250) {
  const ps = [...new Set(dischi.map((d) => Math.round(d / U)).filter((d) => d > 0))].sort((a, b) => b - a);
  const n = Math.round(maxSide / U);
  const ok = new Uint8Array(n + 1); ok[0] = 1;
  for (let i = 1; i <= n; i++) for (const p of ps) if (p <= i && ok[i - p]) { ok[i] = 1; break; }
  return { ps, ok, n };
}
// per lato: il valore montabile più vicino a target e i dischi (dal più pesante)
export function platesFor(perSide, dischi) {
  const T = plateTable(dischi);
  const t = Math.max(0, Math.min(T.n, Math.round(perSide / U)));
  let best = null;
  for (let d = 0; d <= T.n; d++) {
    if (t - d >= 0 && T.ok[t - d]) { best = t - d; break; }
    if (t + d <= T.n && T.ok[t + d]) { best = t + d; break; }
  }
  if (best == null) return { side: 0, plates: [] };
  const plates = []; let r = best;
  while (r > 0) { const p = T.ps.find((x) => x <= r && T.ok[r - x]); plates.push(p * U); r -= p; }
  return { side: best * U, plates };
}
// arrotonda un carico a quello che si può davvero montare
export function roundLoad(kg, { bar, dischi, step = 2.5 }) {
  if (bar != null && dischi && dischi.length) {
    if (kg <= bar) return { kg: bar, how: `minimo il bilanciere (${fmt(bar)} kg)` };
    const p = platesFor((kg - bar) / 2, dischi);
    return { kg: bar + 2 * p.side, how: `arrotondato ai dischi, bilanciere ${fmt(bar)} kg` };
  }
  return { kg: Math.round(kg / step) * step, how: `arrotondato a ${fmt(step)} kg` };
}

// disegno di metà bilanciere con i dischi in ordine di montaggio (più pesanti verso il centro, più leggeri all'esterno)
// colore del disco: arancione per i più pesanti, verde per i più leggeri; i pesi fuori lista prendono il colore più vicino
const PCOL = [[25, '#d4531c'], [20, '#e8801c'], [15, '#e6a81e'], [10, '#bfb21f'], [5, '#7fa83a'], [2.5, '#3f9a4c'], [1.25, '#1f7a45']];
export const plateColor = (p) => PCOL.reduce((a, c) => (Math.abs(Math.log(c[0] / p)) < Math.abs(Math.log(a[0] / p)) ? c : a))[1];
const plateInk = (p) => (p >= 10 && p < 20 ? '#1f1a15' : '#fff');
function barSVG(plates, bar) {
  const W = 320, H = 136, cy = 56, x0 = 140;
  const hOf = (p) => Math.max(28, Math.min(96, 30 + p * 2.7));
  const wOf = (p) => (p >= 15 ? 18 : p >= 5 ? 14 : 11);
  let g = `<rect x="0" y="${cy - 4}" width="${x0 - 12}" height="8" class="bar"/><rect x="${x0 - 12}" y="${cy - 11}" width="7" height="22" class="bar-c"/><rect x="${x0 - 5}" y="${cy - 5}" width="${W - x0 + 5}" height="10" class="bar"/>`;
  g += `<text x="12" y="${cy - 22}" class="bar-l">bilanciere ${esc(fmt(bar))} kg</text>`;
  let x = x0 + 2, lastL = -99;
  const yL = cy + 48 + 22;
  for (const p of plates) {
    const h = hOf(p), w = wOf(p);
    if (x + w > W - 6) break;
    g += `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="2" fill="${plateColor(p)}"/>`;
    // etichette su una riga, distanziate: se serve si spostano a destra con una lineetta che le collega al disco
    const cx = x + w / 2, lx = Math.max(cx, lastL + 26);
    g += `<path d="M${cx} ${cy + h / 2 + 3}V${yL - 16}L${lx} ${yL - 13}" class="pl-ln"/><text x="${lx}" y="${yL}" text-anchor="middle" class="pl-l">${esc(fmt(p))}</text>`;
    lastL = lx; x += w + 3;
  }
  if (plates.length) g += `<rect x="${x}" y="${cy - 9}" width="5" height="18" class="bar-c"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="bar-svg" role="img" aria-label="Dischi per lato">${g}</svg>`;
}

// manubri componibili: n manubri, su ogni lato i dischi più pesanti vicino all'impugnatura e i più leggeri all'esterno
function dbSVG(plates, n) {
  const W = 320, H = 84, cy = 42, half = n === 2 ? 76 : 120, hw = 22;
  const hOf = (p) => Math.max(20, Math.min(70, 22 + p * 3.2));
  const w0 = plates.map((p) => (p >= 10 ? 10 : p >= 5 ? 8 : 6));
  const need = w0.reduce((a, w) => a + w + 2, 0), room = half - hw - 8;
  const k = need > room ? room / need : 1;
  const one = (cx) => {
    let g = `<rect x="${cx - hw - 4}" y="${cy - 3}" width="${2 * hw + 8}" height="6" class="bar"/><rect x="${cx - hw}" y="${cy - 9}" width="4" height="18" class="bar-c"/><rect x="${cx + hw - 4}" y="${cy - 9}" width="4" height="18" class="bar-c"/>`;
    let xr = cx + hw, xl = cx - hw;
    plates.forEach((p, i) => {
      const h = hOf(p), w = w0[i] * k;
      g += `<rect x="${xr}" y="${cy - h / 2}" width="${w}" height="${h}" rx="1.5" fill="${plateColor(p)}"/><rect x="${xl - w}" y="${cy - h / 2}" width="${w}" height="${h}" rx="1.5" fill="${plateColor(p)}"/>`;
      xr += w + 2 * k; xl -= w + 2 * k;
    });
    return g + `<rect x="${xr}" y="${cy - 5}" width="4" height="10" class="bar-c"/><rect x="${xl - 4}" y="${cy - 5}" width="4" height="10" class="bar-c"/>`;
  };
  const g = n === 2 ? one(W / 4) + one((3 * W) / 4) : one(W / 2);
  return `<svg viewBox="0 0 ${W} ${H}" class="bar-svg db-svg" role="img" aria-label="Dischi su ogni manubrio">${g}</svg>`;
}

// rotellina della percentuale (1–150%, passo 1)
const WH = 26, PMIN = 1, PMAX = 150;
const wheelHTML = (v) => `<div class="c-wheel" id="cWheel" tabindex="0" role="slider" aria-label="Percentuale" aria-valuemin="${PMIN}" aria-valuemax="${PMAX}" aria-valuenow="${v}" aria-valuetext="${v}%"><div class="band" aria-hidden="true"></div><div class="track" aria-hidden="true">${Array.from({ length: PMAX - PMIN + 1 }, (_, i) => `<i data-wv="${i + PMIN}">${i + PMIN}</i>`).join('')}</div></div>`;
const PCT_SC = [50, 70, 80, 90];

const st = { tab: 'pct', kind: null, base: 'max', altro: null, pct: 80, tot: null, addBar: false, editBar: false, addMan: false, editMan: false, editDischi: false };

// ctx: { S, save, toast, e, isBw, curSet (indice o -1), oggi (carico della serie in corso), massimale (Epley o null), onUse(kg) }
export function openCalc(ctx) {
  const { S } = ctx;
  const T = S.settings;
  T.bilancieri = T.bilancieri || [];
  T.maniglie = T.maniglie || [];
  if (!Array.isArray(T.dischi) || !T.dischi.length) T.dischi = [...DISCHI_STD];
  const tc = ctx.e.tipoCarico;
  const isBarbell = tc === 'barbell';
  const nMan = tc === 'single' ? 1 : 2; // «un manubrio»: il carico è già quello del manubrio
  if (st.base === 'max' && ctx.massimale == null) st.base = 'oggi';
  if (st.tot == null || st.forEx !== ctx.e.id) { st.tot = ctx.oggi ?? 60; st.forEx = ctx.e.id; st.kind = tc === 'sum' || tc === 'single' ? 'man' : 'bil'; }
  document.getElementById('calcOv')?.remove();
  const ov = document.createElement('div');
  ov.id = 'calcOv'; ov.className = 'calc-ov';
  ov.innerHTML = '<div class="calc-sheet" role="dialog" aria-modal="true" aria-label="Calcolatrice"></div>';
  document.body.append(ov);
  document.body.classList.add('calc-open');
  const sheet = ov.firstChild;
  const close = () => { ov.remove(); document.body.classList.remove('calc-open'); document.getElementById('calcBtn')?.classList.remove('on'); };
  ov.addEventListener('click', (ev) => { if (ev.target === ov) close(); });
  document.getElementById('calcBtn')?.classList.add('on');

  const LISTS = { bar: { arr: () => T.bilancieri, sel: 'bilSel', add: 'addBar', edit: 'editBar', id: 'Bar', what: 'il bilanciere', ph: 'Nome (es. Olimpico)', max: 60 },
    man: { arr: () => T.maniglie, sel: 'manSel', add: 'addMan', edit: 'editMan', id: 'Man', what: 'la maniglia', ph: 'Nome (es. Maniglia)', max: 15 } };
  const pick = (L) => L.arr()[T[L.sel] ?? 0] || null;
  const selBar = () => pick(LISTS.bar);
  const baseVal = () => (st.base === 'max' ? ctx.massimale : st.base === 'oggi' ? ctx.oggi : st.altro);
  const useBtn = (kg, vuoto = 'Scegli un carico') => (ctx.curSet >= 0 && kg != null
    ? `<button class="btn primary block" id="cUse" data-kg="${kg}">Usa ${esc(fmt(kg))} kg nella serie ${ctx.curSet + 1}</button>`
    : `<button class="btn primary block" disabled>${ctx.curSet >= 0 ? vuoto : 'Tutte le serie sono fatte'}</button>`);

  // manubri: carico totale → peso di ogni manubrio, componibile o al kg
  const manCalc = (tot) => {
    const per = tot / nMan;
    if (T.manComp) {
      const h = pick(LISTS.man);
      if (!h) return null;
      const p = platesFor(Math.max(0, (per - h.kg) / 2), T.dischi);
      const perR = h.kg + 2 * p.side;
      return { kg: perR * nMan, per: perR, side: p.side, plates: p.plates, h };
    }
    const perR = Math.max(0, Math.round(per));
    return { kg: perR * nMan, per: perR };
  };
  // arrotonda un carico a quello caricabile con l'attrezzo scelto
  const roundFor = (raw, kind) => {
    if (kind === 'man') { const m = manCalc(raw); return m ? { kg: m.kg, how: T.manComp ? 'arrotondato ai dischi dei manubri' : `arrotondato a ${nMan === 2 ? '1 kg per manubrio' : '1 kg'}` } : { kg: Math.round(raw), how: 'arrotondato a 1 kg' }; }
    if (kind === 'bil') { const b = selBar(); return roundLoad(raw, { bar: b ? b.kg : null, dischi: T.dischi, step: 2.5 }); }
    return roundLoad(raw, { bar: isBarbell && selBar() ? selBar().kg : null, dischi: T.dischi, step: ctx.isBw ? 1.25 : 2.5 });
  };
  const pctKind = () => (tc === 'sum' || tc === 'single' ? 'man' : null);

  const pctRes = () => {
    const b = baseVal();
    if (b == null) return { html: '<div class="c-res"><b class="num">–</b><div class="c-how">Scegli da quale carico partire.</div></div>', kg: null };
    const raw = (b * st.pct) / 100;
    const r = roundFor(raw, pctKind());
    return { html: `<div class="c-res"><b class="num">${esc(fmt(r.kg))}<small> kg</small></b><div class="c-how">${st.pct}% di ${esc(fmt(b, 1))} = ${esc(fmt(raw, 1))} kg<br>${esc(r.how)}</div></div>`, kg: r.kg };
  };
  const pctPicker = () => `<div class="c-pp"><div class="c-chips">${PCT_SC.map((v) => `<button data-pv="${v}" aria-pressed="${v === st.pct}">${v}%</button>`).join('')}</div>${wheelHTML(st.pct)}</div>`;
  const listHTML = (L) => `<div class="c-bars">${L.arr().map((x, i) => `<button data-${L.id.toLowerCase()}="${i}" aria-pressed="${i === (T[L.sel] ?? 0)}">${esc(x.nome)} ${esc(fmt(x.kg))}${st[L.edit] ? `<span class="del" data-del${L.id.toLowerCase()}="${i}" aria-label="Elimina ${esc(x.nome)}">✕</span>` : ''}</button>`).join('')}<button class="add" id="c${L.id}Add" aria-label="Aggiungi ${L.what}">+</button></div>`
    + (st[L.add] ? `<div class="c-form"><input id="c${L.id}N" placeholder="${L.ph}" maxlength="20" aria-label="Nome"><input id="c${L.id}K" inputmode="decimal" placeholder="kg" aria-label="Peso in kg"><button class="btn small" id="c${L.id}Save">Salva</button></div>` : '');
  const capList = (L, label) => `<span class="cap">${label}${L.arr().length ? ` <button class="lk" id="c${L.id}Edit">${st[L.edit] ? 'Fatto' : 'Modifica'}</button>` : ''}</span>`;
  const dischiHTML = () => `<div class="c-dischi">Dischi in palestra: ${T.dischi.map((x) => esc(fmt(x))).join(' · ')} <button class="lk" id="cDiscEdit">Modifica</button></div>`
    + (st.editDischi ? `<div class="c-form"><input id="cDisc" value="${esc(T.dischi.map((x) => fmt(x)).join(' '))}" aria-label="Dischi disponibili in kg, separati da spazi"><button class="btn small" id="cDiscSave">Salva</button></div>` : '');
  const chipsHTML = (plates) => `<span class="c-pl">${plates.map((x) => `<i style="background:${plateColor(x)};color:${plateInk(x)}">${esc(fmt(x))}</i>`).join('')}</span>`;
  const totStep = () => (st.kind === 'man' ? nMan : 2.5);

  // riquadro «Da percentuale» dentro Dischi per lato: compila il carico totale
  const fromPct = () => {
    const b = baseVal();
    if (b == null) return { txt: 'scegli da dove partire', kg: null };
    const raw = (b * st.pct) / 100, r = roundFor(raw, st.kind);
    return { txt: `${st.pct}% di ${fmt(b, 1)} = ${fmt(raw, 1)}${Math.abs(r.kg - raw) > 0.05 ? ` → ${fmt(r.kg)}` : ''} kg`, kg: r.kg };
  };
  const applyPct = () => { const r = fromPct(); if (r.kg != null) st.tot = r.kg; };

  const render = () => {
    const keep = sheet.scrollTop;
    let h = `<i class="grip" aria-hidden="true"></i><div class="calc-h"><h2>Calcolatrice</h2><button class="lk" id="cClose">Chiudi</button></div>
      <div class="calc-tabs" role="tablist"><button data-ct="pct" aria-pressed="${st.tab === 'pct'}">Percentuale</button><button data-ct="dischi" aria-pressed="${st.tab === 'dischi'}">Dischi per lato</button></div>`;
    if (st.tab === 'pct') {
      h += `<span class="cap">Parti da</span><div class="c-base">
        ${ctx.isBw ? '' : `<button data-base="max" aria-pressed="${st.base === 'max'}" ${ctx.massimale == null ? 'disabled' : ''}><small>Massimale stimato</small><b class="num">${ctx.massimale == null ? '–' : `${esc(fmt(ctx.massimale, 1))}<i> kg</i>`}</b></button>`}
        <button data-base="oggi" aria-pressed="${st.base === 'oggi'}" ${ctx.oggi == null ? 'disabled' : ''}><small>${ctx.isBw ? 'Zavorra di oggi' : 'Carico di oggi'}</small><b class="num">${ctx.oggi == null ? '–' : `${esc(fmt(ctx.oggi))}<i> kg</i>`}</b></button>
        <label data-base="altro" class="${st.base === 'altro' ? 'on' : ''}"><small>Altro</small><input id="cAltro" inputmode="decimal" placeholder="—" value="${st.altro ?? ''}" aria-label="Carico di partenza"></label></div>
        <span class="cap">Percentuale</span>${pctPicker()}
        <div id="cOut">${pctRes().html}</div><div id="cUseW">${useBtn(pctRes().kg)}</div>`;
    } else {
      const man = st.kind === 'man';
      h += `<div class="c-sub" role="tablist"><button data-kind="bil" aria-pressed="${!man}">Bilanciere</button><button data-kind="man" aria-pressed="${man}">Manubri</button></div>
        <span class="cap">${man ? (nMan === 2 ? 'Carico totale (due manubri)' : 'Carico del manubrio') : 'Carico totale'}</span>
        <div class="c-step"><button data-tot="-" aria-label="Meno ${fmt(totStep())} kg">−</button><input id="cTot" class="num" inputmode="decimal" value="${esc(fmt(st.tot))}" aria-label="Carico totale in kg"><small>kg</small><button data-tot="+" aria-label="Più ${fmt(totStep())} kg">+</button></div>`;
      const fp = fromPct();
      h += `<div class="c-from"><div class="r1"><span>Da percentuale</span><b class="num" id="cFromTxt">${esc(fp.txt)}</b></div>
        <div class="c-fb">${ctx.isBw ? '' : `<button data-base="max" aria-pressed="${st.base === 'max'}" ${ctx.massimale == null ? 'disabled' : ''}>Massimale ${ctx.massimale == null ? '–' : esc(fmt(ctx.massimale, 1))}</button>`}<button data-base="oggi" aria-pressed="${st.base === 'oggi'}" ${ctx.oggi == null ? 'disabled' : ''}>Oggi ${ctx.oggi == null ? '–' : esc(fmt(ctx.oggi))}</button><label data-base="altro" class="${st.base === 'altro' ? 'on' : ''}"><input id="cAltro" inputmode="decimal" placeholder="Altro" value="${st.altro ?? ''}" aria-label="Altro carico di partenza"></label></div>
        ${pctPicker()}</div>`;
      let kg = null, vuoto = 'Scegli un carico';
      if (!man) {
        const b = selBar();
        h += capList(LISTS.bar, 'Bilanciere') + listHTML(LISTS.bar);
        if (!b) { h += `<div class="c-empty">Aggiungi il tuo bilanciere con <b>+</b>: nome e peso. Lo trovi salvato le prossime volte.</div>`; vuoto = 'Aggiungi prima un bilanciere'; }
        else {
          const tot = st.tot ?? 0;
          const p = platesFor(Math.max(0, (tot - b.kg) / 2), T.dischi);
          kg = b.kg + 2 * p.side;
          h += `<div class="c-bar">${barSVG(p.plates, b.kg)}</div>`;
          h += `<div class="c-side"><b class="num">${esc(fmt(p.side))}<small> kg per lato</small></b>${chipsHTML(p.plates)}</div>`;
          if (tot < b.kg) h += `<p class="c-warn">Il carico è sotto il peso del bilanciere (${esc(fmt(b.kg))} kg).</p>`;
          else if (Math.abs(kg - tot) > 1e-6) h += `<p class="c-warn">${esc(fmt(tot))} kg non si può comporre con questi dischi: il più vicino è ${esc(fmt(kg))} kg.</p>`;
        }
        h += dischiHTML();
      } else {
        const tot = st.tot ?? 0;
        const m = manCalc(tot);
        const perShow = m ? m.per : tot / nMan;
        if (nMan === 2) h += `<div class="c-res c-man"><b class="num">${esc(fmt(perShow))}<small> kg per manubrio</small></b><div class="c-how">${esc(fmt(m ? m.kg : tot))} kg ÷ 2</div></div>`;
        h += `<div class="c-tg"><div><b>Manubri componibili</b><small>calcola i dischi da mettere su ogni manubrio</small></div><button class="c-tog" id="cComp" role="switch" aria-checked="${!!T.manComp}" aria-label="Manubri componibili"><i></i></button></div>`;
        if (T.manComp) {
          h += capList(LISTS.man, 'Maniglia') + listHTML(LISTS.man);
          if (!m) { h += `<div class="c-empty">Aggiungi la tua maniglia con <b>+</b>: nome e peso.</div>`; vuoto = 'Aggiungi prima una maniglia'; }
          else {
            kg = m.kg;
            h += `<div class="c-bar">${dbSVG(m.plates, nMan)}</div>`;
            h += `<div class="c-side c-side-s"><span><b class="num">${esc(fmt(m.side))} kg</b> per lato${nMan === 2 ? ', su ogni manubrio' : ''}</span>${chipsHTML(m.plates)}</div>`;
            if (tot / nMan < m.h.kg) h += `<p class="c-warn">Il carico è sotto il peso della maniglia (${esc(fmt(m.h.kg))} kg).</p>`;
            else if (Math.abs(kg - tot) > 1e-6) h += `<p class="c-warn">${esc(fmt(tot))} kg non si può comporre con questi dischi: il più vicino è ${esc(fmt(kg))} kg.</p>`;
          }
          h += dischiHTML();
        } else {
          kg = m.kg;
          if (Math.abs(kg - tot) > 1e-6) h += `<p class="c-warn">Con manubri al chilo il più vicino è ${esc(fmt(kg))} kg${nMan === 2 ? ` (${esc(fmt(m.per))} per manubrio)` : ''}.</p>`;
        }
      }
      h += useBtn(kg, vuoto);
    }
    sheet.innerHTML = h;
    sheet.scrollTop = keep;
    bind();
  };

  const onPct = () => { if (st.tab === 'pct') refresh(); else { applyPct(); render(); } };
  const bindWheel = () => {
    const w = sheet.querySelector('#cWheel'); if (!w) return;
    const items = [...w.querySelectorAll('i')];
    const paint = (v) => { items.forEach((it, i) => { const d = Math.abs(i + PMIN - v); it.className = d === 0 ? 'c' : d === 1 ? 'b' : d === 2 ? 'a' : ''; }); w.setAttribute('aria-valuenow', v); w.setAttribute('aria-valuetext', v + '%'); };
    const valAt = () => Math.max(PMIN, Math.min(PMAX, Math.round(w.scrollTop / WH) + PMIN));
    w.scrollTop = (st.pct - PMIN) * WH; paint(st.pct);
    let t = null, raf = 0;
    w.addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (w.isConnected) paint(valAt()); });
      clearTimeout(t);
      t = setTimeout(() => { if (!w.isConnected) return; const v = valAt(); if (v !== st.pct) { st.pct = v; sheet.querySelectorAll('[data-pv]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.pv === v)); onPct(); } }, 140);
    }, { passive: true });
    items.forEach((it) => { it.onclick = () => w.scrollTo({ top: (+it.dataset.wv - PMIN) * WH, behavior: 'smooth' }); });
    w.onkeydown = (ev) => {
      const d = ev.key === 'ArrowUp' ? -1 : ev.key === 'ArrowDown' ? 1 : 0; if (!d) return;
      ev.preventDefault(); w.scrollTop = (Math.max(PMIN, Math.min(PMAX, valAt() + d)) - PMIN) * WH;
    };
  };

  const bind = () => {
    sheet.querySelector('#cClose').onclick = close;
    sheet.querySelectorAll('[data-ct]').forEach((b) => { b.onclick = () => { st.tab = b.dataset.ct; render(); }; });
    sheet.querySelectorAll('[data-kind]').forEach((b) => { b.onclick = () => { st.kind = b.dataset.kind; render(); }; });
    sheet.querySelectorAll('button[data-base]').forEach((b) => { b.onclick = () => { st.base = b.dataset.base; if (st.tab === 'dischi') applyPct(); render(); }; });
    const al = sheet.querySelector('#cAltro');
    if (al) {
      al.onfocus = () => { if (st.base !== 'altro') { st.base = 'altro'; sheet.querySelectorAll('[data-base]').forEach((x) => { x.setAttribute('aria-pressed', x.dataset.base === 'altro'); x.classList.toggle('on', x.dataset.base === 'altro'); }); if (st.tab === 'pct') refresh(); } };
      if (st.tab === 'pct') al.oninput = () => { st.altro = num(al.value); refresh(); };
      else {
        // nei dischi si aggiorna il testo mentre scrivi; il carico totale quando confermi
        al.oninput = () => { st.altro = num(al.value); const t = sheet.querySelector('#cFromTxt'); if (t) t.textContent = fromPct().txt; };
        al.onchange = () => { st.altro = num(al.value); applyPct(); render(); };
        al.onkeydown = (ev) => { if (ev.key === 'Enter') al.blur(); };
      }
    }
    sheet.querySelectorAll('[data-pv]').forEach((b) => { b.onclick = () => { st.pct = +b.dataset.pv; if (st.tab === 'dischi') { applyPct(); render(); } else { const w = sheet.querySelector('#cWheel'); if (w) w.scrollTop = (st.pct - PMIN) * WH; sheet.querySelectorAll('[data-pv]').forEach((x) => x.setAttribute('aria-pressed', x === b)); refresh(); } }; });
    bindWheel();
    sheet.querySelectorAll('[data-tot]').forEach((b) => { b.onclick = () => { st.tot = Math.max(0, Math.round(((st.tot ?? 0) + (b.dataset.tot === '+' ? totStep() : -totStep())) * 100) / 100); render(); }; });
    const ct = sheet.querySelector('#cTot');
    if (ct) ct.onchange = () => { const v = num(ct.value); if (v != null && v >= 0 && v < 1000) st.tot = v; render(); };
    const cc = sheet.querySelector('#cComp'); if (cc) cc.onclick = () => { T.manComp = !T.manComp; ctx.save(); render(); };
    for (const L of Object.values(LISTS)) {
      const k = L.id.toLowerCase();
      sheet.querySelectorAll(`[data-${k}]`).forEach((b) => { b.onclick = (ev) => {
        const del = ev.target.closest(`[data-del${k}]`);
        if (del) { const i = +del.dataset[`del${k}`]; if (!confirm(`Eliminare «${L.arr()[i].nome}»?`)) return; L.arr().splice(i, 1); if ((T[L.sel] ?? 0) >= L.arr().length) T[L.sel] = 0; if (!L.arr().length) st[L.edit] = false; ctx.save(); render(); return; }
        T[L.sel] = +b.dataset[k]; ctx.save(); render();
      }; });
      const be = sheet.querySelector(`#c${L.id}Edit`); if (be) be.onclick = () => { st[L.edit] = !st[L.edit]; render(); };
      const ba = sheet.querySelector(`#c${L.id}Add`); if (ba) ba.onclick = () => { st[L.add] = !st[L.add]; render(); if (st[L.add]) sheet.querySelector(`#c${L.id}N`)?.focus(); };
      const bs = sheet.querySelector(`#c${L.id}Save`);
      if (bs) bs.onclick = () => {
        const nome = sheet.querySelector(`#c${L.id}N`).value.replace(/\s+/g, ' ').trim().slice(0, 20), kg = num(sheet.querySelector(`#c${L.id}K`).value);
        if (!nome) { ctx.toast('Scrivi il nome'); return; }
        if (kg == null || kg < 0 || kg > L.max) { ctx.toast('Peso non valido'); return; }
        L.arr().push({ nome, kg }); T[L.sel] = L.arr().length - 1; st[L.add] = false; ctx.save(); render();
      };
    }
    const de = sheet.querySelector('#cDiscEdit'); if (de) de.onclick = () => { st.editDischi = !st.editDischi; render(); };
    const ds = sheet.querySelector('#cDiscSave');
    if (ds) ds.onclick = () => {
      const l = [...new Set(sheet.querySelector('#cDisc').value.split(/[\s;·]+/).map(num).filter((x) => x != null && x > 0 && x <= 50))].sort((a, b) => b - a);
      if (!l.length) { ctx.toast('Scrivi almeno un disco, ad esempio 20 10 5 2,5'); return; }
      T.dischi = l; st.editDischi = false; ctx.save(); render();
    };
    bindUse();
  };
  const bindUse = () => {
    const u = sheet.querySelector('#cUse');
    if (u) u.onclick = () => { const kg = +u.dataset.kg; close(); ctx.onUse(kg); };
  };
  // aggiorna solo il risultato, senza ridisegnare il campo in cui si sta scrivendo
  const refresh = () => {
    const r = pctRes();
    sheet.querySelector('#cOut').innerHTML = r.html;
    sheet.querySelector('#cUseW').innerHTML = useBtn(r.kg);
    bindUse();
  };
  render();
  return close;
}
