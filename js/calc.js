// Calcolatrice nella schermata esercizio: percentuale di un carico e dischi da montare per lato.
// Bilancieri e dischi stanno in S.settings (bilancieri: [{nome, kg}], dischi: [kg], bilSel: indice),
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

// disegno di metà bilanciere con i dischi in ordine di montaggio (più pesanti verso l'interno)
function barSVG(plates, bar) {
  const W = 320, H = 130, cy = 58, x0 = 150;
  const hOf = (p) => Math.max(26, Math.min(100, 30 + p * 2.8));
  const wOf = (p) => (p >= 15 ? 15 : p >= 5 ? 11 : 8);
  let g = `<rect x="0" y="${cy - 4}" width="${x0 - 12}" height="8" class="bar"/><rect x="${x0 - 12}" y="${cy - 11}" width="7" height="22" class="bar-c"/><rect x="${x0 - 5}" y="${cy - 5}" width="${W - x0 + 5}" height="10" class="bar"/>`;
  g += `<text x="12" y="${cy - 22}" class="bar-l">bilanciere ${esc(fmt(bar))} kg</text>`;
  let x = x0 + 2;
  plates.forEach((p, i) => {
    const h = hOf(p), w = wOf(p);
    if (x + w > W - 6) return;
    g += `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="2" class="${p >= 15 ? 'pl-big' : 'pl-small'}"/>`;
    g += `<text x="${x + w / 2}" y="${cy + h / 2 + (i % 2 ? 26 : 14)}" text-anchor="middle" class="pl-l">${esc(fmt(p))}</text>`;
    x += w + 2;
  });
  if (plates.length) g += `<rect x="${x}" y="${cy - 9}" width="5" height="18" class="bar-c"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="bar-svg" role="img" aria-label="Dischi per lato">${g}</svg>`;
}

const st = { tab: 'pct', base: 'max', altro: null, pct: 80, tot: null, addBar: false, editBar: false, editDischi: false };

