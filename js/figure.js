// Motore di disegno: un omino stilizzato a tratto di matita, posato con angoli
// articolari, con i muscoli di focus colorati. Due viste: laterale e frontale.
// Angoli in gradi: 0 = verso il basso, 90 = avanti (destra), 180 = in alto, -90 = indietro.

export const L = { torso: 50, neck: 5, head: 10, ua: 28, fa: 25, th: 38, sh: 36, ft: 12 };
const W = { ua: 13, fa: 10, th: 18, sh: 13 };
export const COL = {
  ink: '#2a2622', skin: '#f6e7d6', skinFar: '#e6d2bd', inkFar: '#6d655c',
  primary: '#e2492f', secondary: '#f3a64b', metal: '#4a4f57', metalLight: '#9aa1aa',
  pad: '#3b5b7a', padLight: '#5b7c9c', frame: '#8a929c', floor: '#cfc6b8',
};

const rad = (d) => (d * Math.PI) / 180;
const dir = (t) => [Math.sin(rad(t)), Math.cos(rad(t))];
const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];
const f1 = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${f1(p[0])},${f1(p[1])}`;

// ---------- vista laterale ----------
function ik(a, t, l1, l2, bend) {
  let dx = t[0] - a[0], dy = t[1] - a[1];
  let d = Math.hypot(dx, dy);
  const dmax = l1 + l2 - 0.01;
  if (d > dmax) { dx *= dmax / d; dy *= dmax / d; d = dmax; }
  const u = [dx / d, dy / d];
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const al = Math.acos(cosA);
  const rot = (v, g) => [v[0] * Math.cos(g) - v[1] * Math.sin(g), v[0] * Math.sin(g) + v[1] * Math.cos(g)];
  const c1 = add(a, rot(u, al), l1), c2 = add(a, rot(u, -al), l1);
  const score = { front: (p) => p[0], back: (p) => -p[0], down: (p) => p[1], up: (p) => -p[1] }[bend || 'front'];
  const mid = score(c1) >= score(c2) ? c1 : c2;
  return [mid, add(a, [dx / d, dy / d], d)];
}

export function sideJoints(P) {
  const J = {};
  J.hip = P.hip;
  J.shoulder = add(P.hip, dir(P.torso), L.torso);
  const neck = P.neck ?? P.torso;
  J.head = add(J.shoulder, dir(neck), L.neck + L.head);
  J.neckDir = neck;
  for (const s of ['N', 'F']) {
    const us = P['uaScale' + s] ?? 1;
    const fs = P['faScale' + s] ?? 1;
    if (P['hand' + s]) {
      [J['elbow' + s], J['hand' + s]] = ik(J.shoulder, P['hand' + s], L.ua * us, L.fa * fs, P['elbow' + s] || 'down');
    } else {
      J['elbow' + s] = add(J.shoulder, dir(P['ua' + s]), L.ua * us);
      J['hand' + s] = add(J['elbow' + s], dir(P['fa' + s]), L.fa * fs);
    }
    const ts = P['thScale' + s] ?? 1;
    if (P['foot' + s]) {
      [J['knee' + s], J['ankle' + s]] = ik(P.hip, P['foot' + s], L.th * ts, L.sh, P['knee' + s] || 'front');
    } else {
      J['knee' + s] = add(P.hip, dir(P['th' + s]), L.th * ts);
      J['ankle' + s] = add(J['knee' + s], dir(P['sh' + s]), L.sh * (P['shScale' + s] ?? 1));
    }
    J['toe' + s] = add(J['ankle' + s], dir(P['ft' + s] ?? 90), L.ft);
  }
  if (P.anchor) {
    const [j, at] = P.anchor;
    const dx = at[0] - J[j][0], dy = at[1] - J[j][1];
    for (const k of Object.keys(J)) if (Array.isArray(J[k])) J[k] = [J[k][0] + dx, J[k][1] + dy];
  }
  return J;
}

function limb(points, widths, fill, ink) {
  // tratto esterno e riempimento separati, così le giunture restano pulite
  let o = '', i = '';
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k], b = points[k + 1], w = widths[k];
    o += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${ink}" stroke-width="${w + 3.6}" stroke-linecap="round"/>`;
    i += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  return o + i;
}

