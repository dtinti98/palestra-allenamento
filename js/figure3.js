// Motore di disegno "stile 3": atleta vettoriale a colori (pelle ombreggiata, pantaloncini,
// scarpe, capelli), muscoli disegnati uno per uno con fibre, principale rosso e secondari arancio.
// Usa le stesse pose di exercises.js (sideJoints / frontJoints di figure.js).
import { L, prop, COL, sideJoints, frontJoints, lerpPose } from './figure.js';

export const C3 = {
  skin: '#e9b089', skinL: '#f4c9a6', skinD: '#c98a63', skinFar: '#d39a73', line: '#7d4a2f', def: '#a8693f',
  hair: '#2b2119', shorts: '#262a31', shortsFar: '#3a3f48', stripe: '#19a7a1', shoe: '#f6f6f6', sole: '#9aa3ad', shoeLine: '#6b7480',
  red: '#e2492f', redD: '#8f1c0c', ora: '#f3a64b', oraD: '#9a5300', arrow: '#f6a623', arrowD: '#d9860b', bg: '#ffffff',
};
const r1 = (n) => Math.round(n * 10) / 10;
const P_ = (p) => `${r1(p[0])},${r1(p[1])}`;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const addv = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const dir = (t) => [Math.sin((t * Math.PI) / 180), Math.cos((t * Math.PI) / 180)];
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// segmento rastremato: trapezio + cerchi alle estremità. Ritorna contorno (o) e riempimento (f)
function capParts(a, b, wa, wb, fill, stroke = C3.line, sw = 1.2) {
  const piece = (ra, rb, col) => {
    const d = norm(sub(b, a)), n = [-d[1], d[0]];
    return `<path d="M${P_(addv(a, n, ra))} L${P_(addv(b, n, rb))} L${P_(addv(b, n, -rb))} L${P_(addv(a, n, -ra))}Z" fill="${col}"/>` +
      `<circle cx="${r1(a[0])}" cy="${r1(a[1])}" r="${r1(ra)}" fill="${col}"/><circle cx="${r1(b[0])}" cy="${r1(b[1])}" r="${r1(rb)}" fill="${col}"/>`;
  };
  return { o: stroke === 'none' ? '' : piece(wa / 2 + sw, wb / 2 + sw, stroke), f: piece(wa / 2, wb / 2, fill) };
}
function capsule(a, b, wa, wb, fill, stroke = C3.line, sw = 1.2) { const p = capParts(a, b, wa, wb, fill, stroke, sw); return p.o + p.f; }
function chain(parts) { return parts.map((p) => p.o).join('') + parts.map((p) => p.f).join(''); }
// fuso muscolare lungo un segmento: da t0 a t1, spostato di side*(w) sulla normale
function belly(a, b, t0, t1, w, off, cls) {
  const d = norm(sub(b, a)), n = [-d[1], d[0]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const c = addv(lerp2(a, b, (t0 + t1) / 2), n, off);
  const rx = Math.max(2, (len * (t1 - t0)) / 2), ry = w / 2;
  return `<ellipse class="${cls}" cx="${r1(c[0])}" cy="${r1(c[1])}" rx="${r1(rx)}" ry="${r1(ry)}" transform="rotate(${r1(Math.atan2(d[1], d[0]) * 180 / Math.PI)} ${r1(c[0])} ${r1(c[1])})"/>`;
}
const mcls = (m, prim, sec) => (prim.includes(m) ? 'mp' : sec.includes(m) ? 'ms' : 'mb');

// ---------------- vista laterale ----------------
const WS = { ua: [11.5, 9], fa: [9, 6.5], th: [18, 12.5], sh: [12.5, 8] };

function shoeSide(ankle, toe, far) {
  const d = norm(sub(toe, ankle)), n = [-d[1], d[0]];
  const heel = addv(ankle, d, -4.5), tip = addv(toe, d, 2.5);
  const sole = (k) => addv(k, n, 3.6);
  const top = (k) => addv(k, n, -4.2);
  const fill = far ? '#e4e4e4' : C3.shoe;
  return `<path d="M${P_(sole(heel))} L${P_(sole(tip))} Q${P_(addv(tip, d, 3))} ${P_(addv(tip, n, -1.5))} L${P_(top(lerp2(ankle, toe, 0.45)))} L${P_(top(addv(ankle, d, -1)))} Q${P_(addv(top(heel), d, -1.5))} ${P_(sole(heel))}Z" fill="${fill}" stroke="${C3.shoeLine}" stroke-width="1"/>` +
    `<line x1="${r1(sole(heel)[0])}" y1="${r1(sole(heel)[1])}" x2="${r1(sole(tip)[0])}" y2="${r1(sole(tip)[1])}" stroke="${C3.sole}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<line x1="${r1(lerp2(ankle, toe, 0.15)[0])}" y1="${r1(lerp2(ankle, toe, 0.15)[1])}" x2="${r1(lerp2(ankle, toe, 0.6)[0])}" y2="${r1(lerp2(ankle, toe, 0.6)[1])}" stroke="${C3.stripe}" stroke-width="1.6" stroke-linecap="round"/>`;
}

function handSide(h, el, fill) {
  const d = norm(sub(h, el)), n = [-d[1], d[0]];
  const c = addv(h, d, 1.5);
  return `<ellipse cx="${r1(c[0])}" cy="${r1(c[1])}" rx="5.2" ry="4.4" transform="rotate(${r1(Math.atan2(d[1], d[0]) * 180 / Math.PI)} ${r1(c[0])} ${r1(c[1])})" fill="${fill}" stroke="${C3.line}" stroke-width="1.1"/>` +
    `<path d="M${P_(addv(c, n, 1.5))} L${P_(addv(addv(c, n, 1.5), d, 3.5))}" stroke="${C3.def}" stroke-width=".8" fill="none"/>`;
}

function headSide(J) {
  const c = J.head, d = dir(J.neckDir ?? 180), n = [-d[1], d[0]]; // d = verso l'alto della testa, n = avanti
  const R = L.head;
  const face = addv(c, n, R * 0.95);
  const hairPath = `M${P_(addv(addv(c, n, -R * 1.02), d, -2))} A${R},${R} 0 0 1 ${P_(addv(addv(c, d, R * 0.98), n, R * 0.5))} Q${P_(addv(addv(c, d, R * 0.55), n, R * 0.55))} ${P_(addv(addv(c, d, R * 0.45), n, -R * 0.1))} Q${P_(addv(addv(c, n, -R * 0.4), d, -R * 0.1))} ${P_(addv(addv(c, n, -R * 0.7), d, -R * 0.55))}Z`;
  const ear = addv(addv(c, n, -R * 0.15), d, -1);
  const eye = addv(addv(c, n, R * 0.55), d, R * 0.12);
  const brow1 = addv(addv(c, n, R * 0.4), d, R * 0.32), brow2 = addv(addv(c, n, R * 0.78), d, R * 0.3);
  const nose = addv(addv(c, n, R * 1.08), d, -R * 0.05);
  return `<circle cx="${r1(c[0])}" cy="${r1(c[1])}" r="${R}" fill="${C3.skin}" stroke="${C3.line}" stroke-width="1.3"/>` +
    `<path d="M${P_(addv(face, d, R * 0.15))} L${P_(nose)} L${P_(addv(addv(face, d, -R * 0.2), n, -0.5))}" fill="${C3.skin}" stroke="${C3.line}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="${hairPath}" fill="${C3.hair}"/>` +
    `<ellipse cx="${r1(ear[0])}" cy="${r1(ear[1])}" rx="2" ry="2.8" fill="${C3.skin}" stroke="${C3.line}" stroke-width=".9"/>` +
    `<circle cx="${r1(eye[0])}" cy="${r1(eye[1])}" r="1.1" fill="${C3.hair}"/>` +
    `<path d="M${P_(brow1)} L${P_(brow2)}" stroke="${C3.hair}" stroke-width="1.3" stroke-linecap="round"/>`;
}

function torsoSide(J) {
  const v = sub(J.shoulder, J.hip), len = Math.hypot(...v), d = norm(v), n = [-d[1], d[0]];
  const at = (t, k) => addv(addv(J.hip, d, len * t), n, k);
  const p = [at(0, 11), at(0.45, 10.5), at(0.8, 15), at(1, 11), at(1, -12), at(0.7, -13.5), at(0.3, -10), at(0, -13)];
  return { d, n, len, at, path: `M${P_(p[0])} C${P_(p[1])} ${P_(p[2])} ${P_(p[3])} Q${P_(addv(J.shoulder, d, 7))} ${P_(p[4])} C${P_(p[5])} ${P_(p[6])} ${P_(p[7])} Q${P_(addv(J.hip, d, -9))} ${P_(p[0])}Z` };
}

function torsoMuscles(J, T, prim, sec) {
  const { at, d, n } = T;
  const q = (m, path) => `<path class="${mcls(m, prim, sec)}" d="${path}"/>`;
  let o = '';
  // petto (davanti in alto)
  o += q('petto', `M${P_(at(0.93, 12))} Q${P_(at(0.86, 18))} ${P_(at(0.68, 15))} Q${P_(at(0.62, 9))} ${P_(at(0.7, 5))} L${P_(at(0.93, 6))}Z`);
  // addome: colonna con segmenti
  o += q('addome', `M${P_(at(0.62, 11.5))} Q${P_(at(0.35, 11.5))} ${P_(at(0.1, 10))} L${P_(at(0.1, 4))} L${P_(at(0.62, 5))}Z`);
  for (const t of [0.48, 0.34, 0.21]) o += `<path class="ml" d="M${P_(at(t, 11))} L${P_(at(t, 5))}"/>`;
  // obliqui/dentato (fascia laterale, parte dell'addome)
  o += q('addome', `M${P_(at(0.6, 3))} Q${P_(at(0.35, 4))} ${P_(at(0.12, 2.5))} L${P_(at(0.18, -2))} Q${P_(at(0.4, -1))} ${P_(at(0.58, -1.5))}Z`);
  // dorsali (dietro, centro)
  o += q('dorso', `M${P_(at(0.85, -9))} Q${P_(at(0.62, -16))} ${P_(at(0.38, -11))} L${P_(at(0.42, -4))} Q${P_(at(0.62, -5))} ${P_(at(0.8, -3))}Z`);
  // lombari
  o += q('lombari', `M${P_(at(0.38, -11))} Q${P_(at(0.2, -10.5))} ${P_(at(0.06, -12))} L${P_(at(0.08, -6))} L${P_(at(0.38, -5))}Z`);
  // trapezi (dietro collo / spalla alta)
  o += q('trapezi', `M${P_(addv(J.shoulder, d, 6))} Q${P_(at(1.02, -10))} ${P_(at(0.86, -11))} L${P_(at(0.86, -5))} Q${P_(at(0.98, -2))} ${P_(addv(J.shoulder, d, 6))}Z`);
  // glutei
  o += q('glutei', `M${P_(at(0.14, -11))} Q${P_(at(0.02, -19))} ${P_(at(-0.16, -12))} Q${P_(at(-0.12, -4))} ${P_(at(0.04, -4))}Z`);
  // abduttori (gluteo medio, lato anca)
  o += q('abduttori', `M${P_(at(0.18, -3))} Q${P_(at(0.1, -9))} ${P_(at(0.04, -4))} Q${P_(at(0.06, 0))} ${P_(at(0.18, -3))}Z`);
  return o;
}

function deltoid(J, prim, sec) {
  const v = sub(J.shoulder, J.hip), d = norm(v), n = [-d[1], d[0]];
  const s = addv(J.shoulder, d, -3);
  const e = J.elbowN;
  const ad = norm(sub(e, J.shoulder)), an = [-ad[1], ad[0]];
  const tip = addv(J.shoulder, ad, 15);
  const cls = (m) => mcls(m, prim, sec);
  const anyD = prim.includes('deltoidi') ? 'mp' : sec.includes('deltoidi') ? 'ms' : null;
  const ant = prim.includes('deltoidi-ant') ? 'mp' : sec.includes('deltoidi-ant') ? 'ms' : (anyD === 'mp' ? 'ms' : anyD) || 'mb';
  const post = prim.includes('deltoidi-post') ? 'mp' : sec.includes('deltoidi-post') ? 'ms' : (anyD === 'mp' ? 'ms' : anyD) || 'mb';
  const mid = anyD || cls('deltoidi');
  const front = addv(s, n, 7), back = addv(s, n, -7);
  return `<path class="${post}" d="M${P_(back)} Q${P_(addv(back, ad, 9))} ${P_(tip)} L${P_(s)}Z"/>` +
    `<path class="${ant}" d="M${P_(front)} Q${P_(addv(front, ad, 9))} ${P_(tip)} L${P_(s)}Z"/>` +
    `<path class="${mid}" d="M${P_(addv(s, n, -3.5))} Q${P_(addv(addv(s, ad, 6), an, 0))} ${P_(tip)} Q${P_(addv(s, ad, 6))} ${P_(addv(s, n, 3.5))} Q${P_(addv(s, d, 4))} ${P_(addv(s, n, -3.5))}Z"/>`;
}

function armMuscles(J, s, prim, sec) {
  const sh = J.shoulder, el = J['elbow' + s], ha = J['hand' + s];
  // segno della normale "anteriore" del braccio: verso dove si piega il gomito
  const ad = norm(sub(el, sh)), an = [-ad[1], ad[0]];
  const fd = norm(sub(ha, el));
  const bend = Math.sign(an[0] * fd[0] + an[1] * fd[1]) || 1;
  return belly(sh, el, 0.28, 0.92, 6.2, 2.2 * bend, mcls('bicipiti', prim, sec)) +
    belly(sh, el, 0.2, 0.9, 6.4, -2.4 * bend, mcls('tricipiti', prim, sec)) +
    belly(el, ha, 0.05, 0.62, 5.6, 0, mcls('avambracci', prim, sec));
}
function legMuscles(J, s, prim, sec) {
  const hi = J.hip, kn = J['knee' + s], an = J['ankle' + s], toe = J['toe' + s];
  const td = norm(sub(kn, hi)), tn = [-td[1], td[0]];
  const sd = norm(sub(an, kn));
  // davanti della coscia: lato opposto a quello in cui si piega il ginocchio (il polpaccio va indietro)
  const bk = Math.sign(tn[0] * sd[0] + tn[1] * sd[1]);
  const fwd = bk === 0 ? 1 : -bk;
  const footDir = norm(sub(toe, an));
  const sn = [-sd[1], sd[0]];
  const back = Math.sign(sn[0] * footDir[0] + sn[1] * footDir[1]) === 1 ? -1 : 1; // polpaccio opposto alla punta
  return belly(hi, kn, 0.12, 0.92, 10, 3.2 * fwd, mcls('quadricipiti', prim, sec)) +
    belly(hi, kn, 0.16, 0.86, 8, -3.6 * fwd, mcls('femorali', prim, sec)) +
    belly(kn, an, 0.08, 0.6, 7.5, 2.4 * back, mcls('polpacci', prim, sec));
}

export function drawSide3(P, ex) {
  const J = sideJoints(P);
  const prim = ex.primary || [], sec = ex.secondary || [];
  const T = torsoSide(J);
  const leg = (s, far) => {
    const fill = far ? C3.skinFar : C3.skin;
    return chain([capParts(J.hip, J['knee' + s], WS.th[0], WS.th[1], fill), capParts(J['knee' + s], J['ankle' + s], WS.sh[0], WS.sh[1], fill)]) +
      `<g opacity="${far ? 0.75 : 1}">${legMuscles(J, s, prim, sec)}</g>` + shoeSide(J['ankle' + s], J['toe' + s], far) +
      // pantaloncini sulla coscia
      capsule(addv(J.hip, norm(sub(J['knee' + s], J.hip)), -3), lerp2(J.hip, J['knee' + s], 0.42), 20, 18.5, far ? C3.shortsFar : C3.shorts, '#15181c', 1) +
      capsule(lerp2(J.hip, J['knee' + s], 0.05), lerp2(J.hip, J['knee' + s], 0.4), 2.4, 2.4, C3.stripe, 'none', 0);
  };
  const arm = (s, far) => {
    const fill = far ? C3.skinFar : C3.skin;
    return chain([capParts(J.shoulder, J['elbow' + s], WS.ua[0], WS.ua[1], fill), capParts(J['elbow' + s], J['hand' + s], WS.fa[0], WS.fa[1], fill)]) +
      `<g opacity="${far ? 0.75 : 1}">${armMuscles(J, s, prim, sec)}</g>` + handSide(J['hand' + s], J['elbow' + s], fill);
  };
  const torso = `<path d="${T.path}" fill="${C3.skin}" stroke="${C3.line}" stroke-width="1.3" stroke-linejoin="round"/>` +
    torsoMuscles(J, T, prim, sec) +
    // fascia dei pantaloncini sul bacino
    `<path d="M${P_(T.at(0.16, 12))} L${P_(T.at(0.16, -13))} Q${P_(T.at(-0.05, -19))} ${P_(T.at(-0.2, -12))} L${P_(T.at(-0.2, 12))}Z" fill="${C3.shorts}" stroke="#15181c" stroke-width="1"/>` +
    `<path d="M${P_(T.at(0.16, 12))} L${P_(T.at(0.16, -13))}" stroke="#15181c" stroke-width="3"/>` +
    // collo
    capsule(J.shoulder, addv(J.shoulder, dir(J.neckDir ?? 180), 8), 9, 8, C3.skin) + headSide(J);
  const mid = ex.midProps ? ex.midProps(J) : '';
  const g = ex.farArmFront
    ? leg('F', true) + torso + arm('F', true) + leg('N') + mid + arm('N') + deltoid(J, prim, sec)
    : arm('F', true) + leg('F', true) + torso + leg('N') + mid + arm('N') + deltoid(J, prim, sec);
  return { svg: g, J };
}

// ---------------- vista frontale ----------------
const SW = 19, HW = 9.5;
export function drawFront3(P, ex) {
  const J = frontJoints(P);
  const prim = ex.primary || [], sec = ex.secondary || [];
  const cls = (m) => mcls(m, prim, sec);
  const a = J.shoulderR, b = J.shoulderL, hr = J.hipJR, hl = J.hipJL, nb = J.neckBase;
  let g = '';
  // gambe
  for (const s of ['R', 'L']) {
    const sg = s === 'R' ? -1 : 1;
    g += chain([capParts(J['hipJ' + s], J['knee' + s], 17, 12.5, C3.skin), capParts(J['knee' + s], J['ankle' + s], 12, 8, C3.skin)]);
    g += belly(J['hipJ' + s], J['knee' + s], 0.14, 0.9, 10.5, 0, cls('quadricipiti'));
    g += belly(J['hipJ' + s], J['knee' + s], 0.62, 0.95, 4.5, -3.6 * sg * -1, cls('quadricipiti'));
    g += belly(J['hipJ' + s], J['knee' + s], 0.1, 0.5, 4.2, 5.5 * sg, cls('abduttori'));
    g += belly(J['knee' + s], J['ankle' + s], 0.08, 0.55, 5, 2.8 * sg, cls('polpacci'));
    g += belly(J['knee' + s], J['ankle' + s], 0.08, 0.55, 4, -2.6 * sg, cls('polpacci'));
    // scarpa frontale
    const an = J['ankle' + s];
    g += `<path d="M${P_([an[0] - 6, an[1] + 1])} L${P_([an[0] + 6, an[1] + 1])} L${P_([an[0] + 7 + sg * 3, an[1] + 9])} L${P_([an[0] - 7 + sg * 3, an[1] + 9])}Z" fill="${C3.shoe}" stroke="${C3.shoeLine}" stroke-width="1"/><line x1="${r1(an[0] - 7 + sg * 3)}" y1="${r1(an[1] + 9)}" x2="${r1(an[0] + 7 + sg * 3)}" y2="${r1(an[1] + 9)}" stroke="${C3.sole}" stroke-width="2.4" stroke-linecap="round"/>`;
    // pantaloncini
    g += capsule([J['hipJ' + s][0], J['hipJ' + s][1] - 3], lerp2(J['hipJ' + s], J['knee' + s], 0.4), 19, 17.5, C3.shorts, '#15181c', 1);
  }
  // busto
  g += `<path d="M${P_([a[0] - 2, a[1] - 2])} Q${P_([nb[0], nb[1] - 4])} ${P_([b[0] + 2, b[1] - 2])} C${P_([b[0] + 3, b[1] + 22])} ${P_([hl[0] + 6, hl[1] - 16])} ${P_([hl[0] + 4, hl[1] + 3])} L${P_([hr[0] - 4, hr[1] + 3])} C${P_([hr[0] - 6, hr[1] - 16])} ${P_([a[0] - 3, a[1] + 22])} ${P_([a[0] - 2, a[1] - 2])}Z" fill="${C3.skin}" stroke="${C3.line}" stroke-width="1.3" stroke-linejoin="round"/>`;
  // trapezi, pettorali, addome a quadretti, obliqui
  for (const sg of [-1, 1]) {
    g += `<path class="${cls('trapezi')}" d="M${P_([nb[0] + sg * 4, nb[1] - 7])} Q${P_([nb[0] + sg * 10, nb[1] - 1])} ${P_([nb[0] + sg * 17, nb[1] + 1])} L${P_([nb[0] + sg * 5, nb[1] + 2])}Z"/>`;
    g += `<path class="${cls('petto')}" d="M${P_([nb[0] + sg * 1, nb[1] + 3])} L${P_([nb[0] + sg * 15, nb[1] + 4])} Q${P_([nb[0] + sg * 18, nb[1] + 12])} ${P_([nb[0] + sg * 14, nb[1] + 17])} Q${P_([nb[0] + sg * 7, nb[1] + 20])} ${P_([nb[0] + sg * 1, nb[1] + 18])}Z"/>`;
    for (let k = 0; k < 3; k++) g += `<rect class="${cls('addome')}" x="${r1(nb[0] + (sg < 0 ? -6.6 : 0.6))}" y="${r1(nb[1] + 21 + k * 7.2)}" width="6" height="6.4" rx="2"/>`;
    g += `<path class="${cls('addome')}" d="M${P_([nb[0] + sg * 7.5, nb[1] + 21])} Q${P_([nb[0] + sg * 13, nb[1] + 30])} ${P_([nb[0] + sg * 12, nb[1] + 44])} L${P_([nb[0] + sg * 7.5, nb[1] + 43])}Z"/>`;
  }
  g += `<path d="M${P_([hr[0] - 4, hr[1] - 6])} L${P_([hl[0] + 4, hl[1] - 6])} L${P_([hl[0] + 4, hl[1] + 5])} L${P_([hr[0] - 4, hr[1] + 5])}Z" fill="${C3.shorts}" stroke="#15181c" stroke-width="1"/>`;
  // collo e testa
  g += capsule([nb[0], nb[1] + 2], [nb[0], nb[1] - 8], 9, 8, C3.skin);
  const h = J.head, R = L.head;
  g += `<ellipse cx="${r1(h[0] - R)}" cy="${r1(h[1] + 1)}" rx="1.8" ry="3" fill="${C3.skin}" stroke="${C3.line}" stroke-width=".9"/><ellipse cx="${r1(h[0] + R)}" cy="${r1(h[1] + 1)}" rx="1.8" ry="3" fill="${C3.skin}" stroke="${C3.line}" stroke-width=".9"/>`;
  g += `<circle cx="${r1(h[0])}" cy="${r1(h[1])}" r="${R}" fill="${C3.skin}" stroke="${C3.line}" stroke-width="1.3"/>`;
  g += `<path d="M${P_([h[0] - R + 0.5, h[1] - 1])} Q${P_([h[0] - R, h[1] - R - 3])} ${P_([h[0], h[1] - R - 1.5])} Q${P_([h[0] + R, h[1] - R - 3])} ${P_([h[0] + R - 0.5, h[1] - 1])} Q${P_([h[0] + 4, h[1] - 6])} ${P_([h[0], h[1] - 6])} Q${P_([h[0] - 5, h[1] - 6])} ${P_([h[0] - R + 0.5, h[1] - 1])}Z" fill="${C3.hair}"/>`;
  g += `<path d="M${P_([h[0] - 5.5, h[1] - 2.5])} L${P_([h[0] - 2, h[1] - 3])} M${P_([h[0] + 2, h[1] - 3])} L${P_([h[0] + 5.5, h[1] - 2.5])}" stroke="${C3.hair}" stroke-width="1.2" stroke-linecap="round"/>`;
  g += `<circle cx="${r1(h[0] - 3.5)}" cy="${r1(h[1] + 0.5)}" r="1" fill="${C3.hair}"/><circle cx="${r1(h[0] + 3.5)}" cy="${r1(h[1] + 0.5)}" r="1" fill="${C3.hair}"/>`;
  g += `<path d="M${P_([h[0], h[1] + 1])} L${P_([h[0] - 1, h[1] + 4])} L${P_([h[0] + 1, h[1] + 4.3])}" fill="none" stroke="${C3.def}" stroke-width=".9"/><path d="M${P_([h[0] - 2.5, h[1] + 6.5])} Q${P_([h[0], h[1] + 7.5])} ${P_([h[0] + 2.5, h[1] + 6.5])}" fill="none" stroke="#8c4a36" stroke-width="1"/>`;
  g += ex.midProps ? ex.midProps(J) : '';
  // braccia
  for (const s of ['R', 'L']) {
    const sg = s === 'R' ? -1 : 1;
    g += chain([capParts(J['shoulder' + s], J['elbow' + s], 11.5, 9, C3.skin), capParts(J['elbow' + s], J['hand' + s], 9, 6.5, C3.skin)]);
    g += belly(J['shoulder' + s], J['elbow' + s], 0.25, 0.9, 6, 0, cls('bicipiti'));
    g += belly(J['shoulder' + s], J['elbow' + s], 0.2, 0.88, 3.4, 4 * sg * (J['elbow' + s][1] > J['shoulder' + s][1] ? 1 : -1), cls('tricipiti'));
    g += belly(J['elbow' + s], J['hand' + s], 0.05, 0.6, 5.4, 0, cls('avambracci'));
    g += handSide(J['hand' + s], J['elbow' + s], C3.skin);
    // deltoide frontale: cappuccio sulla spalla orientato lungo il braccio
    const sp = J['shoulder' + s], ad = norm(sub(J['elbow' + s], sp));
    const anyD = prim.some((m) => m.startsWith('deltoidi')) ? 'mp' : sec.some((m) => m.startsWith('deltoidi')) ? 'ms' : 'mb';
    const c = addv(addv(sp, ad, 4.5), [sg, 0], 1.5);
    g += `<ellipse class="${anyD}" cx="${r1(c[0])}" cy="${r1(c[1])}" rx="9" ry="7" transform="rotate(${r1(Math.atan2(ad[1], ad[0]) * 180 / Math.PI)} ${r1(c[0])} ${r1(c[1])})"/>`;
  }
  return { svg: g, J };
}

export const DEFS3 = `<defs><pattern id="f3r" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(70)"><path d="M0,1.5H3" stroke="${C3.redD}" stroke-opacity=".35" stroke-width=".7"/></pattern>` +
  `<pattern id="f3o" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(-40)"><path d="M0,1.5H3" stroke="${C3.oraD}" stroke-opacity=".3" stroke-width=".7"/></pattern>` +
  `<style>.mp{fill:${C3.red};stroke:${C3.redD};stroke-width:.8;stroke-linejoin:round}.ms{fill:${C3.ora};stroke:${C3.oraD};stroke-width:.7;stroke-linejoin:round}` +
  `.mb{fill:${C3.skinD};fill-opacity:.12;stroke:${C3.def};stroke-width:.55;stroke-opacity:.5;stroke-linejoin:round}.ml{fill:none;stroke:${C3.def};stroke-width:.6;stroke-opacity:.7}</style></defs>`;

export function poseSVG3(ex, t) {
  const P = lerpPose(ex.A, ex.B, t);
  const fig = ex.view === 'front' ? drawFront3(P, ex) : drawSide3(P, ex);
  const back = ex.back ? ex.back(fig.J) : '';
  const front = ex.front ? ex.front(fig.J) : '';
  return { svg: `${prop.floor(ex.floor ?? 190)}${back}${fig.svg}${front}`, J: fig.J };
}

// traiettoria del punto che si muove di più tra partenza e arrivo
function motionPaths(ex) {
  const side = ex.view !== 'front';
  const keys = side ? ['handN', 'hip', 'ankleN', 'head', 'shoulder', 'kneeN'] : ['handR', 'handL', 'hip', 'kneeR', 'kneeL', 'head'];
  const jf = side ? sideJoints : frontJoints;
  const N = 14, samples = [];
  for (let i = 0; i <= N; i++) samples.push(jf(lerpPose(ex.A, ex.B, i / N)));
  const disp = (k) => Math.hypot(samples[N][k][0] - samples[0][k][0], samples[N][k][1] - samples[0][k][1]);
  const ranked = keys.filter((k) => samples[0][k]).sort((a, b) => disp(b) - disp(a));
  let pick = [ranked[0]];
  if (!side && (ranked[0] === 'handR' || ranked[0] === 'handL')) pick = ['handR', 'handL'];
  if (!side && (ranked[0] === 'kneeR' || ranked[0] === 'kneeL')) pick = ['kneeR', 'kneeL'];
  if (disp(pick[0]) < 6) return [];
  return pick.map((k) => samples.map((S) => S[k]));
}
function arrowPath(pts, off = 0) {
  // spostata verso l'esterno della curva e accorciata alle estremità
  const n = pts.length;
  const a = pts[0], b = pts[n - 1];
  const chord = norm(sub(b, a)), cn = [-chord[1], chord[0]];
  const mid = pts[Math.floor(n / 2)], bulge = (mid[0] - (a[0] + b[0]) / 2) * cn[0] + (mid[1] - (a[1] + b[1]) / 2) * cn[1];
  const s = bulge >= 0 ? 1 : -1;
  const q = pts.map((p) => addv(p, cn, s * off));
  const use = q.slice(2, n - 1);
  if (use.length < 2) return '';
  const tipA = use[use.length - 2], tip = use[use.length - 1];
  const d = norm(sub(tip, tipA)), nn = [-d[1], d[0]];
  const end = addv(tip, d, -5);
  let path = `M${P_(use[0])}`;
  for (let i = 1; i < use.length - 1; i++) path += ` L${P_(use[i])}`;
  path += ` L${P_(end)}`;
  return `<path d="${path}" fill="none" stroke="${C3.arrow}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>` +
    `<path d="M${P_(addv(tip, d, 3))} L${P_(addv(end, nn, 6))} L${P_(addv(end, nn, -6))}Z" fill="${C3.arrow}" stroke="${C3.arrowD}" stroke-width=".8" stroke-linejoin="round"/>`;
}

// figura singola (per animazione): stessa firma di figureSVG di figure.js
export function figureSVG3(ex, t = 1, opts = {}) {
  return `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${opts.label || ''}">${DEFS3}<rect width="240" height="200" fill="${C3.bg}"/>${poseSVG3(ex, t).svg}</svg>`;
}

// partenza e arrivo affiancati, con freccia arancione del movimento
export function pairSVG3(ex, opts = {}) {
  const A = poseSVG3(ex, 0), B = poseSVG3(ex, 1);
  const arrows = motionPaths(ex).map((pts) => arrowPath(pts, 14)).join('');
  const badge = (x, n, txt) => `<g font-family="Inter,system-ui,sans-serif"><circle cx="${x}" cy="14" r="8" fill="none" stroke="#2a2622" stroke-width="1.2"/><text x="${x}" y="17.5" text-anchor="middle" font-size="10" font-weight="700" fill="#2a2622">${n}</text><text x="${x + 13}" y="17.5" font-size="10" font-weight="600" fill="#2a2622">${txt}</text></g>`;
  return `<svg viewBox="0 0 480 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${opts.label || ex.title || ''}">${DEFS3}<rect width="480" height="200" fill="${C3.bg}"/>` +
    `<g>${A.svg}${arrows}</g><line x1="240" y1="30" x2="240" y2="180" stroke="#eee6dc" stroke-width="1"/><g transform="translate(240,0)">${B.svg}</g>` +
    badge(14, 1, 'Partenza') + badge(254, 2, 'Arrivo') + `</svg>`;
}
