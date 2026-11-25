// Libreria dei movimenti: posa iniziale (A), posa finale (B), attrezzi,
// muscoli principali e secondari, consigli di esecuzione.
import { prop, COL } from './figure.js';
import { LIB_EXTRA } from './exercises_extra.js';

export const MUSCLES = {
  petto: 'Petto', dorso: 'Dorsali', trapezi: 'Trapezi', lombari: 'Lombari',
  deltoidi: 'Deltoidi laterali', 'deltoidi-ant': 'Deltoidi anteriori', 'deltoidi-post': 'Deltoidi posteriori',
  bicipiti: 'Bicipiti', tricipiti: 'Tricipiti', avambracci: 'Avambracci', addome: 'Addome',
  glutei: 'Glutei', abduttori: 'Abduttori (gluteo medio)', quadricipiti: 'Quadricipiti',
  femorali: 'Femorali', polpacci: 'Polpacci',
};

const STAND = { hip: [112, 114], torso: 180, thN: 2, shN: 0, ftN: 90, thF: -4, shF: -2, ftF: 90 };
const ang = (a, b) => (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
const perp = (J, s = 'N') => ang(J['elbow' + s], J['hand' + s]) + 90;
const hasPlate = (J, r = 15) => prop.plate(J.handN, r);
const dbs = (J, r) => prop.db(J.handF, false, r) + prop.db(J.handN, false, r);
const dbsSide = (J) => prop.dbSide(J.handF, perp(J, 'F'), false, 18) + prop.dbSide(J.handN, perp(J), false, 18);
const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];
const dirv = (t) => [Math.sin((t * Math.PI) / 180), Math.cos((t * Math.PI) / 180)];

// panca piana: corpo supino, testa a sinistra
const SUPINE = { hip: [150, 127], torso: -90, neck: -90, footN: [186, 186], footF: [180, 186], kneeN: 'up', kneeF: 'up', ftN: 90, ftF: 90 };
const flatBench = () => prop.bench(56, 170, 141);
const rack = () => prop.line([84, 190], [84, 58], 3.5) + prop.line([84, 64], [96, 64], 3.5);
// panca inclinata
const INCL = { hip: [142, 148], torso: 238, neck: 228, footN: [180, 186], footF: [174, 186], ftN: 90, ftF: 90 };
const inclBench = (J) => {
  const d = dirv(238), n = [-d[1], d[0]];
  const p0 = add(add(J.hip, n, -11), d, -6);
  return prop.pad(p0, 238, 74, -8) + prop.rect(118, 157, 46, 7) + prop.line([140, 164], [140, 190], 4) +
    prop.line(add(p0, d, 50), [100, 190], 4) + prop.line([100, 190], [150, 190], 4);
};
// tronco appoggiato a panca inclinata (prono)
const proneIncl = (J, a = 135) => {
  const d = dirv(a), n = [-d[1], d[0]];
  const p0 = add(add(J.hip, n, 12), d, -8);
  return prop.pad(p0, a, 64, 9) + prop.line(add(add(p0, d, 34), n, 9), [150, 190], 4) + prop.line(add(add(p0, d, 2), n, 9), [118, 190], 4);
};
const behind = (J, k) => { const v = [J.shoulder[0] - J.hip[0], J.shoulder[1] - J.hip[1]], l = Math.hypot(...v); return [J.shoulder[0] + (v[1] / l) * k, J.shoulder[1] - (v[0] / l) * k]; };
const armsFolded = (t) => ({ uaN: t + 180 + 25, faN: t - 35, uaF: t + 180 + 20, faF: t - 30 });