function segEllipse(a, b, width, t0, t1, side, color, extra = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const d = [dx / len, dy / len], n = [-d[1], d[0]];
  const tm = (t0 + t1) / 2;
  const c = [a[0] + dx * tm + n[0] * side * width * 0.2, a[1] + dy * tm + n[1] * side * width * 0.2];
  const rx = Math.max(3, (len * (t1 - t0)) / 2);
  const ry = width * (side === 0 ? 0.42 : 0.3) + extra;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return `<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(rx)}" ry="${f1(ry)}" transform="rotate(${f1(ang)} ${f1(c[0])} ${f1(c[1])})" fill="${color}" stroke="${COL.ink}" stroke-width="1.1" stroke-opacity=".55"/>`;
}

const circle = (c, r, fill, stroke = COL.ink, sw = 1.1, op = 0.55) =>
  `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${op}"/>`;

function torsoShape(J, fill, ink) {
  const dx = J.shoulder[0] - J.hip[0], dy = J.shoulder[1] - J.hip[1];
  const len = Math.hypot(dx, dy);
  const n = [-dy / len, dx / len];
  // davanti (n positivo) il petto sporge un po' di più; dietro i glutei
  const p = [
    add(J.hip, n, 11), add(add(J.hip, [dx / len, dy / len], len * 0.45), n, 10.5),
    add(add(J.hip, [dx / len, dy / len], len * 0.8), n, 15), add(J.shoulder, n, 11),
    add(J.shoulder, n, -12), add(add(J.hip, [dx / len, dy / len], len * 0.7), n, -13.5),
    add(add(J.hip, [dx / len, dy / len], len * 0.3), n, -10), add(J.hip, n, -13),
  ];
  return `<path d="M${pt(p[0])} C${pt(p[1])} ${pt(p[2])} ${pt(p[3])} Q${pt(add(J.shoulder, [dx / len, dy / len], 7))} ${pt(p[4])} C${pt(p[5])} ${pt(p[6])} ${pt(p[7])} Q${pt(add(J.hip, [dx / len, dy / len], -9))} ${pt(p[0])}Z" fill="${fill}" stroke="${ink}" stroke-width="1.9" stroke-linejoin="round"/>`;
}

const TORSO_M = ['petto', 'addome', 'dorso', 'trapezi', 'lombari', 'glutei', 'abduttori', 'deltoidi', 'deltoidi-ant', 'deltoidi-post'];
function torsoMus(J, list, color) {
  let out = '';
  const T = [J.hip, J.shoulder];
  const dx = J.shoulder[0] - J.hip[0], dy = J.shoulder[1] - J.hip[1];
  const len = Math.hypot(dx, dy), d = [dx / len, dy / len], n = [-d[1], d[0]];
  for (const m of list) {
    if (m === 'petto') out += segEllipse(T[0], T[1], 22, 0.6, 0.93, 1.25, color, 1);
    if (m === 'addome') out += segEllipse(T[0], T[1], 20, 0.12, 0.56, 1.1, color);
    if (m === 'dorso') out += segEllipse(T[0], T[1], 22, 0.36, 0.86, -1.1, color, 1.5);
    if (m === 'trapezi') out += segEllipse(T[0], add(T[1], d, 6), 20, 0.82, 1.0, -0.9, color, 1);
    if (m === 'lombari') out += segEllipse(T[0], T[1], 20, 0.06, 0.4, -1.3, color);
    if (m === 'glutei') out += circle(add(add(J.hip, n, -7.5), d, -1), 10, color);
    if (m === 'abduttori') out += circle(add(J.hip, d, 5), 6.5, color);
  }
  return out;
}
function deltMus(J, list, color) {
  const dx = J.shoulder[0] - J.hip[0], dy = J.shoulder[1] - J.hip[1];
  const len = Math.hypot(dx, dy), d = [dx / len, dy / len], n = [-d[1], d[0]];
  let out = '';
  for (const m of list) {
    if (m === 'deltoidi') out += circle(add(J.shoulder, d, -2.5), 7.5, color);
    if (m === 'deltoidi-ant') out += circle(add(add(J.shoulder, d, -3), n, 3.5), 6.5, color);
    if (m === 'deltoidi-post') out += circle(add(add(J.shoulder, d, -3), n, -4), 6.5, color);
  }
  return out;
}
const ARM_M = ['bicipiti', 'tricipiti', 'avambracci'], LEG_M = ['quadricipiti', 'femorali', 'polpacci'];
function limbMus(J, list, color, s) {
  let out = '';
  const sh = J.shoulder, el = J['elbow' + s], ha = J['hand' + s], hi = J.hip, kn = J['knee' + s], an = J['ankle' + s];
  for (const m of list) {
    if (m === 'bicipiti') out += segEllipse(sh, el, W.ua, 0.22, 0.88, -1, color);
    if (m === 'tricipiti') out += segEllipse(sh, el, W.ua, 0.14, 0.86, 1, color);
    if (m === 'avambracci') out += segEllipse(el, ha, W.fa, 0.08, 0.62, 0, color);
    if (m === 'quadricipiti') out += segEllipse(hi, kn, W.th, 0.12, 0.9, -1, color, 0.5);
    if (m === 'femorali') out += segEllipse(hi, kn, W.th, 0.18, 0.88, 1, color, 0.5);
    if (m === 'polpacci') out += segEllipse(kn, an, W.sh, 0.08, 0.58, 1, color, 0.8);
  }
  return out;
}
const pick = (l, set) => l.filter((m) => set.includes(m));
function mus2(J, sec, prim, set, fn, s) {
  return fn(J, pick(sec, set), COL.secondary, s) + fn(J, pick(prim, set), COL.primary, s);
}

