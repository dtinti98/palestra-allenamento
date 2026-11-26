// Grafici SVG disegnati a mano, senza librerie: funzionano offline.
// Ogni punto o barra ha data-tip: toccandolo compare il valore.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const nf = (n, d = 1) => (n == null || Number.isNaN(+n) ? '–' : (+n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: d }));
const niceStep = (span, n) => {
  const raw = span / n, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
};
function yScale(min, max, H, top, bottom, ticks = 4) {
  if (min === max) { min -= 1; max += 1; }
  const step = niceStep(max - min, ticks);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const Y = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);
  const tv = []; for (let v = lo; v <= hi + step / 2; v += step) tv.push(Math.round(v * 1000) / 1000);
  return { Y, ticks: tv, lo, hi };
}

// serie: [{name, color, points:[{x, y, tip, hollow}], width, dash, dots, area}]
export function lineChart({ series, width = 340, height = 180, xLabels = [], yFmt = (v) => nf(v), yMin, yMax, legend = true, endLabel = true, markers = [], labelRow = '' }) {
  const all = series.flatMap((s) => s.points);
  if (!all.length) return '<div class="chart-empty">Nessun dato</div>';
  const P = { l: 38, r: 14, t: markers.length ? 26 : 12, b: labelRow ? 40 : 24 };
  const xs = all.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const ys = all.map((p) => p.y);
  const { Y, ticks } = yScale(yMin ?? Math.min(...ys), yMax ?? Math.max(...ys), height, P.t, P.b);
  const X = (v) => P.l + (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)) * (width - P.l - P.r);
  let g = '';
  for (const v of ticks) g += `<line x1="${P.l}" x2="${width - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end" class="ax">${esc(yFmt(v))}</text>`;
  // linee verticali (es. cambio scheda) con etichette ai due lati
  for (const m of markers) { const x = X(m.x); g += `<line x1="${x}" x2="${x}" y1="${P.t - 14}" y2="${height - P.b}" class="mark"/>${m.left ? `<text x="${x - 4}" y="${P.t - 16}" text-anchor="end" class="ax mk">${esc(m.left)}</text>` : ''}${m.right ? `<text x="${x + 4}" y="${P.t - 16}" class="ax mk">${esc(m.right)}</text>` : ''}`; }
  if (labelRow) g += `<text x="4" y="${height - 24}" class="ax mk">${esc(labelRow)}</text>`;
  for (const l of xLabels) g += `<text x="${X(l.x)}" y="${height - 6}" text-anchor="middle" class="ax">${esc(l.label)}</text>`;
  for (const s of series) {
    const pts = s.points.slice().sort((a, b) => a.x - b.x);
    if (!pts.length) continue;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
    if (s.area) g += `<path d="${d}L${X(pts[pts.length - 1].x)},${height - P.b}L${X(pts[0].x)},${height - P.b}Z" fill="${s.color}" opacity=".12"/>`;
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.2}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} ${s.opacity ? `opacity="${s.opacity}"` : ''}/>`;
    if (s.dots !== false) for (const p of pts) {
      g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${s.r || 3.6}" fill="${p.hollow ? 'var(--surface)' : s.dotFill || 'var(--surface)'}" stroke="${s.color}" stroke-width="2" data-tip="${esc(p.tip || '')}"/>`;
      if (p.label) g += labelRow ? `<text x="${X(p.x)}" y="${height - 24}" text-anchor="middle" class="ax rowl">${esc(p.label)}</text>` : `<text x="${X(p.x)}" y="${Y(p.y) + 15}" text-anchor="middle" class="ax small">${esc(p.label)}</text>`;
    }
    if (s.dots === false) for (const p of pts) g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="7" fill="transparent" data-tip="${esc(p.tip || '')}"/>`;
    if (endLabel && s.endLabel !== false) {
      const l = pts[pts.length - 1];
      g += `<text x="${X(l.x) - 4}" y="${Y(l.y) - 8}" text-anchor="end" class="val" fill="${s.color}">${esc(yFmt(l.y))}</text>`;
    }
  }
  const leg = legend && series.length > 1 ? `<div class="chart-legend">${series.filter((s) => s.name).map((s) => `<span${s.dash ? ' class="dash"' : ''}><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img">${g}</svg>${leg}`;
}

// barre verticali, anche impilate: bars:[{x, label, segs:[{v, color, light, tip}], dot}]
export function barChart({ bars, width = 340, height = 180, yFmt = (v) => nf(v, 0), line, labelEvery = 1, valueLabels = false }) {
  if (!bars.length) return '<div class="chart-empty">Nessun dato</div>';
  const P = { l: 42, r: 10, t: 14, b: 24 };
  const tops = bars.map((b) => b.segs.reduce((s, x) => s + x.v, 0));
  const max = Math.max(...tops, line ? line.v : 0);
  const { Y, ticks } = yScale(0, max, height, P.t, P.b);
  const bw = (width - P.l - P.r) / bars.length;
  let g = '';
  for (const v of ticks) g += `<line x1="${P.l}" x2="${width - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end" class="ax">${esc(yFmt(v))}</text>`;
  bars.forEach((b, i) => {
    let acc = 0;
    const x = P.l + i * bw + bw * 0.14, w = bw * 0.72;
    for (const s of b.segs) {
      const y1 = Y(acc + s.v), y0 = Y(acc);
      g += `<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" rx="${Math.min(3, w / 3)}" fill="${s.color}" ${s.light ? 'opacity=".38"' : ''} data-tip="${esc(s.tip || '')}"/>`;
      acc += s.v;
    }
    if (b.dot) g += `<circle cx="${x + w / 2}" cy="${Y(acc) - 6}" r="2.6" fill="var(--text)"/>`;
    if (valueLabels && acc) g += `<text x="${x + w / 2}" y="${Y(acc) - 4}" text-anchor="middle" class="ax small">${esc(yFmt(acc))}</text>`;
    if (b.label && i % labelEvery === 0) g += `<text x="${x + w / 2}" y="${height - 6}" text-anchor="middle" class="ax">${esc(b.label)}</text>`;
  });
  if (line) g += `<line x1="${P.l}" x2="${width - P.r}" y1="${Y(line.v)}" y2="${Y(line.v)}" stroke="${line.color}" stroke-width="1.6" stroke-dasharray="5 4"/><text x="${width - P.r}" y="${Y(line.v) - 5}" text-anchor="end" class="ax" fill="${line.color}">${esc(line.label)}</text>`;
  return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img">${g}</svg>`;
}

// barre orizzontali a confronto (prima / ultima)
export function pairBars(rows, { fmt = (v) => nf(v, 0), a = 'prima', b = 'ultima' } = {}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r[a] || 0, r[b] || 0]));
  return `<div class="pairbars">${rows.map((r) => `
    <div class="pb-row"><div class="pb-name">${esc(r.nome)}</div><div class="pb-bars">
      <div class="pb pb-a" style="width:${((r[a] || 0) / max) * 100}%" data-tip="${esc(r.tipA || '')}"></div>
      <div class="pb pb-b" style="width:${((r[b] || 0) / max) * 100}%" data-tip="${esc(r.tipB || '')}"></div></div>
      <div class="pb-val">${esc(fmt(r[b]))}${r.delta != null ? `<small class="${r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''}">${r.delta > 0 ? '+' : ''}${nf(r.delta * 100, 0)}%</small>` : ''}</div></div>`).join('')}</div>`;
}

// tooltip condiviso
export function initTips() {
  const tip = document.createElement('div');
  tip.className = 'charttip'; tip.hidden = true;
  document.body.append(tip);
  const show = (el, x, y) => {
    const txt = el.getAttribute('data-tip');
    if (!txt) return;
    tip.textContent = txt; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
    tip.style.top = Math.max(8, y - h - 14) + 'px';
  };
  document.addEventListener('pointerover', (e) => { const el = e.target.closest?.('[data-tip]'); if (el && e.pointerType === 'mouse') show(el, e.clientX, e.clientY); });
  document.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && e.target.closest?.('[data-tip]')) tip.hidden = true; });
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el) show(el, e.clientX, e.clientY); else tip.hidden = true;
  });
  window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
}
