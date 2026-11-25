// Esercizi aggiunti dal catalogo (Free Exercise DB, pubblico dominio), tradotti e posati
// nel formato di LIB (exercises.js). Primo gruppo: 30 esercizi comuni non presenti in Scheda 1 e 2.
import { prop, COL } from './figure.js';

const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];
const dirv = (t) => [Math.sin((t * Math.PI) / 180), Math.cos((t * Math.PI) / 180)];
const ang = (a, b) => (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
const perp = (J, s = 'N') => ang(J['elbow' + s], J['hand' + s]) + 90;
const bb = (J, r = 15) => prop.plate(J.handN, r);
const dbsEnd = (J, r = 6.5) => prop.db(J.handF, false, r) + prop.db(J.handN, false, r);
const dbsLong = (J, len = 18) => prop.dbSide(J.handF, perp(J, 'F'), false, len) + prop.dbSide(J.handN, perp(J), false, len);

const STAND = { hip: [112, 114], torso: 180, thN: 2, shN: 0, ftN: 90, thF: -4, shF: -2, ftF: 90 };
const SUPINE = { hip: [150, 127], torso: -90, neck: -90, footN: [186, 186], footF: [180, 186], kneeN: 'up', kneeF: 'up', ftN: 90, ftF: 90 };
const INCL = { hip: [142, 148], torso: 238, neck: 228, footN: [180, 186], footF: [174, 186], ftN: 90, ftF: 90 };
const flatBench = () => prop.bench(56, 170, 141);
const inclBench = (J) => {
  const d = dirv(238), n = [-d[1], d[0]];
  const p0 = add(add(J.hip, n, -11), d, -6);
  return prop.pad(p0, 238, 74, -8) + prop.rect(118, 157, 46, 7) + prop.line([140, 164], [140, 190], 4) +
    prop.line(add(p0, d, 50), [100, 190], 4) + prop.line([100, 190], [150, 190], 4);
};
const SEAT = { hip: [100, 136], torso: 182, neck: 180, thN: 90, thF: 88, shN: 0, shF: -2, ftN: 90, ftF: 90 };
const seat = (x = 78, y = 142, w = 44) => prop.rect(x, y, w, 7) + prop.line([x + w / 2, y + 7], [x + w / 2, 190], 4);
const pulley = (p) => `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${COL.metalLight}" stroke="${COL.ink}" stroke-width="1.4"/>`;
const tower = (x, top = 14) => prop.rect(x, top, 22, 190 - top, COL.pad, 4);
const handle = (J, s = 'N') => prop.line([J['hand' + s][0], J['hand' + s][1] - 6], [J['hand' + s][0], J['hand' + s][1] + 6], 4, COL.metal);

// Lat machine vista di lato: partenza a braccia quasi verticali, arrivo con gomiti in basso e
// dietro le spalle e sbarra all'altezza della parte alta del petto (cavo quasi verticale).
const PULL_X = 102;
const latBack = () => seat(72, 146, 48) + tower(176) + prop.line([PULL_X, 12], [186, 12], 4) + prop.rect(126, 121, 20, 8, COL.padLight, 4);
const pulldown = (title, torsoB, handA, handB, secondary, tips) => ({
  title, primary: ['dorso'], secondary,
  A: { ...SEAT, hip: [96, 140], torso: 188, neck: 184, handN: handA, handF: [handA[0] - 3, handA[1] + 1], elbowN: 'back', elbowF: 'back' },
  B: { ...SEAT, hip: [96, 140], torso: torsoB, neck: torsoB - 8, handN: handB, handF: [handB[0] - 3, handB[1] + 1], elbowN: 'back', elbowF: 'back' },
  back: latBack,
  front: (J) => prop.cable(J.handN, [PULL_X, 12]) + pulley([PULL_X, 12]) + prop.line([J.handN[0] - 8, J.handN[1] - 3], [J.handN[0] + 8, J.handN[1] - 3], 3.5, COL.metal),
  tips,
});

export const LIB_EXTRA = {
  lat_pulldown_wide: pulldown('Lat machine presa larga', 198, [101, 38], [94, 95], ['bicipiti', 'deltoidi-post', 'trapezi'],
    ['Petto in fuori, leggera inclinazione indietro', 'Porta la sbarra verso la parte alta del petto', 'Risali controllato fino a braccia distese']),
  lat_pulldown_close: pulldown('Lat machine presa stretta', 196, [101, 38], [96, 98], ['bicipiti', 'deltoidi-post'],
    ['Presa stretta, palmi verso di te', 'Gomiti che scendono vicino al busto', 'Niente slancio con la schiena']),
  leg_press: {
    title: 'Leg press', primary: ['quadricipiti', 'glutei'], secondary: ['femorali', 'polpacci'],
    A: { hip: [96, 150], torso: 238, neck: 226, footN: [124, 120], footF: [120, 120], kneeN: 'up', kneeF: 'up', ftN: 135, ftF: 135, uaN: 8, faN: 70, uaF: 6, faF: 68 },
    B: { hip: [96, 150], torso: 238, neck: 226, footN: [146, 100], footF: [142, 100], kneeN: 'up', kneeF: 'up', ftN: 135, ftF: 135, uaN: 8, faN: 70, uaF: 6, faF: 68 },
    back: (J) => prop.line([60, 186], [210, 36], 4) + prop.pad(add(J.hip, [-12, 6], 1), 238, 70, -8) + prop.rect(74, 152, 46, 7) + prop.line([96, 159], [96, 190], 4),
    front: (J) => { const d = dirv(45); return prop.line(add(J.ankleN, d, -20), add(J.ankleN, d, 18), 7, COL.metal); },
    tips: ['Schiena e bacino sempre appoggiati', 'Scendi finché il bacino non si stacca', 'Non bloccare le ginocchia in alto'],
  },
  leg_extension: {
    title: 'Leg extension', primary: ['quadricipiti'], secondary: [],
    A: { ...SEAT, shN: 2, shF: 0, ftN: 90, ftF: 90, uaN: 12, faN: 40, uaF: 10, faF: 38 },
    B: { ...SEAT, shN: 88, shF: 86, ftN: 170, ftF: 168, uaN: 12, faN: 40, uaF: 10, faF: 38 },
    back: () => seat(72, 142, 46) + prop.pad([74, 142], 182, 52, -7),
    front: (J) => { const v = [J.ankleN[0] - J.kneeN[0], J.ankleN[1] - J.kneeN[1]], l = Math.hypot(...v), n = [-v[1] / l, v[0] / l]; const r = add(J.ankleN, n, -8); return prop.line(J.kneeN, r, 3.5, COL.frame) + `<circle cx="${r[0]}" cy="${r[1]}" r="6" fill="${COL.padLight}" stroke="${COL.ink}" stroke-width="1.5"/>`; },
    tips: ['Ginocchio allineato al perno della macchina', 'Estendi fino in fondo e stringi 1″', 'Scendi lento'],
  },
  seated_leg_curl: {
    title: 'Leg curl da seduto', primary: ['femorali'], secondary: ['polpacci'],
    A: { ...SEAT, shN: 88, shF: 86, ftN: 170, ftF: 168, uaN: 12, faN: 40, uaF: 10, faF: 38 },
    B: { ...SEAT, shN: -18, shF: -20, ftN: 60, ftF: 58, uaN: 12, faN: 40, uaF: 10, faF: 38 },
    back: () => seat(72, 142, 46) + prop.pad([74, 142], 194, 52, -7) + prop.rect(108, 112, 32, 8, COL.padLight, 4),
    front: (J) => { const v = [J.ankleN[0] - J.kneeN[0], J.ankleN[1] - J.kneeN[1]], l = Math.hypot(...v), n = [-v[1] / l, v[0] / l]; const r = add(J.ankleN, n, 8); return prop.line(J.kneeN, r, 3.5, COL.frame) + `<circle cx="${r[0]}" cy="${r[1]}" r="6" fill="${COL.padLight}" stroke="${COL.ink}" stroke-width="1.5"/>`; },
    tips: ['Cuscino sopra le ginocchia ben fisso', 'Porta i talloni sotto il sedile', 'Ritorno controllato'],
  },
  cable_crossover: {
    title: 'Croci ai cavi', view: 'front', primary: ['petto'], secondary: ['deltoidi-ant'],
    A: { hip: [120, 114], torso: 180, ua: 118, fa: 112, th: 6, sh: -2 }, B: { hip: [120, 114], torso: 180, ua: 28, uaScale: 0.8, fa: -18, th: 6, sh: -2 },
    back: () => tower(8, 20) + tower(210, 20),
    front: (J) => prop.cable(J.handR, [30, 26]) + prop.cable(J.handL, [210, 26]) + pulley([30, 26]) + pulley([210, 26]),
    tips: ['Un piede avanti, busto leggermente inclinato', 'Gomiti morbidi e fissi', 'Chiudi le mani davanti al bacino'],
  },
  pec_deck: {
    title: 'Pectoral machine (butterfly)', view: 'front', primary: ['petto'], secondary: ['deltoidi-ant'],
    A: { hip: [120, 132], torso: 180, ua: 92, uaScale: 1, fa: 180, th: 10, thScale: 0.42, sh: 2 }, B: { hip: [120, 132], torso: 180, ua: 34, uaScale: 0.75, fa: 160, th: 10, thScale: 0.42, sh: 2 },
    back: () => prop.rect(96, 50, 48, 88, COL.pad, 6) + prop.rect(88, 134, 64, 9),
    front: (J) => prop.rect(J.elbowR[0] - 5, J.elbowR[1] - 26, 10, 30, COL.padLight) + prop.rect(J.elbowL[0] - 5, J.elbowL[1] - 26, 10, 30, COL.padLight),
    tips: ['Schiena appoggiata, petto alto', 'Avvicina i gomiti senza staccare le spalle', 'Apri lento fino a sentire l\'allungamento'],
  },
  db_fly: {
    title: 'Croci con manubri su panca piana', primary: ['petto'], secondary: ['deltoidi-ant'],
    A: { ...SUPINE, uaN: 180, uaScaleN: 1, faN: 182, faScaleN: 1, uaF: 182, uaScaleF: 1, faF: 184, faScaleF: 1 }, B: { ...SUPINE, uaN: 176, uaScaleN: 0.3, faN: 176, faScaleN: 0.3, uaF: 178, uaScaleF: 0.3, faF: 178, faScaleF: 0.3 },
    back: () => flatBench(), front: (J) => dbsEnd(J, 7),
    tips: ['Gomiti leggermente flessi e bloccati', 'Apri finché senti il petto allungarsi', 'Chiudi come ad abbracciare un albero'],
  },
  incline_db_fly: {
    title: 'Croci con manubri su panca inclinata', primary: ['petto'], secondary: ['deltoidi-ant'],
    A: { ...INCL, uaN: 150, uaScaleN: 1, faN: 152, faScaleN: 1, uaF: 152, uaScaleF: 1, faF: 154, faScaleF: 1 }, B: { ...INCL, uaN: 150, uaScaleN: 0.3, faN: 150, faScaleN: 0.3, uaF: 152, uaScaleF: 0.3, faF: 152, faScaleF: 0.3 },
    back: (J) => inclBench(J), front: (J) => dbsEnd(J, 7),
    tips: ['Panca a 30–45°', 'Gomiti morbidi per tutto il movimento', 'Lavora sulla parte alta del petto'],
  },
  triceps_pushdown: {
    title: 'Push down ai cavi con corda', primary: ['tricipiti'], secondary: [],
    A: { ...STAND, torso: 172, neck: 176, uaN: 4, faN: 150, uaF: 2, faF: 148 }, B: { ...STAND, torso: 172, neck: 176, uaN: 4, faN: 4, uaF: 2, faF: 2 },
    back: () => tower(170), front: (J) => prop.cable(J.handN, [160, 22]) + pulley([160, 22]) + prop.line([J.handN[0] - 3, J.handN[1] - 4], [J.handN[0] + 4, J.handN[1] + 6], 3.5, COL.metal),
    tips: ['Gomiti fermi ai fianchi', 'In basso apri leggermente la corda', 'Risali fino a 90° senza muovere le spalle'],
  },
  hammer_curl: {
    title: 'Curl a martello', primary: ['bicipiti'], secondary: ['avambracci'],
    A: { ...STAND, uaN: 6, faN: 6, uaF: 2, faF: 2 }, B: { ...STAND, uaN: 10, faN: 150, uaF: 6, faF: 146 },
    front: (J) => dbsLong(J),
    tips: ['Presa neutra, pollici in alto', 'Gomiti fermi', 'Niente oscillazioni del busto'],
  },
  preacher_curl: {
    title: 'Curl alla panca Scott', primary: ['bicipiti'], secondary: ['avambracci'],
    A: { ...SEAT, hip: [92, 142], torso: 168, neck: 164, uaN: 48, faN: 66, uaF: 46, faF: 64 }, B: { ...SEAT, hip: [92, 142], torso: 168, neck: 164, uaN: 48, faN: 168, uaF: 46, faF: 166 },
    back: () => seat(70, 148, 44) + prop.line([128, 190], [128, 104], 4),
    front: (J) => prop.pad(add(J.shoulder, [6, 10], 1), 48, 34, 8, COL.padLight) + prop.plate(J.handN, 10),
    tips: ['Ascelle appoggiate in cima al cuscino', 'Scendi senza distendere del tutto', 'Sali senza staccare i gomiti'],
  },
  db_curl: {
    title: 'Curl con manubri', primary: ['bicipiti'], secondary: ['avambracci'],
    A: { ...STAND, uaN: 6, faN: 6, uaF: 2, faF: 2 }, B: { ...STAND, uaN: 10, faN: 152, uaF: 6, faF: 148 },
    front: (J) => dbsEnd(J),
    tips: ['Palmi in avanti, ruota mentre sali', 'Gomiti ai fianchi', 'Discesa lenta'],
  },
  face_pull: {
    title: 'Face pull ai cavi', primary: ['deltoidi-post'], secondary: ['trapezi', 'dorso'],
    A: { ...STAND, handN: [164, 66], handF: [160, 66], elbowN: 'down', elbowF: 'down' }, B: { ...STAND, handN: [126, 52], handF: [122, 52], elbowN: 'back', elbowF: 'back' },
    back: () => tower(206), front: (J) => prop.cable(J.handN, [204, 62]) + pulley([204, 62]),
    tips: ['Cavo all\'altezza del viso', 'Tira verso la fronte aprendo i gomiti', 'Ruota le mani indietro in chiusura'],
  },
  front_raise: {
    title: 'Alzate frontali con manubri', primary: ['deltoidi-ant'], secondary: ['deltoidi', 'petto'],
    A: { ...STAND, uaN: 6, faN: 6, uaF: 2, faF: 2 }, B: { ...STAND, uaN: 92, faN: 90, uaF: 88, faF: 86 },
    front: (J) => dbsEnd(J),
    tips: ['Sali fino all\'altezza delle spalle', 'Braccia quasi tese', 'Niente slanci con la schiena'],
  },
  skullcrusher: {
    title: 'French press con bilanciere EZ', primary: ['tricipiti'], secondary: [],
    A: { ...SUPINE, uaN: 194, faN: 192, uaF: 196, faF: 194 }, B: { ...SUPINE, uaN: 198, faN: 282, uaF: 200, faF: 284 },
    back: () => flatBench(), front: (J) => prop.plate(J.handN, 11),
    tips: ['Braccia ferme, si piegano solo i gomiti', 'Porta il bilanciere verso la fronte', 'Gomiti stretti, non aprirli'],
  },
  upright_row: {
    title: 'Tirate al mento con bilanciere', primary: ['deltoidi'], secondary: ['trapezi'],
    A: { ...STAND, handN: [118, 112], handF: [114, 112], elbowN: 'back', elbowF: 'back' }, B: { ...STAND, handN: [124, 74], handF: [120, 74], elbowN: 'up', elbowF: 'up' },
    front: (J) => bb(J),
    tips: ['Presa alla larghezza delle spalle', 'Guida con i gomiti verso l\'alto', 'Fermati al petto se senti fastidio alle spalle'],
  },
  bb_row: {
    title: 'Rematore con bilanciere', primary: ['dorso'], secondary: ['trapezi', 'deltoidi-post', 'bicipiti', 'lombari'],
    A: { hip: [92, 122], torso: 118, neck: 124, footN: [112, 187], footF: [106, 187], uaN: 0, faN: 0, uaF: -2, faF: -2 },
    B: { hip: [92, 122], torso: 118, neck: 124, footN: [112, 187], footF: [106, 187], uaN: -78, faN: 10, uaF: -80, faF: 8 },
    front: (J) => bb(J),
    tips: ['Busto a circa 45°, schiena piatta', 'Tira il bilanciere verso l\'ombelico', 'Scapole indietro in chiusura'],
  },
  t_bar_row: {
    title: 'Rematore T-bar', primary: ['dorso'], secondary: ['trapezi', 'bicipiti', 'lombari'],
    A: { hip: [100, 120], torso: 112, neck: 118, footN: [120, 187], footF: [114, 187], uaN: 0, faN: 0, uaF: -2, faF: -2 },
    B: { hip: [100, 120], torso: 112, neck: 118, footN: [120, 187], footF: [114, 187], uaN: -74, faN: 10, uaF: -76, faF: 8 },
    front: (J) => prop.line([30, 188], add(J.handN, [1, 0], 10), 4.5, COL.metal) + prop.plate(add(J.handN, [1, 0], 8), 13),
    tips: ['Bilanciere tra le gambe, petto in fuori', 'Tira verso lo sterno', 'Niente rimbalzi in basso'],
  },
  chin_up: {
    title: 'Trazioni supine (chin up)', primary: ['dorso'], secondary: ['bicipiti', 'avambracci'],
    A: { anchor: ['handN', [128, 36]], torso: 182, hip: [0, 0], uaN: 180, faN: 180, uaF: 178, faF: 180, thN: 4, shN: -40, thF: 0, shF: -50, ftN: 20, ftF: 10 },
    B: { anchor: ['handN', [128, 36]], torso: 190, hip: [0, 0], uaN: 30, faN: 176, uaF: 26, faF: 176, thN: 12, shN: -35, thF: 6, shF: -45, ftN: 20, ftF: 10 },
    back: () => prop.line([60, 36], [196, 36], 4) + prop.line([60, 36], [60, 190], 4) + prop.line([196, 36], [196, 190], 4),
    front: () => prop.bar([128, 36]),
    tips: ['Palmi verso di te, mani alla larghezza delle spalle', 'Mento sopra la sbarra', 'Scendi fino a braccia distese'],
  },
  pushup: {
    title: 'Piegamenti sulle braccia', primary: ['petto'], secondary: ['tricipiti', 'deltoidi-ant'],
    A: { anchor: ['toeN', [40, 188]], hip: [0, 0], torso: 110, neck: 110, thN: -70, shN: -70, ftN: 0, thF: -70, shF: -70, ftF: 0, handN: [46.5, 36], handF: [42.5, 36], elbowN: 'back', elbowF: 'back' },
    B: { anchor: ['toeN', [40, 188]], hip: [0, 0], torso: 97, neck: 99, thN: -83, shN: -83, ftN: 0, thF: -83, shF: -83, ftF: 0, handN: [43, 19.6], handF: [39, 19.6], elbowN: 'up', elbowF: 'up' },
    tips: ['Corpo in linea da testa a talloni', 'Mani sotto le spalle', 'Petto quasi a terra, poi spingi'],
  },
  db_lunge: {
    title: 'Affondi con manubri', primary: ['quadricipiti', 'glutei'], secondary: ['femorali'],
    A: { hip: [100, 124], torso: 178, footN: [138, 187], footF: [64, 184], kneeF: 'front', ftF: 140, uaN: 2, faN: 0, uaF: 0, faF: 0 },
    B: { hip: [98, 148], torso: 176, footN: [138, 187], footF: [64, 184], kneeF: 'down', ftF: 140, uaN: 4, faN: 0, uaF: 2, faF: 0 },
    front: (J) => dbsLong(J, 16),
    tips: ['Passo lungo, busto dritto', 'Scendi finché il ginocchio dietro sfiora terra', 'Spingi con il tallone davanti'],
  },
  goblet_squat: {
    title: 'Goblet squat', primary: ['quadricipiti', 'glutei'], secondary: ['femorali', 'addome'],
    A: { hip: [110, 114], torso: 178, footN: [118, 187], footF: [112, 187], uaN: 14, faN: 162, uaF: 12, faF: 160 },
    B: { hip: [88, 152], torso: 158, neck: 166, footN: [118, 187], footF: [112, 187], uaN: 0, faN: 140, uaF: -2, faF: 138 },
    front: (J) => prop.dbSide(add(J.handN, [1, 0], 3), 0, false, 20),
    tips: ['Manubrio tenuto al petto', 'Gomiti dentro le ginocchia in basso', 'Busto alto, talloni a terra'],
  },
  sl_db_deadlift: {
    title: 'Stacco a gambe tese con manubri', primary: ['femorali'], secondary: ['glutei', 'lombari'],
    A: { hip: [112, 114], torso: 178, footN: [118, 187], footF: [112, 187], uaN: 2, faN: 0, uaF: 0, faF: 0 },
    B: { hip: [96, 118], torso: 100, neck: 108, footN: [118, 187], footF: [112, 187], uaN: 0, faN: 0, uaF: -2, faF: -2 },
    front: (J) => dbsLong(J),
    tips: ['Ginocchia quasi tese', 'Anche indietro, schiena neutra', 'Manubri vicini alle gambe'],
  },
  seated_calf: {
    title: 'Calf da seduto', primary: ['polpacci'], secondary: [],
    A: { ...SEAT, anchor: ['toeN', [150, 180]], hip: [0, 0], shN: 0, shF: -2, ftN: 104, ftF: 104, uaN: 20, faN: 80, uaF: 18, faF: 78 },
    B: { ...SEAT, anchor: ['toeN', [150, 180]], hip: [0, 0], shN: 0, shF: -2, ftN: 52, ftF: 52, uaN: 20, faN: 80, uaF: 18, faF: 78 },
    back: () => prop.rect(140, 180, 26, 10, '#b9ad9c'),
    front: (J) => prop.rect(J.hip[0] - 24, J.hip[1] + 6, 44, 7) + prop.line([J.hip[0] - 2, J.hip[1] + 13], [J.hip[0] - 2, 190], 4) + prop.rect(J.kneeN[0] - 10, J.kneeN[1] - 14, 22, 8, COL.padLight),
    tips: ['Cuscino appoggiato sopra le ginocchia', 'Scendi bene con il tallone', 'Sali sulle punte e tieni 1″'],
  },
  cable_crunch: {
    title: 'Crunch ai cavi', primary: ['addome'], secondary: [],
    A: { anchor: ['kneeN', [104, 184]], hip: [0, 0], torso: 168, neck: 160, thN: 0, shN: -90, ftN: 0, thF: 2, shF: -90, ftF: 0, handN: [22, -58], handF: [18, -58], elbowN: 'down', elbowF: 'down' },
    B: { anchor: ['kneeN', [104, 184]], hip: [0, 0], torso: 96, neck: 70, thN: 0, shN: -90, ftN: 0, thF: 2, shF: -90, ftF: 0, handN: [60, 4], handF: [56, 4], elbowN: 'down', elbowF: 'down' },
    back: () => tower(196), front: (J) => prop.cable(J.handN, [194, 22]) + pulley([194, 22]),
    tips: ['In ginocchio, corda ai lati della testa', 'Arrotola la schiena portando i gomiti alle cosce', 'Le anche restano ferme'],
  },
  plank: {
    title: 'Plank', primary: ['addome'], secondary: ['deltoidi-ant', 'glutei'],
    A: { anchor: ['toeN', [40, 188]], hip: [0, 0], torso: 97, neck: 99, thN: -83, shN: -83, ftN: 0, thF: -83, shF: -83, ftF: 0, uaN: 0, faN: 90, uaF: 0, faF: 90 },
    B: { anchor: ['toeN', [40, 188]], hip: [0, 0], torso: 96, neck: 98, thN: -84, shN: -84, ftN: 0, thF: -84, shF: -84, ftF: 0, uaN: 0, faN: 90, uaF: 0, faF: 90 },
    tips: ['Gomiti sotto le spalle', 'Corpo dritto, glutei e addome contratti', 'Respira senza far cadere il bacino'],
  },
  hack_squat: {
    title: 'Hack squat', primary: ['quadricipiti'], secondary: ['glutei', 'femorali'],
    A: { hip: [106, 112], torso: 192, neck: 188, footN: [130, 187], footF: [124, 187], uaN: 12, faN: 150, uaF: 10, faF: 148 },
    B: { hip: [90, 148], torso: 204, neck: 196, footN: [130, 187], footF: [124, 187], uaN: 20, faN: 160, uaF: 18, faF: 158 },
    back: () => prop.line([40, 190], [120, 20], 4),
    front: (J) => { const v = [J.shoulder[0] - J.hip[0], J.shoulder[1] - J.hip[1]], l = Math.hypot(...v), d = [v[0] / l, v[1] / l], n = [-d[1], d[0]]; return prop.pad(add(add(J.hip, n, -12), d, -8), Math.atan2(d[0], d[1]) * 180 / Math.PI, 66, -7); },
    tips: ['Schiena tutta appoggiata allo schienale', 'Piedi a metà pedana', 'Scendi profondo senza staccare i talloni'],
  },
  arnold_press: {
    title: 'Arnold press', view: 'front', primary: ['deltoidi-ant', 'deltoidi'], secondary: ['tricipiti'],
    A: { hip: [120, 114], torso: 180, ua: 24, uaScale: 0.45, fa: 178, th: 6, sh: -2 }, B: { hip: [120, 114], torso: 180, ua: 160, uaScale: 1, fa: 176, th: 6, sh: -2 },
    front: (J) => prop.dbSide(J.handR, 90, false, 18) + prop.dbSide(J.handL, 90, false, 18),
    tips: ['Parti con i palmi verso di te davanti al viso', 'Ruota le mani mentre spingi in alto', 'Torna giù invertendo la rotazione'],
  },
  straight_arm_pulldown: {
    title: 'Pull down a braccia tese', primary: ['dorso'], secondary: ['tricipiti'],
    A: { ...STAND, torso: 168, neck: 172, uaN: 148, faN: 148, uaF: 146, faF: 146 }, B: { ...STAND, torso: 168, neck: 172, uaN: 12, faN: 12, uaF: 10, faF: 10 },
    back: () => tower(196), front: (J) => prop.cable(J.handN, [194, 22]) + pulley([194, 22]) + handle(J),
    tips: ['Braccia quasi tese per tutto il movimento', 'Porta la sbarra alle cosce usando i dorsali', 'Busto fermo, leggermente inclinato'],
  },
  // ---- dai programmi 8 settimane ----
  bb_hip_thrust: {
    title: 'Hip thrust con bilanciere', primary: ['glutei'], secondary: ['femorali', 'quadricipiti'],
    A: { hip: [104, 174], torso: 234, neck: 246, footN: [152, 188], footF: [146, 188], kneeN: 'up', kneeF: 'up', handN: [110, 160], handF: [106, 160], elbowN: 'up', elbowF: 'up' },
    B: { hip: [112, 150], torso: 258, neck: 272, footN: [152, 188], footF: [146, 188], kneeN: 'up', kneeF: 'up', handN: [118, 136], handF: [114, 136], elbowN: 'up', elbowF: 'up' },
    back: () => prop.bench(18, 74, 140),
    front: (J) => prop.plate([J.hip[0] + 2, J.hip[1] - 15], 15),
    tips: ['Scapole appoggiate al bordo della panca', 'Pausa breve in chiusura, mento verso il petto', 'Niente iperestensione della schiena'],
  },
  db_rdl: {
    title: 'Stacco rumeno con manubri', primary: ['femorali', 'glutei'], secondary: ['lombari'],
    A: { hip: [112, 114], torso: 178, footN: [118, 187], footF: [112, 187], uaN: 2, faN: 0, uaF: 0, faF: 0 },
    B: { hip: [94, 122], torso: 104, neck: 112, footN: [118, 187], footF: [112, 187], uaN: 0, faN: 0, uaF: -2, faF: -2 },
    front: (J) => dbsLong(J),
    tips: ['Ginocchia morbide, anche indietro', 'Manubri che scorrono vicino alle gambe', 'Fermati quando la schiena non resta neutra'],
  },
  lat_pulldown_neutral: pulldown('Lat machine presa neutra', 196, [101, 38], [95, 97], ['bicipiti', 'deltoidi-post'],
    ['Palmi uno verso l\'altro', 'Abbassa le scapole prima di tirare', 'Gomiti verso i fianchi']),
  single_arm_pulldown: {
    title: 'Lat machine unilaterale al cavo', primary: ['dorso'], secondary: ['bicipiti'],
    A: { ...SEAT, hip: [96, 140], torso: 188, neck: 184, handN: [101, 38], elbowN: 'back', uaF: 10, faF: 70 },
    B: { ...SEAT, hip: [96, 140], torso: 194, neck: 188, handN: [94, 98], elbowN: 'back', uaF: 10, faF: 70 },
    back: latBack,
    front: (J) => prop.cable(J.handN, [PULL_X, 12]) + pulley([PULL_X, 12]) + handle(J),
    tips: ['Allunga bene in alto senza ruotare il busto', 'Porta il gomito verso il fianco', 'Un braccio alla volta, stesse ripetizioni per lato'],
  },
  cable_lateral_raise: {
    title: 'Alzate laterali ai cavi', view: 'front', primary: ['deltoidi'], secondary: ['trapezi'],
    A: { hip: [120, 114], torso: 180, ua: 14, fa: 10, th: 3, sh: -2 }, B: { hip: [120, 114], torso: 180, ua: 86, fa: 84, th: 3, sh: -2 },
    back: () => prop.rect(40, 160, 18, 30, COL.pad, 3) + prop.rect(182, 160, 18, 30, COL.pad, 3),
    front: (J) => prop.cable(J.handR, [192, 168]) + prop.cable(J.handL, [48, 168]) + pulley([192, 168]) + pulley([48, 168]) + handle(J, 'R') + handle(J, 'L'),
    tips: ['Cavo dal basso, lato opposto al braccio', 'Guida con il gomito fino all\'altezza della spalla', 'Tensione continua, niente oscillazioni'],
  },
  chest_press: {
    title: 'Chest press', primary: ['petto'], secondary: ['tricipiti', 'deltoidi-ant'],
    A: { ...SEAT, hip: [92, 140], torso: 186, neck: 182, handN: [110, 96], handF: [106, 96], elbowN: 'back', elbowF: 'back' },
    B: { ...SEAT, hip: [92, 140], torso: 186, neck: 182, handN: [142, 94], handF: [138, 94], elbowN: 'down', elbowF: 'down' },
    back: () => seat(70, 146, 46) + prop.pad([72, 146], 186, 62, -8) + prop.line([160, 190], [160, 60], 4) + prop.line([160, 64], [124, 64], 3.5),
    front: (J) => handle(J) + prop.line([J.handN[0], J.handN[1] - 6], [160, 70], 3, COL.frame),
    tips: ['Schiena e scapole appoggiate', 'Maniglie all\'altezza del petto', 'Spingi senza bloccare i gomiti'],
  },
  cable_kickback: {
    title: 'Kickback al cavo', primary: ['glutei'], secondary: ['femorali'],
    A: { hip: [108, 114], torso: 166, neck: 170, thN: 6, shN: 0, ftN: 90, footF: [116, 187], ftF: 90, handN: [150, 92], handF: [146, 92], elbowN: 'down', elbowF: 'down' },
    B: { hip: [108, 114], torso: 162, neck: 168, thN: -38, shN: -26, ftN: 60, footF: [116, 187], ftF: 90, handN: [150, 92], handF: [146, 92], elbowN: 'down', elbowF: 'down' },
    back: () => tower(168, 40),
    front: (J) => prop.cable(J.ankleN, [166, 182]) + pulley([166, 182]),
    tips: ['Cavigliera al piede, busto leggermente inclinato', 'Spingi la gamba indietro con il gluteo', 'Bacino fermo, niente inarcamento'],
  },
  reverse_fly_machine: {
    title: 'Reverse fly alla macchina', view: 'front', primary: ['deltoidi-post'], secondary: ['trapezi', 'dorso'],
    A: { hip: [120, 132], torso: 180, ua: 40, uaScale: 0.45, fa: 40, faScale: 0.45, th: 10, thScale: 0.42, sh: 2 },
    B: { hip: [120, 132], torso: 180, ua: 90, uaScale: 1, fa: 92, faScale: 1, th: 10, thScale: 0.42, sh: 2 },
    back: () => prop.rect(88, 134, 64, 9) + prop.line([60, 190], [60, 40], 4) + prop.line([180, 190], [180, 40], 4),
    front: (J) => handle(J, 'R') + handle(J, 'L'),
    tips: ['Petto contro il cuscino, spalle basse', 'Apri le braccia all\'indietro con i gomiti morbidi', 'Pausa breve in apertura'],
  },
  incline_db_curl: {
    title: 'Curl con manubri su panca inclinata', primary: ['bicipiti'], secondary: ['avambracci'],
    A: { ...INCL, torso: 222, neck: 210, hip: [136, 150], uaN: 0, faN: 0, uaF: -3, faF: -3 },
    B: { ...INCL, torso: 222, neck: 210, hip: [136, 150], uaN: 2, faN: 150, uaF: -1, faF: 146 },
    back: (J) => {
      const d = dirv(222), n = [-d[1], d[0]];
      const p0 = add(add(J.hip, n, -11), d, -6);
      return prop.pad(p0, 222, 74, -8) + prop.rect(112, 159, 48, 7) + prop.line([134, 166], [134, 190], 4) + prop.line(add(p0, d, 50), [96, 190], 4);
    },
    front: (J) => dbsEnd(J),
    tips: ['Braccia che pendono dietro al busto', 'Palmi in avanti, gomiti fermi', 'Estensione completa in basso'],
  },
  cable_curl: {
    title: 'Curl al cavo', primary: ['bicipiti'], secondary: ['avambracci'],
    A: { ...STAND, uaN: 6, faN: 10, uaF: 2, faF: 6 }, B: { ...STAND, uaN: 10, faN: 150, uaF: 6, faF: 146 },
    back: () => tower(172, 120),
    front: (J) => prop.cable(J.handN, [170, 176]) + pulley([170, 176]) + prop.bar(J.handN),
    tips: ['Gomiti fermi ai fianchi', 'Sali senza spostare il busto', 'Tensione costante anche in basso'],
  },
  cable_overhead_triceps: {
    title: 'Estensioni tricipiti sopra la testa al cavo', primary: ['tricipiti'], secondary: [],
    A: { hip: [116, 116], torso: 150, neck: 156, footN: [146, 187], footF: [96, 187], uaN: 168, faN: 330, uaF: 166, faF: 328 },
    B: { hip: [116, 116], torso: 150, neck: 156, footN: [146, 187], footF: [96, 187], uaN: 166, faN: 160, uaF: 164, faF: 158 },
    back: () => tower(8, 20),
    front: (J) => prop.cable(J.handN, [32, 52]) + pulley([32, 52]) + prop.line([J.handN[0] - 3, J.handN[1] - 4], [J.handN[0] + 4, J.handN[1] + 5], 3.5, COL.metal),
    tips: ['Di spalle al cavo, un piede avanti', 'Gomiti vicini alla testa e fermi', 'Allunga bene dietro la nuca, poi estendi'],
  },
};

// nome nel catalogo (Free Exercise DB) → id movimento
export const FROM_CATALOG = {
  'Wide-Grip_Lat_Pulldown': 'lat_pulldown_wide', 'Close-Grip_Front_Lat_Pulldown': 'lat_pulldown_close', Leg_Press: 'leg_press',
  Leg_Extensions: 'leg_extension', Seated_Leg_Curl: 'seated_leg_curl', Cable_Crossover: 'cable_crossover', Butterfly: 'pec_deck',
  Dumbbell_Flyes: 'db_fly', Incline_Dumbbell_Flyes: 'incline_db_fly', 'Triceps_Pushdown_-_Rope_Attachment': 'triceps_pushdown',
  Hammer_Curls: 'hammer_curl', Preacher_Curl: 'preacher_curl', Dumbbell_Bicep_Curl: 'db_curl', Face_Pull: 'face_pull',
  Front_Dumbbell_Raise: 'front_raise', 'EZ-Bar_Skullcrusher': 'skullcrusher', Upright_Barbell_Row: 'upright_row',
  Bent_Over_Barbell_Row: 'bb_row', 'T-Bar_Row_with_Handle': 't_bar_row', 'Chin-Up': 'chin_up', Pushups: 'pushup',
  Dumbbell_Lunges: 'db_lunge', Goblet_Squat: 'goblet_squat', 'Stiff-Legged_Dumbbell_Deadlift': 'sl_db_deadlift',
  Seated_Calf_Raise: 'seated_calf', Cable_Crunch: 'cable_crunch', Plank: 'plank', Hack_Squat: 'hack_squat',
  Arnold_Dumbbell_Press: 'arnold_press', 'Straight-Arm_Pulldown': 'straight_arm_pulldown',
};

// nomi usati nei programmi a 8 settimane → id movimento
export const PROGRAM_NAMES = {
  'Panca piana bilanciere': 'bb_bench', 'Panca inclinata manubri': 'incline_db_bench', 'Leg press': 'leg_press', 'Leg press (quadricipiti)': 'leg_press',
  'Leg extension': 'leg_extension', 'Alzate laterali ai cavi': 'cable_lateral_raise', 'Push-down corda': 'triceps_pushdown', 'Push-down cavo': 'triceps_pushdown',
  'Trazioni prone (zavorra se possibile)': 'pullup', 'Rematore chest-supported': 'chest_supported_row', 'Rematore macchina petto supportato': 'chest_supported_row',
  'Stacco rumeno': 'rdl', 'Stacco rumeno manubri': 'db_rdl', 'Leg curl seduto': 'seated_leg_curl', 'Leg curl sdraiato': 'leg_curl',
  'Reverse fly macchina/cavi': 'reverse_fly_machine', 'Reverse fly macchina': 'reverse_fly_machine', 'Curl manubri panca inclinata': 'incline_db_curl',
  'Squat high-bar': 'back_squat', 'Bulgarian split squat': 'bulgarian_split_squat', 'Bulgarian split squat (bias glutei)': 'bulgarian_split_squat',
  'Shoulder press manubri': 'db_military', 'Shoulder press macchina/manubri': 'db_military', 'Croci ai cavi': 'cable_crossover',
  'Calf raise in piedi': 'calf_raise', 'Calf raise': 'calf_raise', 'Lat machine presa neutra': 'lat_pulldown_neutral', 'Lat machine presa neutra/larga': 'lat_pulldown_neutral',
  'Rematore cavo basso': 'cable_row', 'Pulley presa stretta': 'cable_row', 'Back extension 45° (erettori)': 'back_extension', 'Curl al cavo': 'cable_curl',
  'Estensioni tricipiti sopra testa al cavo': 'cable_overhead_triceps', 'Hip thrust bilanciere': 'bb_hip_thrust', 'Abduzione macchina': 'abductor_machine',
  'Alzate laterali manubri': 'lateral_raise', 'Lat machine unilaterale al cavo': 'single_arm_pulldown', 'Chest press': 'chest_press', 'Curl manubri': 'db_curl',
  'Glute drive / hip thrust macchina': 'hip_thrust_machine', 'Kickback al cavo': 'cable_kickback', 'Crunch cavo': 'cable_crunch',
};