function head(J, fill, ink) {
  const c = J.head;
  const d = dir(J.neckDir), n = [-d[1], d[0]];
  const eye = add(add(c, d, 1.5), n, 5.2);
  const hair = add(c, n, -2);
  return `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${L.head}" fill="${fill}" stroke="${ink}" stroke-width="1.9"/>` +
    `<path d="M${pt(add(add(c, n, -L.head), d, -1))} A ${L.head} ${L.head} 0 0 1 ${pt(add(add(c, d, L.head * 0.95), n, 3))}" fill="none" stroke="${ink}" stroke-width="4.2" stroke-linecap="round" opacity=".85" transform="translate(0,0)"/>` +
    `<circle cx="${f1(eye[0])}" cy="${f1(eye[1])}" r="1.3" fill="${ink}"/>` + (hair ? '' : '');
}

export function drawSide(P, ex, opts = {}) {
  const J = sideJoints(P);
  const ghost = opts.ghost;
  const skin = ghost ? 'none' : COL.skin, skinF = ghost ? 'none' : COL.skinFar;
  const ink = ghost ? '#b4aa9c' : COL.ink, inkF = ghost ? '#c9c0b3' : COL.inkFar;
  const prim = ex.primary || [], sec = ex.secondary || [];
  const hand = (p, fill, k) => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="4.6" fill="${fill}" stroke="${k}" stroke-width="1.8"/>`;
  const M = (set, fn, s) => (ghost ? '' : mus2(J, sec, prim, set, fn, s));
  const farArm = limb([J.shoulder, J.elbowF, J.handF], [W.ua, W.fa], skinF, inkF) + `<g opacity=".75">${M(ARM_M, limbMus, 'F')}</g>` + hand(J.handF, skinF, inkF);
  const farLeg = limb([J.hip, J.kneeF, J.ankleF, J.toeF], [W.th, W.sh, 6], skinF, inkF) + `<g opacity=".75">${M(LEG_M, limbMus, 'F')}</g>`;
  const torso = torsoShape(J, skin, ink) + M(TORSO_M, torsoMus) + head(J, skin, ink);
  const nearLeg = limb([J.hip, J.kneeN, J.ankleN, J.toeN], [W.th, W.sh, 6], skin, ink) + M(LEG_M, limbMus, 'N');
  const nearArm = limb([J.shoulder, J.elbowN, J.handN], [W.ua, W.fa], skin, ink) + M(ARM_M, limbMus, 'N') + hand(J.handN, skin, ink);
  const delts = M(TORSO_M, deltMus);
  const mid = ex.midProps ? ex.midProps(J, ghost) : '';
  const g = ex.farArmFront
    ? farLeg + torso + farArm + nearLeg + mid + nearArm + delts
    : farArm + farLeg + torso + nearLeg + mid + nearArm + delts;
  return { svg: g, J };
}

// ---------- vista frontale ----------
const SW = 19, HW = 9.5;
export function frontJoints(P) {
  const J = { hip: P.hip };
  const up = dir(P.torso ?? 180);
  J.neckBase = add(P.hip, up, L.torso);
  J.head = add(J.neckBase, up, L.neck + L.head);
  for (const [s, sign] of [['R', -1], ['L', 1]]) {
    J['shoulder' + s] = [J.neckBase[0] + sign * SW, J.neckBase[1] + 3 - (P.shrug || 0)];
    J['hipJ' + s] = [P.hip[0] + sign * HW, P.hip[1]];
    const m = (t) => sign * t; // angoli specchiati: positivo = verso l'esterno
    J['elbow' + s] = add(J['shoulder' + s], dir(m(P.ua)), L.ua * (P.uaScale ?? 1));
    J['hand' + s] = add(J['elbow' + s], dir(m(P.fa)), L.fa * (P.faScale ?? 1));
    J['knee' + s] = add(J['hipJ' + s], dir(m(P.th)), L.th * (P.thScale ?? 1));
    J['ankle' + s] = add(J['knee' + s], dir(m(P.sh)), L.sh * (P.shScale ?? 1));
    J['toe' + s] = add(J['ankle' + s], [sign * 0.5, 0.2], 7);
  }
  return J;
}

export function drawFront(P, ex, opts = {}) {
  const J = frontJoints(P);
  const ghost = opts.ghost;
  const skin = ghost ? 'none' : COL.skin, ink = ghost ? '#b4aa9c' : COL.ink;
  const prim = ex.primary || [], sec = ex.secondary || [];
  let g = '';
  for (const s of ['R', 'L']) g += limb([J['hipJ' + s], J['knee' + s], J['ankle' + s], J['toe' + s]], [W.th, W.sh, 6], skin, ink);
  const a = J.shoulderR, b = J.shoulderL, hr = J.hipJR, hl = J.hipJL;
  g += `<path d="M${pt([a[0] - 2, a[1] - 2])} Q${pt([J.neckBase[0], J.neckBase[1] - 4])} ${pt([b[0] + 2, b[1] - 2])} C${pt([b[0] + 3, b[1] + 22])} ${pt([hl[0] + 6, hl[1] - 16])} ${pt([hl[0] + 4, hl[1] + 3])} L${pt([hr[0] - 4, hr[1] + 3])} C${pt([hr[0] - 6, hr[1] - 16])} ${pt([a[0] - 3, a[1] + 22])} ${pt([a[0] - 2, a[1] - 2])}Z" fill="${skin}" stroke="${ink}" stroke-width="1.9" stroke-linejoin="round"/>`;
  g += `<circle cx="${f1(J.head[0])}" cy="${f1(J.head[1])}" r="${L.head}" fill="${skin}" stroke="${ink}" stroke-width="1.9"/>`;
  g += `<path d="M${pt([J.head[0] - 9.5, J.head[1] - 2])} Q${pt([J.head[0], J.head[1] - 16])} ${pt([J.head[0] + 9.5, J.head[1] - 2])}" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" opacity=".85"/>`;
  if (!ghost) {
    g += `<circle cx="${f1(J.head[0] - 3.5)}" cy="${f1(J.head[1] + 1)}" r="1.2" fill="${ink}"/><circle cx="${f1(J.head[0] + 3.5)}" cy="${f1(J.head[1] + 1)}" r="1.2" fill="${ink}"/>`;
    g += frontTorsoMus(J, sec, COL.secondary) + frontTorsoMus(J, prim, COL.primary);
    g += frontLegMus(J, sec, COL.secondary) + frontLegMus(J, prim, COL.primary);
  }
  g += ex.midProps ? ex.midProps(J, ghost) : '';
  for (const s of ['R', 'L']) {
    g += limb([J['shoulder' + s], J['elbow' + s], J['hand' + s]], [W.ua, W.fa], skin, ink);
    if (!ghost) g += frontArmMus(J, s, sec, COL.secondary) + frontArmMus(J, s, prim, COL.primary);
    g += `<circle cx="${f1(J['hand' + s][0])}" cy="${f1(J['hand' + s][1])}" r="4.6" fill="${skin}" stroke="${ink}" stroke-width="1.8"/>`;
  }
  if (!ghost) for (const s of ['R', 'L']) {
    if (sec.some((m) => m.startsWith('deltoidi'))) g += circle(add(J['shoulder' + s], [s === 'R' ? -1 : 1, 0], 1.5), 7.5, COL.secondary);
    if (prim.some((m) => m.startsWith('deltoidi'))) g += circle(add(J['shoulder' + s], [s === 'R' ? -1 : 1, 0], 1.5), 7.5, COL.primary);
  }
  return { svg: g, J };
}
function frontTorsoMus(J, list, c) {
  let o = '';
  const nb = J.neckBase, h = J.hip;
  for (const m of list) {
    if (m === 'petto') for (const s of [-1, 1]) o += `<ellipse cx="${f1(nb[0] + s * 8)}" cy="${f1(nb[1] + 12)}" rx="8.5" ry="6.5" fill="${c}" stroke="${COL.ink}" stroke-width="1.1" stroke-opacity=".55"/>`;
    if (m === 'addome') o += `<rect x="${f1(nb[0] - 6.5)}" y="${f1(nb[1] + 21)}" width="13" height="22" rx="5" fill="${c}" stroke="${COL.ink}" stroke-width="1.1" stroke-opacity=".55"/>`;
    if (m === 'trapezi') for (const s of [-1, 1]) o += `<path d="M${pt([nb[0] + s * 3, nb[1] - 6])} L${pt([nb[0] + s * 14, nb[1] + 1])} L${pt([nb[0] + s * 4, nb[1] + 3])}Z" fill="${c}" stroke="${COL.ink}" stroke-width="1.1" stroke-opacity=".55" stroke-linejoin="round"/>`;
    if (m === 'abduttori') for (const s of [-1, 1]) o += `<ellipse cx="${f1(h[0] + s * 13)}" cy="${f1(h[1] - 1)}" rx="4.5" ry="9" fill="${c}" stroke="${COL.ink}" stroke-width="1.1" stroke-opacity=".55"/>`;
  }
  return o;
}
function frontLegMus(J, list, c) {
  let o = '';
  for (const s of ['R', 'L']) for (const m of list) {
    if (m === 'quadricipiti') o += segEllipse(J['hipJ' + s], J['knee' + s], W.th, 0.15, 0.88, 0, c);
    if (m === 'abduttori') o += segEllipse(J['hipJ' + s], J['knee' + s], W.th, 0.0, 0.45, s === 'R' ? 1 : -1, c);
    if (m === 'polpacci') o += segEllipse(J['knee' + s], J['ankle' + s], W.sh, 0.1, 0.55, s === 'R' ? 1 : -1, c);
  }
  return o;
}
function frontArmMus(J, s, list, c) {
  let o = '';
  for (const m of list) {
    if (m === 'bicipiti') o += segEllipse(J['shoulder' + s], J['elbow' + s], W.ua, 0.25, 0.85, 0, c);
    if (m === 'avambracci') o += segEllipse(J['elbow' + s], J['hand' + s], W.fa, 0.1, 0.6, 0, c);
  }
  return o;
}