export const LIB = {
  ez_curl: {
    title: 'Curl con bilanciere EZ', primary: ['bicipiti'], secondary: ['avambracci'],
    A: { ...STAND, uaN: 6, faN: 6, uaF: 2, faF: 2 }, B: { ...STAND, uaN: 12, faN: 158, uaF: 8, faF: 154 },
    front: (J) => hasPlate(J, 11),
    tips: ['Gomiti fermi ai fianchi', 'Sali senza slanciare il busto', 'Scendi lento fino a braccia quasi tese'],
  },
  close_grip_bench: {
    title: 'Panca presa stretta', primary: ['tricipiti'], secondary: ['petto', 'deltoidi-ant'],
    A: { ...SUPINE, uaN: 180, faN: 180, uaF: 182, faF: 180 }, B: { ...SUPINE, uaN: 42, faN: 172, uaF: 40, faF: 172 },
    back: () => flatBench() + rack(), front: (J) => hasPlate(J),
    tips: ['Mani alla larghezza delle spalle', 'Gomiti stretti vicino al busto', 'Tocca la parte bassa del petto'],
  },
  spider_curl: {
    title: 'Curl spider con manubri', primary: ['bicipiti'], secondary: ['avambracci'],
    A: { hip: [96, 120], torso: 135, neck: 140, footN: [112, 186], footF: [104, 186], uaN: 2, faN: 2, uaF: -2, faF: -2 },
    B: { hip: [96, 120], torso: 135, neck: 140, footN: [112, 186], footF: [104, 186], uaN: 6, faN: 148, uaF: 2, faF: 144 },
    back: (J) => proneIncl(J), front: (J) => dbs(J),
    tips: ['Petto appoggiato allo schienale', 'Braccia verticali, gomiti fermi', 'Breve pausa in alto'],
  },
  db_french_press: {
    title: 'French press con manubri', primary: ['tricipiti'], secondary: [],
    A: { ...SUPINE, uaN: 192, faN: 190, uaF: 194, faF: 192 }, B: { ...SUPINE, uaN: 196, faN: 282, uaF: 198, faF: 284 },
    back: () => flatBench(), front: (J) => dbsSide(J),
    tips: ['Braccia ferme, si muovono solo gli avambracci', 'Scendi ai lati della testa', 'ROM confortevole per i gomiti'],
  },
  incline_hammer_curl: {
    title: 'Curl a martello su panca inclinata', primary: ['bicipiti'], secondary: ['avambracci'],
    A: { ...INCL, torso: 222, neck: 210, hip: [136, 150], uaN: 0, faN: 0, uaF: -3, faF: -3 },
    B: { ...INCL, torso: 222, neck: 210, hip: [136, 150], uaN: 2, faN: 150, uaF: -1, faF: 146 },
    back: (J) => {
      const d = dirv(222), n = [-d[1], d[0]];
      const p0 = add(add(J.hip, n, -11), d, -6);
      return prop.pad(p0, 222, 74, -8) + prop.rect(112, 159, 48, 7) + prop.line([134, 166], [134, 190], 4) + prop.line(add(p0, d, 50), [96, 190], 4);
    },
    front: (J) => prop.dbSide(J.handN, perp(J), false, 18),
    tips: ['Schiena appoggiata, braccia che pendono dietro al busto', 'Presa neutra (pollici in alto)', 'Niente oscillazioni'],
  },
  overhead_triceps: {
    title: 'Estensioni tricipiti sopra la testa', primary: ['tricipiti'], secondary: [],
    A: { hip: [108, 148], torso: 180, footN: [152, 188], footF: [146, 188], uaN: 178, faN: 178, uaF: 20, faF: 85 },
    B: { hip: [108, 148], torso: 180, footN: [152, 188], footF: [146, 188], uaN: 174, faN: 328, uaF: 20, faF: 85 },
    back: () => prop.bench(78, 132, 158) + prop.pad([82, 158], 182, 56, -7),
    front: (J) => prop.dbSide(J.handN, perp(J), false, 18),
    tips: ['Gomito puntato in alto e vicino alla testa', 'Allungamento controllato dietro la nuca', 'Non forzare il ROM'],
  },
  pullup: {
    title: 'Trazioni prone', primary: ['dorso'], secondary: ['bicipiti', 'avambracci'],
    A: { anchor: ['handN', [128, 36]], torso: 182, hip: [0, 0], uaN: 180, faN: 180, uaF: 178, faF: 180, thN: 4, shN: -40, thF: 0, shF: -50, ftN: 20, ftF: 10 },
    B: { anchor: ['handN', [128, 36]], torso: 192, hip: [0, 0], uaN: 40, faN: 176, uaF: 36, faF: 176, thN: 12, shN: -35, thF: 6, shF: -45, ftN: 20, ftF: 10 },
    back: () => prop.line([60, 36], [196, 36], 4) + prop.line([60, 36], [60, 190], 4) + prop.line([196, 36], [196, 190], 4),
    front: (J) => prop.bar([128, 36]) + prop.plate(add(J.hip, [0.5, 1], 16), 8),
    tips: ['Parti da braccia distese', 'Petto verso la sbarra, scapole giù', 'Scendi controllato fino in fondo'],
  },
  pendlay_row: {
    title: 'Rematore Pendlay', primary: ['dorso'], secondary: ['trapezi', 'deltoidi-post', 'bicipiti', 'lombari'],
    A: { hip: [92, 126], torso: 95, neck: 100, footN: [112, 187], footF: [106, 187], uaN: 0, faN: 0, uaF: -2, faF: -2 },
    B: { hip: [92, 126], torso: 95, neck: 100, footN: [112, 187], footF: [106, 187], uaN: -98, faN: 4, uaF: -100, faF: 2 },
    front: (J) => hasPlate(J),
    tips: ['Busto parallelo al pavimento', 'Ogni ripetizione riparte da terra', 'Tira verso la parte bassa del petto'],
  },
  db_row_bench: {
    title: 'Rematore con manubrio su panca', primary: ['dorso'], secondary: ['bicipiti', 'deltoidi-post'],
    A: { hip: [78, 118], torso: 96, neck: 100, footN: [74, 188], thF: 2, shF: -90, ftF: 0, uaN: 0, faN: 0, uaF: 6, faF: -4 },
    B: { hip: [78, 118], torso: 96, neck: 100, footN: [74, 188], thF: 2, shF: -90, ftF: 0, uaN: -100, faN: 6, uaF: 6, faF: -4 },
    back: () => prop.bench(30, 150, 157),
    front: (J) => prop.db(J.handN, false, 7),
    tips: ['Ginocchio e mano sulla panca, schiena piatta', 'Gomito che scorre verso il fianco', 'Allunga bene in basso'],
  },
  db_pullover: {
    title: 'Pullover con manubrio', primary: ['dorso'], secondary: ['petto', 'tricipiti'],
    A: { ...SUPINE, uaN: 252, faN: 258, uaF: 254, faF: 260 }, B: { ...SUPINE, uaN: 184, faN: 186, uaF: 186, faF: 188 },
    back: () => flatBench(), front: (J) => prop.dbSide(J.handN, ang(J.elbowN, J.handN), false, 18),
    tips: ['Gabbia toracica ferma', 'Braccia quasi tese per tutto il movimento', 'Evita di inarcare la zona lombare'],
  },
  reverse_fly: {
    title: 'Reverse fly con manubri', primary: ['deltoidi-post'], secondary: ['trapezi', 'dorso'],
    A: { hip: [92, 118], torso: 102, neck: 108, footN: [110, 187], footF: [104, 187], uaN: 0, faN: 4, uaF: -2, faF: 2 },
    B: { hip: [92, 118], torso: 102, neck: 108, footN: [110, 187], footF: [104, 187], uaN: 150, uaScaleN: 0.55, faN: 150, faScaleN: 0.55, uaF: 0, faF: 4 },
    front: (J) => dbs(J),
    tips: ['Busto inclinato e fermo', 'Apri le braccia di lato, gomiti morbidi', 'Niente slanci'],
  },
  db_shrug: {
    title: 'Scrollate con manubri', view: 'front', primary: ['trapezi'], secondary: ['avambracci'],
    A: { hip: [120, 114], torso: 180, ua: 8, fa: 3, th: 3, sh: -2, shrug: 0 },
    B: { hip: [120, 114], torso: 180, ua: 8, fa: 3, th: 3, sh: -2, shrug: 7 },
    front: (J) => prop.db(J.handR, false, 7) + prop.db(J.handL, false, 7),
    tips: ['Sali in verticale verso le orecchie', 'Pausa breve in alto', 'Niente rotazioni delle spalle'],
  },
  incline_bb_bench: {
    title: 'Panca inclinata con bilanciere', primary: ['petto'], secondary: ['deltoidi-ant', 'tricipiti'],
    A: { ...INCL, uaN: 186, faN: 184, uaF: 188, faF: 184 }, B: { ...INCL, uaN: 46, faN: 172, uaF: 44, faF: 172 },
    back: (J) => inclBench(J), front: (J) => hasPlate(J),
    tips: ['Discesa controllata sulla parte alta del petto', 'Scapole addotte', 'Traiettoria costante'],
  },
  flat_db_bench: {
    title: 'Panca piana con manubri', primary: ['petto'], secondary: ['deltoidi-ant', 'tricipiti'],
    A: { ...SUPINE, uaN: 180, faN: 180, uaF: 182, faF: 180 }, B: { ...SUPINE, uaN: 6, faN: 176, uaF: 4, faF: 176 },
    back: () => flatBench(), front: (J) => dbsSide(J),
    tips: ['ROM completo', 'Scapole stabili sulla panca', 'Spingi in alto e leggermente verso l\'interno'],
  },
  db_military: {
    title: 'Military press con manubri', view: 'front', primary: ['deltoidi'], secondary: ['tricipiti', 'trapezi'],
    A: { hip: [120, 114], torso: 180, ua: 88, fa: 178, th: 6, sh: -2 }, B: { hip: [120, 114], torso: 180, ua: 160, fa: 176, th: 6, sh: -2 },
    front: (J) => prop.dbSide(J.handR, 90, false, 18) + prop.dbSide(J.handL, 90, false, 18),
    tips: ['Addome attivo, niente iperlordosi', 'Gomiti sotto i polsi', 'Sali senza battere i manubri'],
  },
  lateral_raise: {
    title: 'Alzate laterali con manubri', view: 'front', primary: ['deltoidi'], secondary: ['trapezi'],
    A: { hip: [120, 114], torso: 180, ua: 12, fa: 8, th: 3, sh: -2 }, B: { hip: [120, 114], torso: 180, ua: 86, fa: 84, th: 3, sh: -2 },
    front: (J) => prop.db(J.handR, false, 6.5) + prop.db(J.handL, false, 6.5),
    tips: ['Gomiti leggermente flessi', 'Sali fino all\'altezza delle spalle', 'Tensione continua, niente slanci'],
  },
  dip: {
    title: 'Dip alle parallele', primary: ['petto'], secondary: ['tricipiti', 'deltoidi-ant'],
    A: { anchor: ['handN', [126, 104]], hip: [0, 0], torso: 172, neck: 168, uaN: 2, faN: 0, uaF: 0, faF: 0, thN: 6, shN: -40, thF: 0, shF: -55, ftN: 20, ftF: 20 },
    B: { anchor: ['handN', [126, 104]], hip: [0, 0], torso: 158, neck: 150, uaN: -84, faN: 0, uaF: -86, faF: 0, thN: 14, shN: -40, thF: 8, shF: -55, ftN: 20, ftF: 20 },
    back: () => prop.line([92, 108], [92, 190], 4) + prop.line([170, 108], [170, 190], 4) + prop.line([84, 108], [178, 108], 5, COL.metal),
    tips: ['Busto leggermente inclinato in avanti', 'Scendi finché le spalle stanno bene', 'Solo senza fastidi a spalle e sterno'],
  },
  bent_lateral_raise: {
    title: 'Alzate laterali a busto inclinato', primary: ['deltoidi'], secondary: ['deltoidi-post', 'trapezi'],
    A: { hip: [96, 116], torso: 140, neck: 146, footN: [112, 187], footF: [106, 187], uaN: 4, faN: 6, uaF: 0, faF: 2 },
    B: { hip: [96, 116], torso: 140, neck: 146, footN: [112, 187], footF: [106, 187], uaN: 70, uaScaleN: 0.6, faN: 70, faScaleN: 0.6, uaF: 2, faF: 4 },
    front: (J) => dbs(J),
    tips: ['Busto inclinato di circa 45°', 'Traiettoria pulita, braccia di lato', 'Controllo in discesa'],
  },
  hip_thrust_machine: {
    title: 'Hip thrust al macchinario', primary: ['glutei'], secondary: ['femorali', 'quadricipiti'],
    A: { hip: [104, 174], torso: 234, neck: 246, footN: [152, 188], footF: [146, 188], kneeN: 'up', kneeF: 'up', handN: [110, 160], handF: [106, 160], elbowN: 'up', elbowF: 'up' },
    B: { hip: [112, 150], torso: 258, neck: 272, footN: [152, 188], footF: [146, 188], kneeN: 'up', kneeF: 'up', handN: [118, 136], handF: [114, 136], elbowN: 'up', elbowF: 'up' },
    back: () => prop.bench(18, 74, 140) + prop.line([200, 190], [200, 140], 4),
    front: (J) => prop.line([J.hip[0], J.hip[1] - 15], [200, 142], 4, COL.frame) + prop.rect(J.hip[0] - 14, J.hip[1] - 20, 28, 9, COL.padLight, 4),
    tips: ['Parte alta della schiena sul cuscino', 'Spingi con i talloni', 'Fermo di 1–2″ in massima contrazione'],
  },
  back_extension: {
    title: 'Back extension 45° (glute bias)', primary: ['glutei'], secondary: ['femorali', 'lombari'],
    A: { hip: [132, 92], torso: 22, neck: 30, thN: -45, shN: -45, ftN: 45, thF: -42, shF: -45, ftF: 45, ...armsFolded(22) },
    B: { hip: [132, 92], torso: 135, neck: 135, thN: -45, shN: -45, ftN: 45, thF: -42, shF: -45, ftF: 45, ...armsFolded(135) },
    back: () => prop.line([150, 112], [150, 190], 4) + prop.line([84, 156], [150, 190], 4) + prop.line([150, 112], [84, 156], 4) + prop.pad([142.6, 97], -45, 26, -9) + prop.line([70, 142], [86, 158], 5, COL.metal),
    front: (J) => prop.plate(J.handN, 8),
    tips: ['Il movimento parte dall\'anca', 'Schiena leggermente arrotondata, chiudi il gluteo', 'Niente iperestensione della schiena'],
  },
  leg_curl: {
    title: 'Leg curl', primary: ['femorali'], secondary: ['polpacci'],
    A: { hip: [116, 120], torso: 90, neck: 96, thN: -90, shN: -90, ftN: 0, thF: -88, shF: -90, ftF: 0, uaN: 24, faN: 60, uaF: 20, faF: 56 },
    B: { hip: [116, 120], torso: 90, neck: 96, thN: -90, shN: -178, ftN: -90, thF: -88, shF: -176, ftF: -90, uaN: 24, faN: 60, uaF: 20, faF: 56 },
    back: () => prop.bench(56, 206, 131),
    front: (J) => {
      const v = [J.ankleN[0] - J.kneeN[0], J.ankleN[1] - J.kneeN[1]], l = Math.hypot(...v), n = [v[1] / l, -v[0] / l];
      const r = add(J.ankleN, n, 9);
      return prop.line(J.kneeN, r, 3.5, COL.frame) + `<circle cx="${r[0]}" cy="${r[1]}" r="6" fill="${COL.padLight}" stroke="${COL.ink}" stroke-width="1.5"/>`;
    },
    tips: ['Bacino schiacciato sul cuscino', 'Fletti senza staccare le anche', 'Ritorno lento'],
  },
  abductor_machine: {
    title: 'Abduzioni al macchinario', view: 'front', primary: ['abduttori'], secondary: ['glutei'],
    A: { hip: [120, 134], torso: 180, ua: 16, fa: -8, th: 10, thScale: 0.42, sh: 2 }, B: { hip: [120, 134], torso: 180, ua: 16, fa: -8, th: 40, thScale: 0.42, sh: 18 },
    back: () => prop.rect(96, 62, 48, 80, COL.pad, 6) + prop.rect(88, 136, 64, 9),
    front: (J) => prop.rect(J.kneeR[0] - 15, J.kneeR[1] - 10, 7, 20, COL.padLight) + prop.rect(J.kneeL[0] + 8, J.kneeL[1] - 10, 7, 20, COL.padLight),
    tips: ['Bacino stabile sul sedile', 'Apri le gambe con controllo', 'Tensione continua, non sbattere i pesi'],
  },
  calf_raise: {
    title: 'Calf in piedi', primary: ['polpacci'], secondary: [],
    A: { ...STAND, anchor: ['toeN', [128, 180]], hip: [0, 0], thN: 0, shN: 0, thF: -2, shF: 0, ftN: 104, ftF: 104, uaN: 28, faN: 168, uaF: 24, faF: 166 },
    B: { ...STAND, anchor: ['toeN', [128, 180]], hip: [0, 0], thN: 0, shN: 0, thF: -2, shF: 0, ftN: 52, ftF: 52, uaN: 28, faN: 168, uaF: 24, faF: 166 },
    back: () => prop.rect(112, 180, 40, 10, '#b9ad9c') + prop.line([70, 190], [70, 40], 4),
    front: (J) => prop.rect(J.shoulder[0] - 12, J.shoulder[1] - 8, 24, 8, COL.padLight) + prop.line([J.shoulder[0] - 12, J.shoulder[1] - 4], [70, J.shoulder[1] - 4], 4),
    tips: ['Allunga bene in basso', 'Sali sulle punte fino in cima', 'Pausa breve in alto'],
  },
  incline_db_bench: {
    title: 'Panca inclinata con manubri', primary: ['petto'], secondary: ['deltoidi-ant', 'tricipiti'],
    A: { ...INCL, uaN: 186, faN: 184, uaF: 188, faF: 184 }, B: { ...INCL, uaN: 30, faN: 176, uaF: 28, faF: 176 },
    back: (J) => inclBench(J), front: (J) => dbsSide(J),
    tips: ['Scendi fino all\'altezza del petto', 'Lascia 1–2 ripetizioni in riserva', 'Gomiti a 45° dal busto'],
  },
  db_bent_row: {
    title: 'Rematore con manubri a busto flesso', primary: ['dorso'], secondary: ['bicipiti', 'deltoidi-post', 'lombari'],
    A: { hip: [92, 120], torso: 112, neck: 118, footN: [112, 187], footF: [106, 187], uaN: 0, faN: 0, uaF: -2, faF: -2 },
    B: { hip: [92, 120], torso: 112, neck: 118, footN: [112, 187], footF: [106, 187], uaN: -92, faN: 6, uaF: -94, faF: 4 },
    front: (J) => dbs(J, 7),
    tips: ['Schiena piatta, ginocchia morbide', 'Gomiti verso i fianchi', 'Esecuzione controllata'],
  },
  // ---- Scheda 1 ----
  back_squat: {
    title: 'Back squat', primary: ['quadricipiti', 'glutei'], secondary: ['femorali', 'lombari'],
    A: { hip: [110, 114], torso: 176, footN: [118, 187], footF: [112, 187], handN: [100, 64], handF: [98, 64], elbowN: 'down', elbowF: 'down' },
    B: { hip: [86, 152], torso: 140, footN: [118, 187], footF: [112, 187], handN: [110, 108], handF: [108, 108], elbowN: 'down', elbowF: 'down' },
    front: (J) => prop.plate(behind(J, 7), 13),
    tips: ['Bilanciere sui trapezi', 'Scendi almeno al parallelo', 'Ginocchia nella direzione delle punte'],
  },
  bb_bench: {
    title: 'Panca piana con bilanciere', primary: ['petto'], secondary: ['tricipiti', 'deltoidi-ant'],
    A: { ...SUPINE, uaN: 180, faN: 180, uaF: 182, faF: 180 }, B: { ...SUPINE, uaN: 22, faN: 176, uaF: 20, faF: 176 },
    back: () => flatBench() + rack(), front: (J) => hasPlate(J),
    tips: ['Fermo di 1″ al petto', 'Scapole addotte, piedi a terra', 'Bilanciere sopra la linea dei capezzoli'],
  },
  rdl: {
    title: 'Romanian deadlift', primary: ['femorali', 'glutei'], secondary: ['lombari', 'trapezi'],
    A: { hip: [112, 114], torso: 178, footN: [118, 187], footF: [112, 187], uaN: 2, faN: 0, uaF: 0, faF: 0 },
    B: { hip: [94, 120], torso: 106, neck: 112, footN: [118, 187], footF: [112, 187], uaN: 0, faN: 0, uaF: -2, faF: -2 },
    front: (J) => hasPlate(J),
    tips: ['Anche indietro, ginocchia appena flesse', 'Bilanciere vicino alle gambe', 'Schiena neutra per tutto il ROM'],
  },
  chest_supported_row: {
    title: 'Rematore chest-supported', primary: ['dorso'], secondary: ['deltoidi-post', 'bicipiti', 'trapezi'],
    A: { hip: [96, 120], torso: 128, neck: 134, footN: [112, 186], footF: [104, 186], uaN: 2, faN: 2, uaF: -2, faF: -2 },
    B: { hip: [96, 120], torso: 128, neck: 134, footN: [112, 186], footF: [104, 186], uaN: -78, faN: 8, uaF: -80, faF: 6 },
    back: (J) => proneIncl(J, 128), front: (J) => dbs(J, 7),
    tips: ['Petto sempre sul cuscino', 'Controllo scapolare', 'Gomiti indietro, non in alto'],
  },
  bulgarian_split_squat: {
    title: 'Bulgarian split squat', primary: ['quadricipiti', 'glutei'], secondary: ['femorali'],
    A: { hip: [100, 114], torso: 176, footN: [140, 187], footF: [52, 146], kneeF: 'down', ftF: 160, uaN: 2, faN: 0, uaF: 0, faF: 0 },
    B: { hip: [98, 146], torso: 168, footN: [140, 187], footF: [52, 146], kneeF: 'down', ftF: 160, uaN: 4, faN: 0, uaF: 2, faF: 0 },
    back: () => prop.bench(26, 70, 150), front: (J) => dbs(J, 7),
    tips: ['Piede posteriore sulla panca', 'Scendi in verticale', 'Ginocchio anteriore stabile'],
  },
  ab_wheel: {
    title: 'Ab wheel / rollout', primary: ['addome'], secondary: ['dorso', 'deltoidi-ant'],
    A: { anchor: ['kneeN', [86, 182]], hip: [0, 0], torso: 150, neck: 150, thN: -4, shN: -90, ftN: 0, thF: -6, shF: -90, ftF: 0, uaN: 6, faN: 6, uaF: 4, faF: 4 },
    B: { anchor: ['kneeN', [86, 182]], hip: [0, 0], torso: 98, neck: 102, thN: -64, shN: -90, ftN: 0, thF: -66, shF: -90, ftF: 0, uaN: 96, faN: 96, uaF: 94, faF: 94 },
    front: (J) => `<circle cx="${J.handN[0]}" cy="${J.handN[1] + 4}" r="9" fill="${COL.metal}" stroke="${COL.ink}" stroke-width="1.6"/>`,
    tips: ['Addome contratto, bacino in retroversione', 'Arriva solo fin dove la schiena resta neutra', 'Ritorna tirando con l\'addome'],
  },
  deadlift: {
    title: 'Stacco da terra', primary: ['glutei', 'femorali', 'lombari'], secondary: ['quadricipiti', 'trapezi', 'dorso'],
    A: { hip: [98, 142], torso: 122, neck: 128, footN: [126, 187], footF: [120, 187], uaN: 0, faN: 0, uaF: -2, faF: -2 },
    B: { hip: [118, 113], torso: 180, footN: [126, 187], footF: [120, 187], uaN: 4, faN: 2, uaF: 2, faF: 0 },
    front: (J) => hasPlate(J),
    tips: ['Bilanciere a contatto con le tibie', 'Spingi il pavimento, schiena neutra', 'Reset tra le ripetizioni'],
  },
  front_squat: {
    title: 'Front squat', primary: ['quadricipiti'], secondary: ['glutei', 'addome'],
    A: { hip: [110, 114], torso: 178, footN: [118, 187], footF: [112, 187], uaN: 100, faN: 262, uaF: 98, faF: 260 },
    B: { hip: [90, 152], torso: 158, footN: [118, 187], footF: [112, 187], uaN: 80, faN: 242, uaF: 78, faF: 240 },
    front: (J) => prop.plate(behind(J, -9), 13),
    tips: ['Gomiti alti', 'Busto il più verticale possibile', 'Tecnica prima del carico'],
  },
  bb_military: {
    title: 'Military press con bilanciere', primary: ['deltoidi-ant', 'deltoidi'], secondary: ['tricipiti', 'trapezi'],
    A: { ...STAND, uaN: 24, faN: 164, uaF: 22, faF: 162 }, B: { ...STAND, uaN: 176, faN: 180, uaF: 174, faF: 180 },
    front: (J) => hasPlate(J),
    tips: ['Glutei e addome attivi', 'Testa indietro al passaggio del bilanciere', 'Chiudi sopra la testa'],
  },
  hanging_leg_raise: {
    title: 'Hanging leg raise', primary: ['addome'], secondary: ['quadricipiti'],
    A: { anchor: ['handN', [124, 30]], hip: [0, 0], torso: 180, uaN: 180, faN: 180, uaF: 178, faF: 180, thN: 22, shN: -78, thF: 18, shF: -82, ftN: 10, ftF: 10 },
    B: { anchor: ['handN', [124, 30]], hip: [0, 0], torso: 176, uaN: 180, faN: 180, uaF: 178, faF: 180, thN: 96, shN: 96, thF: 92, shF: 92, ftN: 150, ftF: 150 },
    back: () => prop.line([60, 30], [196, 30], 4) + prop.line([60, 30], [60, 190], 4) + prop.line([196, 30], [196, 190], 4),
    front: () => prop.bar([124, 30]),
    tips: ['Niente oscillazioni', 'Porta il bacino verso il petto', 'Scendi controllato'],
  },
  smith_pause_squat: {
    title: 'Pause squat al multipower', primary: ['quadricipiti', 'glutei'], secondary: ['femorali'],
    A: { hip: [110, 114], torso: 176, footN: [124, 187], footF: [118, 187], handN: [100, 64], handF: [98, 64], elbowN: 'down', elbowF: 'down' },
    B: { hip: [90, 152], torso: 146, footN: [124, 187], footF: [118, 187], handN: [112, 108], handF: [110, 108], elbowN: 'down', elbowF: 'down' },
    back: () => prop.line([100, 190], [100, 18], 5, COL.metal) + prop.line([100, 18], [100, 18], 5),
    front: (J) => prop.plate(behind(J, 7), 13),
    tips: ['2″ di pausa in buca', 'Piedi leggermente avanti', 'Risali senza rimbalzo'],
  },
  cable_row: {
    title: 'Pulley basso (cable row)', primary: ['dorso'], secondary: ['bicipiti', 'deltoidi-post'],
    A: { hip: [72, 160], torso: 150, neck: 150, footN: [158, 174], footF: [152, 174], knee: 'up', kneeN: 'up', kneeF: 'up', uaN: 96, faN: 96, uaF: 94, faF: 94, ftN: 160, ftF: 160 },
    B: { hip: [72, 160], torso: 184, neck: 182, footN: [158, 174], footF: [152, 174], kneeN: 'up', kneeF: 'up', uaN: -24, faN: 84, uaF: -26, faF: 82, ftN: 160, ftF: 160 },
    back: () => prop.bench(36, 112, 170) + prop.rect(160, 150, 10, 34, '#b9ad9c') + prop.rect(196, 40, 30, 150, COL.pad, 4),
    front: (J) => prop.cable(J.handN, [200, 166]) + `<circle cx="200" cy="166" r="5" fill="${COL.metalLight}" stroke="${COL.ink}" stroke-width="1.4"/>` + prop.line([J.handN[0], J.handN[1] - 6], [J.handN[0], J.handN[1] + 6], 4, COL.metal),
    tips: ['Busto stabile, niente dondolio', 'Tira verso l\'ombelico', 'Scapole indietro in chiusura'],
  },
};

// esercizi aggiunti dal catalogo (js/exercises_extra.js)
Object.assign(LIB, LIB_EXTRA);
