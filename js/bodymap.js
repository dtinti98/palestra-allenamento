// Mappa del corpo (fronte e retro) con i muscoli di focus colorati.
import { COL } from './figure.js';

const SHAPES = {
  front: {
    deltoidi: [['c', 31, 44, 7], ['c', 69, 44, 7]],
    'deltoidi-ant': [['c', 32, 45, 6.5], ['c', 68, 45, 6.5]],
    trapezi: [['p', '42,33 50,36 58,33 62,38 38,38']],
    petto: [['e', 42, 52, 8.5, 6.5], ['e', 58, 52, 8.5, 6.5]],
    bicipiti: [['e', 27, 63, 4.2, 9], ['e', 73, 63, 4.2, 9]],
    avambracci: [['e', 23, 86, 3.8, 10], ['e', 77, 86, 3.8, 10]],
    addome: [['r', 44, 62, 12, 27]],
    abduttori: [['e', 35, 98, 3.6, 8], ['e', 65, 98, 3.6, 8]],
    quadricipiti: [['e', 42, 124, 6.5, 19], ['e', 58, 124, 6.5, 19]],
    polpacci: [['e', 40, 164, 3.5, 10], ['e', 60, 164, 3.5, 10]],
  },
  back: {
    trapezi: [['p', '150,30 163,40 150,58 137,40']],
    deltoidi: [['c', 131, 44, 7], ['c', 169, 44, 7]],
    'deltoidi-post': [['c', 131, 45, 6.5], ['c', 169, 45, 6.5]],
    dorso: [['e', 141, 62, 8, 13], ['e', 159, 62, 8, 13]],
    tricipiti: [['e', 127, 63, 4.2, 9], ['e', 173, 63, 4.2, 9]],
    avambracci: [['e', 123, 86, 3.8, 10], ['e', 177, 86, 3.8, 10]],
    lombari: [['e', 150, 84, 7, 7]],
    abduttori: [['e', 138, 94, 5, 5], ['e', 162, 94, 5, 5]],
    glutei: [['e', 143, 103, 7.5, 8], ['e', 157, 103, 7.5, 8]],
    femorali: [['e', 142, 128, 6.5, 17], ['e', 158, 128, 6.5, 17]],
    polpacci: [['e', 141, 163, 4.8, 11], ['e', 159, 163, 4.8, 11]],
  },
};

function silhouette(cx) {
  const ink = COL.ink, skin = COL.skin;
  const line = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="${w + 3.2}" stroke-linecap="round"/>`;
  const fill = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${skin}" stroke-width="${w}" stroke-linecap="round"/>`;
  const limbs = [
    [cx - 19, 44, cx - 24, 72, 10], [cx - 24, 72, cx - 27, 98, 8], [cx + 19, 44, cx + 24, 72, 10], [cx + 24, 72, cx + 27, 98, 8],
    [cx - 8, 102, cx - 8, 146, 14], [cx - 8, 146, cx - 9, 182, 10], [cx + 8, 102, cx + 8, 146, 14], [cx + 8, 146, cx + 9, 182, 10],
  ];
  let s = limbs.map((l) => line(...l)).join('') + limbs.map((l) => fill(...l)).join('');
  s += `<path d="M${cx - 21} 40 Q${cx} 32 ${cx + 21} 40 C${cx + 22} 64 ${cx + 15} 80 ${cx + 16} 104 L${cx - 16} 104 C${cx - 15} 80 ${cx - 22} 64 ${cx - 21} 40Z" fill="${skin}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>`;
  s += `<rect x="${cx - 4}" y="26" width="8" height="10" fill="${skin}" stroke="${ink}" stroke-width="1.6"/>`;
  s += `<circle cx="${cx}" cy="18" r="10" fill="${skin}" stroke="${ink}" stroke-width="1.8"/>`;
  return s;
}

function shape(sh, color) {
  const st = `fill="${color}" stroke="${COL.ink}" stroke-width="1" stroke-opacity=".55"`;
  if (sh[0] === 'c') return `<circle cx="${sh[1]}" cy="${sh[2]}" r="${sh[3]}" ${st}/>`;
  if (sh[0] === 'e') return `<ellipse cx="${sh[1]}" cy="${sh[2]}" rx="${sh[3]}" ry="${sh[4]}" ${st}/>`;
  if (sh[0] === 'r') return `<rect x="${sh[1]}" y="${sh[2]}" width="${sh[3]}" height="${sh[4]}" rx="5" ${st}/>`;
  return `<polygon points="${sh[1]}" ${st} stroke-linejoin="round"/>`;
}

export function bodyMapSVG(primary = [], secondary = []) {
  let s = `<svg viewBox="0 0 200 206" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Muscoli coinvolti"><rect width="200" height="206" fill="#fbf7f0"/>`;
  s += `<g filter="url(#pencilMap)">${silhouette(50)}${silhouette(150)}`;
  for (const [side, list, color] of [['front', secondary, COL.secondary], ['back', secondary, COL.secondary], ['front', primary, COL.primary], ['back', primary, COL.primary]]) {
    for (const m of list) for (const sh of SHAPES[side][m] || []) s += shape(sh, color);
  }
  s += `</g><text x="50" y="200" text-anchor="middle" font-size="9" fill="#7a7065" font-family="system-ui">fronte</text><text x="150" y="200" text-anchor="middle" font-size="9" fill="#7a7065" font-family="system-ui">retro</text>`;
  s += `<defs><filter id="pencilMap"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>`;
  return s;
}