// ---------- attrezzi ----------
export const prop = {
  floor: (y = 190) => `<line x1="8" y1="${y}" x2="232" y2="${y}" stroke="${COL.floor}" stroke-width="2.5" stroke-linecap="round"/>`,
  plate: (p, r = 15, ghost) => ghost ? '' : `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${r}" fill="${COL.metal}" stroke="${COL.ink}" stroke-width="1.6"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${r * 0.62}" fill="none" stroke="${COL.metalLight}" stroke-width="1.2"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.4" fill="${COL.metalLight}"/>`,
  db: (p, ghost, r = 6.5) => ghost ? '' : `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${r}" fill="${COL.metal}" stroke="${COL.ink}" stroke-width="1.5"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${r * 0.45}" fill="${COL.metalLight}"/>`,
  dbSide: (p, ang, ghost, len = 20) => {
    if (ghost) return '';
    const d = dir(ang), a = add(p, d, -len / 2), b = add(p, d, len / 2);
    const plateAt = (q) => { const n = [-d[1], d[0]]; const u = add(q, n, 6.5), v = add(q, n, -6.5); return `<line x1="${f1(u[0])}" y1="${f1(u[1])}" x2="${f1(v[0])}" y2="${f1(v[1])}" stroke="${COL.ink}" stroke-width="8" stroke-linecap="round"/><line x1="${f1(u[0])}" y1="${f1(u[1])}" x2="${f1(v[0])}" y2="${f1(v[1])}" stroke="${COL.metal}" stroke-width="5" stroke-linecap="round"/>`; };
    return `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${COL.metal}" stroke-width="3"/>` + plateAt(a) + plateAt(b);
  },
  rect: (x, y, w, h, fill = COL.pad, rx = 3) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${rx}" fill="${fill}" stroke="${COL.ink}" stroke-width="1.6"/>`,
  line: (a, b, w = 3, c = COL.frame) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`,
  bench: (x1, x2, top, floor = 190) => prop.line([x1 + 8, top + 5], [x1 + 4, floor], 4) + prop.line([x2 - 8, top + 5], [x2 - 4, floor], 4) + prop.rect(x1, top, x2 - x1, 7),
  // schienale inclinato: parte da p (in basso) con angolo e lunghezza
  pad: (p, ang, len, th = 7, fill = COL.pad) => {
    const d = dir(ang), n = [-d[1], d[0]];
    const a = p, b = add(p, d, len), c = add(b, n, th), e = add(a, n, th);
    return `<path d="M${pt(a)} L${pt(b)} L${pt(c)} L${pt(e)}Z" fill="${fill}" stroke="${COL.ink}" stroke-width="1.6" stroke-linejoin="round"/>`;
  },
  bar: (p) => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="3.4" fill="${COL.metalLight}" stroke="${COL.ink}" stroke-width="1.4"/>`,
  cable: (a, b) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${COL.ink}" stroke-width="1.2" stroke-dasharray="0"/>`,
};