// ctx: { S, save, toast, e, isBw, curSet (indice o -1), oggi (carico della serie in corso), massimale (Epley o null), onUse(kg) }
export function openCalc(ctx) {
  const { S } = ctx;
  S.settings.bilancieri = S.settings.bilancieri || [];
  if (!Array.isArray(S.settings.dischi) || !S.settings.dischi.length) S.settings.dischi = [...DISCHI_STD];
  const isBarbell = ctx.e.tipoCarico === 'barbell';
  if (st.base === 'max' && ctx.massimale == null) st.base = 'oggi';
  if (st.tot == null || st.forEx !== ctx.e.id) { st.tot = ctx.oggi ?? 60; st.forEx = ctx.e.id; }
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

  const bars = () => S.settings.bilancieri;
  const selBar = () => { const b = bars()[S.settings.bilSel ?? 0]; return b || null; };
  const baseVal = () => (st.base === 'max' ? ctx.massimale : st.base === 'oggi' ? ctx.oggi : st.altro);
  const step = ctx.isBw ? 1.25 : 2.5;
  const useBtn = (kg, vuoto = 'Scegli un carico') => (ctx.curSet >= 0 && kg != null
    ? `<button class="btn primary block" id="cUse" data-kg="${kg}">Usa ${esc(fmt(kg))} kg nella serie ${ctx.curSet + 1}</button>`
    : `<button class="btn primary block" disabled>${ctx.curSet >= 0 ? vuoto : 'Tutte le serie sono fatte'}</button>`);

  const pctRes = () => {
    const b = baseVal();
    if (b == null) return { html: '<div class="c-res"><b class="num">–</b><div class="c-how">Scegli da quale carico partire.</div></div>', kg: null };
    const raw = (b * st.pct) / 100;
    const bar = isBarbell && selBar() ? selBar().kg : null;
    const r = roundLoad(raw, { bar, dischi: S.settings.dischi, step });
    return { html: `<div class="c-res"><b class="num">${esc(fmt(r.kg))}<small> kg</small></b><div class="c-how">${st.pct}% di ${esc(fmt(b, 1))} = ${esc(fmt(raw, 1))} kg<br>${esc(r.how)}</div></div>`, kg: r.kg };
  };

  const render = () => {
    let h = `<i class="grip" aria-hidden="true"></i><div class="calc-h"><h2>Calcolatrice</h2><button class="lk" id="cClose">Chiudi</button></div>
      <div class="calc-tabs" role="tablist"><button data-ct="pct" aria-pressed="${st.tab === 'pct'}">Percentuale</button><button data-ct="dischi" aria-pressed="${st.tab === 'dischi'}">Dischi per lato</button></div>`;
    if (st.tab === 'pct') {
      h += `<span class="cap">Parti da</span><div class="c-base">
        ${ctx.isBw ? '' : `<button data-base="max" aria-pressed="${st.base === 'max'}" ${ctx.massimale == null ? 'disabled' : ''}><small>Massimale stimato</small><b class="num">${ctx.massimale == null ? '–' : `${esc(fmt(ctx.massimale, 1))}<i> kg</i>`}</b></button>`}
        <button data-base="oggi" aria-pressed="${st.base === 'oggi'}" ${ctx.oggi == null ? 'disabled' : ''}><small>${ctx.isBw ? 'Zavorra di oggi' : 'Carico di oggi'}</small><b class="num">${ctx.oggi == null ? '–' : `${esc(fmt(ctx.oggi))}<i> kg</i>`}</b></button>
        <label data-base="altro" class="${st.base === 'altro' ? 'on' : ''}"><small>Altro</small><input id="cAltro" inputmode="decimal" placeholder="—" value="${st.altro ?? ''}" aria-label="Carico di partenza"></label></div>
        <span class="cap">Percentuale</span>
        <div class="c-step"><button data-pct="-5" aria-label="Meno 5%">−</button><b class="num">${st.pct}<small> %</small></b><button data-pct="+5" aria-label="Più 5%">+</button></div>
        <div class="c-chips">${[50, 60, 70, 80, 85, 90].map((v) => `<button data-pv="${v}" aria-pressed="${v === st.pct}">${v}</button>`).join('')}</div>
        <div id="cOut">${pctRes().html}</div><div id="cUseW">${useBtn(pctRes().kg)}</div>`;
    } else {
      const b = selBar();
      h += `<span class="cap">Carico totale</span>
        <div class="c-step"><button data-tot="-" aria-label="Meno 2,5 kg">−</button><input id="cTot" class="num" inputmode="decimal" value="${esc(fmt(st.tot))}" aria-label="Carico totale in kg"><small>kg</small><button data-tot="+" aria-label="Più 2,5 kg">+</button></div>
        <span class="cap">Bilanciere${bars().length ? ` <button class="lk" id="cBarEdit">${st.editBar ? 'Fatto' : 'Modifica'}</button>` : ''}</span>
        <div class="c-bars">${bars().map((x, i) => `<button data-bar="${i}" aria-pressed="${i === (S.settings.bilSel ?? 0)}">${esc(x.nome)} ${esc(fmt(x.kg))}${st.editBar ? `<span class="del" data-delbar="${i}" aria-label="Elimina ${esc(x.nome)}">✕</span>` : ''}</button>`).join('')}<button class="add" id="cBarAdd" aria-label="Aggiungi un bilanciere">+</button></div>`;
      if (st.addBar) h += `<div class="c-form"><input id="cBarN" placeholder="Nome (es. Olimpico)" maxlength="20" aria-label="Nome del bilanciere"><input id="cBarK" inputmode="decimal" placeholder="kg" aria-label="Peso del bilanciere in kg"><button class="btn small" id="cBarSave">Salva</button></div>`;
      let kg = null;
      if (!b) h += `<div class="c-empty">Aggiungi il tuo bilanciere con <b>+</b>: nome e peso. Lo trovi salvato le prossime volte.</div>`;
      else {
        const tot = st.tot ?? 0;
        const p = platesFor(Math.max(0, (tot - b.kg) / 2), S.settings.dischi);
        kg = b.kg + 2 * p.side;
        h += `<div class="c-bar">${barSVG(p.plates, b.kg)}</div>`;
        h += `<div class="c-side"><b class="num">${esc(fmt(p.side))}<small> kg per lato</small></b><span class="c-pl">${p.plates.map((x) => `<i>${esc(fmt(x))}</i>`).join('')}</span></div>`;
        if (tot < b.kg) h += `<p class="c-warn">Il carico è sotto il peso del bilanciere (${esc(fmt(b.kg))} kg).</p>`;
        else if (Math.abs(kg - tot) > 1e-6) h += `<p class="c-warn">${esc(fmt(tot))} kg non si può comporre con questi dischi: il più vicino è ${esc(fmt(kg))} kg.</p>`;
      }
      h += `<div class="c-dischi">Dischi in palestra: ${S.settings.dischi.map((x) => esc(fmt(x))).join(' · ')} <button class="lk" id="cDiscEdit">Modifica</button></div>`;
      if (st.editDischi) h += `<div class="c-form"><input id="cDisc" value="${esc(S.settings.dischi.map((x) => fmt(x)).join(' '))}" aria-label="Dischi disponibili in kg, separati da spazi"><button class="btn small" id="cDiscSave">Salva</button></div>`;
      h += useBtn(kg, 'Aggiungi prima un bilanciere');
    }
    sheet.innerHTML = h;
    bind();
  };

  const bind = () => {
    sheet.querySelector('#cClose').onclick = close;
    sheet.querySelectorAll('[data-ct]').forEach((b) => { b.onclick = () => { st.tab = b.dataset.ct; render(); }; });
    sheet.querySelectorAll('button[data-base]').forEach((b) => { b.onclick = () => { st.base = b.dataset.base; render(); }; });
    const al = sheet.querySelector('#cAltro');
    if (al) {
      al.onfocus = () => { if (st.base !== 'altro') { st.base = 'altro'; sheet.querySelectorAll('[data-base]').forEach((x) => { x.setAttribute('aria-pressed', x.dataset.base === 'altro'); x.classList.toggle('on', x.dataset.base === 'altro'); }); refresh(); } };
      al.oninput = () => { st.altro = num(al.value); refresh(); };
    }
    sheet.querySelectorAll('[data-pct]').forEach((b) => { b.onclick = () => { st.pct = Math.max(5, Math.min(150, st.pct + +b.dataset.pct)); render(); }; });
    sheet.querySelectorAll('[data-pv]').forEach((b) => { b.onclick = () => { st.pct = +b.dataset.pv; render(); }; });
    sheet.querySelectorAll('[data-tot]').forEach((b) => { b.onclick = () => { st.tot = Math.max(0, Math.round(((st.tot ?? 0) + (b.dataset.tot === '+' ? 2.5 : -2.5)) * 100) / 100); render(); }; });
    const ct = sheet.querySelector('#cTot');
    if (ct) ct.onchange = () => { const v = num(ct.value); if (v != null && v >= 0 && v < 1000) st.tot = v; render(); };
    sheet.querySelectorAll('[data-bar]').forEach((b) => { b.onclick = (ev) => {
      const del = ev.target.closest('[data-delbar]');
      if (del) { const i = +del.dataset.delbar; if (!confirm(`Eliminare il bilanciere «${bars()[i].nome}»?`)) return; bars().splice(i, 1); if ((S.settings.bilSel ?? 0) >= bars().length) S.settings.bilSel = 0; if (!bars().length) st.editBar = false; ctx.save(); render(); return; }
      S.settings.bilSel = +b.dataset.bar; ctx.save(); render();
    }; });
    const be = sheet.querySelector('#cBarEdit'); if (be) be.onclick = () => { st.editBar = !st.editBar; render(); };
    const ba = sheet.querySelector('#cBarAdd'); if (ba) ba.onclick = () => { st.addBar = !st.addBar; render(); if (st.addBar) sheet.querySelector('#cBarN')?.focus(); };
    const bs = sheet.querySelector('#cBarSave');
    if (bs) bs.onclick = () => {
      const nome = sheet.querySelector('#cBarN').value.replace(/\s+/g, ' ').trim().slice(0, 20), kg = num(sheet.querySelector('#cBarK').value);
      if (!nome) { ctx.toast('Scrivi il nome del bilanciere'); return; }
      if (kg == null || kg < 0 || kg > 60) { ctx.toast('Peso del bilanciere non valido'); return; }
      bars().push({ nome, kg }); S.settings.bilSel = bars().length - 1; st.addBar = false; ctx.save(); render();
    };
    const de = sheet.querySelector('#cDiscEdit'); if (de) de.onclick = () => { st.editDischi = !st.editDischi; render(); };
    const ds = sheet.querySelector('#cDiscSave');
    if (ds) ds.onclick = () => {
      const l = [...new Set(sheet.querySelector('#cDisc').value.split(/[\s;·]+/).map(num).filter((x) => x != null && x > 0 && x <= 50))].sort((a, b) => b - a);
      if (!l.length) { ctx.toast('Scrivi almeno un disco, ad esempio 20 10 5 2,5'); return; }
      S.settings.dischi = l; st.editDischi = false; ctx.save(); render();
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