// ---------- rendering ----------
const lerp = (a, b, t) => a + (b - a) * t;
export function lerpPose(A, B, t) {
  const o = {};
  for (const k of Object.keys(A)) {
    if (Array.isArray(A[k]) && typeof A[k][0] === 'number' && Array.isArray(B[k])) o[k] = [lerp(A[k][0], B[k][0], t), lerp(A[k][1], B[k][1], t)];
    else if (typeof A[k] === 'number') o[k] = lerp(A[k], B[k] ?? A[k], t);
    else o[k] = A[k];
  }
  for (const k of Object.keys(B)) if (!(k in o)) o[k] = B[k];
  return o;
}

export function poseSVG(ex, t, opts = {}) {
  const P = lerpPose(ex.A, ex.B, t);
  const draw = ex.view === 'front' ? drawFront : drawSide;
  let ghost = '';
  if (opts.ghost) {
    const G = draw(ex.A, ex, { ghost: true });
    ghost = `<g opacity=".55" stroke-dasharray="3 3">${G.svg}</g>`;
  }
  const fig = draw(P, ex);
  const back = ex.back ? ex.back(fig.J) : '';
  const front = ex.front ? ex.front(fig.J) : '';
  return `${prop.floor(ex.floor ?? 190)}${back}${ghost}<g filter="url(#pencil)">${fig.svg}</g>${front}`;
}

export const DEFS = `<defs><filter id="pencil" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;

export function figureSVG(ex, t = 1, opts = {}) {
  return `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${opts.label || ''}">${DEFS}<rect width="240" height="200" fill="#fbf7f0"/>${poseSVG(ex, t, opts)}</svg>`;
}
