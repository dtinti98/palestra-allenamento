// Lettura di una scheda in formato «palestra-scheda» (vedi docs/formato-scheda.md).
// Modulo puro: niente DOM e niente salvataggi. Restituisce la bozza nella stessa forma
// di quella dell'editor (js/editor.js), da aprire nell'editor perché la si controlli e salvi.
//
//   parseSchedaJSON(testoOppureOggetto, { lib, muscles, customEx, guessLoad, attrezzi })
//     -> { ok: true, draft, nuoviEsercizi, avvisi }
//     -> { ok: false, errori, avvisi }

export const FORMATO = 'palestra-scheda';
export const VERSIONE = 1;
export const TIPI_CARICO_VALIDI = ['barbell', 'machine', 'sum', 'single', 'plate', 'bw', 'free'];
const LETTERS = 'ABCDEFGHIJ'.split('');
// attrezzatura da portare: stesse chiavi di ATTREZZI in js/editor.js (sovrascrivibili con opts.attrezzi)
export const ATTREZZI_NOTI = [['cintura', 'Cintura'], ['fasce', 'Fasce'], ['straps', 'Straps'], ['cintura_zavorra', 'Cintura zavorra'], ['ginocchiere', 'Ginocchiere'],
  ['gomitiere', 'Gomitiere'], ['magnesite', 'Magnesite'], ['guanti', 'Guanti'], ['elastici', 'Elastici'], ['cavigliere', 'Cavigliere'], ['scarpe_squat', 'Scarpe da squat'], ['asciugamano', 'Asciugamano']];

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const txt = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = (s) => txt(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// secondi -> scrittura dell'app: 90 -> 90″, 120 -> 2′, 150 -> 2′30″
export function recuperoTxt(sec) {
  if (sec < 120) return `${sec}″`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}′${s ? `${s}″` : ''}`;
}
// accetta 90, "90", "90s", "90″", "90\"", "2'", "2′30″", "2:30", "2 min", "1m30s"
export function parseRecupero(v) {
  if (v === null || v === undefined || v === '') return { sec: null };
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 && v <= 900 ? { sec: Math.round(v) } : { err: true };
  const t = String(v).trim().toLowerCase().replace(/\s+/g, '');
  let m;
  if ((m = t.match(/^(\d+):(\d{1,2})$/))) return { sec: +m[1] * 60 + +m[2] };
  if ((m = t.match(/^(\d+)(?:s|sec|″|"|'')?$/))) return +m[1] <= 900 ? { sec: +m[1] } : { err: true };
  if ((m = t.match(/^(\d+)(?:m|min|′|')(?:(\d+)(?:s|sec|″|"|'')?)?$/))) return { sec: +m[1] * 60 + (+m[2] || 0) };
  return { err: true };
}
// "8-10", "8–10", "10", 10 -> "8-10" / "10"
export function parseRipetizioni(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0 && v <= 100 ? String(v) : null;
  const t = String(v ?? '').trim();
  let m = t.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (m) { const a = Math.min(+m[1], +m[2]), b = Math.max(+m[1], +m[2]); return a > 0 && b <= 100 ? (a === b ? `${a}` : `${a}-${b}`) : null; }
  m = t.match(/^(\d+)$/);
  return m && +m[1] > 0 && +m[1] <= 100 ? m[1] : null;
}
const isoOk = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00Z'));
const mondayOf = (iso) => { const d = new Date(iso + 'T12:00:00Z'); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10); };

export function parseSchedaJSON(input, opts = {}) {
  const lib = opts.lib || {}, muscles = opts.muscles || {}, customEx = opts.customEx || {};
  const guess = opts.guessLoad || (() => 'machine');
  const gear = new Map((opts.attrezzi || ATTREZZI_NOTI).flatMap(([k, l]) => [[norm(k), k], [norm(k).replace(/_/g, ' '), k], [norm(l), k]]));
  const errori = [], avvisi = [];
  const fail = () => ({ ok: false, errori, avvisi });

  let data = input;
  if (typeof input === 'string') {
    try { data = JSON.parse(input.replace(/^﻿/, '')); } catch (e) { errori.push(`Il file non è un JSON valido (${e.message}).`); return fail(); }
  }
  if (!isObj(data)) { errori.push('Il file deve contenere un oggetto JSON { ... }.'); return fail(); }
  let sch = data.scheda;
  if (data.formato !== FORMATO) {
    if (!data.formato && isObj(data) && Array.isArray(data.giorni)) { sch = data; avvisi.push('Manca "formato": letto come scheda.'); }
    else { errori.push(`Questo file non è una scheda: "formato" deve essere "${FORMATO}"${data.formato ? ` (trovato "${data.formato}")` : ''}.`); return fail(); }
  }
  if (data.versione !== undefined && data.versione > VERSIONE) avvisi.push(`File in versione ${data.versione}: l'app conosce la ${VERSIONE}, i campi nuovi vengono ignorati.`);
  if (!isObj(sch)) { errori.push('Manca l\'oggetto "scheda".'); return fail(); }

  const titolo = txt(sch.titolo).slice(0, 60) || 'Scheda importata';
  if (!txt(sch.titolo)) avvisi.push('Manca "titolo": uso «Scheda importata».');

  let settimane = 8;
  if (sch.settimane !== undefined) {
    if (Number.isInteger(sch.settimane) && sch.settimane >= 1 && sch.settimane <= 26) settimane = sch.settimane;
    else errori.push('"settimane" deve essere un numero intero da 1 a 26.');
  } else avvisi.push('Manca "settimane": uso 8.');

  let inizio = null; // se manca, l'app propone il lunedì corrente
  if (sch.inizio !== undefined && sch.inizio !== null && sch.inizio !== '') {
    if (!isoOk(sch.inizio)) errori.push('"inizio" deve essere una data AAAA-MM-GG.');
    else { inizio = mondayOf(sch.inizio); if (inizio !== sch.inizio) avvisi.push(`"inizio" ${sch.inizio} non è un lunedì: uso lunedì ${inizio}.`); }
  }

  if (!Array.isArray(sch.giorni) || !sch.giorni.length) { errori.push('"giorni" deve essere una lista con almeno una giornata.'); return fail(); }
  if (sch.giorni.length > LETTERS.length) { errori.push(`Al massimo ${LETTERS.length} giornate (trovate ${sch.giorni.length}).`); return fail(); }

  // muscoli: chiave (petto) o nome mostrato (Petto, Dorsali...)
  const byLabel = new Map(Object.entries(muscles).flatMap(([k, l]) => [[norm(k), k], [norm(l), k]]));
  const muscolo = (m) => byLabel.get(norm(m)) || null;
  const titoloDi = (key) => (lib[key] && lib[key].title) || (customEx[key] && customEx[key].title) || null;

  const nuoviEsercizi = {};
  const giorni = sch.giorni.map((gd, gi) => {
    const g = LETTERS[gi];
    const dove = `Giornata ${g}`;
    if (!isObj(gd)) { errori.push(`${dove}: deve essere un oggetto { "nome", "esercizi" }.`); return { g, nome: `Giorno ${g}`, attrezzatura: [], esercizi: [] }; }
    const nome = txt(gd.nome).slice(0, 40) || `Giorno ${g}`;
    // attrezzatura: chiave nota (o il suo nome) oppure testo libero di max 30 caratteri
    let attrezzatura = [];
    if (gd.attrezzatura !== undefined && gd.attrezzatura !== null) {
      const lista = typeof gd.attrezzatura === 'string' ? gd.attrezzatura.split(',') : gd.attrezzatura;
      if (!Array.isArray(lista)) errori.push(`${dove} (${nome}): "attrezzatura" deve essere una lista, es. ["cintura", "fasce"].`);
      else {
        for (const v of lista) {
          const t = txt(v);
          if (!t) continue;
          const k = gear.get(norm(t));
          if (k) attrezzatura.push(k);
          else if (t.length <= 30) { attrezzatura.push(t); avvisi.push(`${dove}: «${t}» non è tra gli attrezzi noti, aggiunto come voce libera.`); }
          else errori.push(`${dove} (${nome}): attrezzo «${t.slice(0, 40)}…» troppo lungo (max 30 caratteri).`);
        }
        attrezzatura = [...new Set(attrezzatura)];
      }
    }
    if (!Array.isArray(gd.esercizi) || !gd.esercizi.length) { errori.push(`${dove} (${nome}): "esercizi" deve essere una lista non vuota.`); return { g, nome, attrezzatura, esercizi: [] }; }
    const labels = [];
    const esercizi = gd.esercizi.map((x, xi) => {
      const at = `${dove}, esercizio ${xi + 1}`;
      if (!isObj(x)) { errori.push(`${at}: deve essere un oggetto.`); return null; }
      const key = txt(x.esercizio);
      if (!key) { errori.push(`${at}: manca "esercizio" (l'id del catalogo, es. "bb_bench").`); return null; }
      let title = titoloDi(key) || (nuoviEsercizi[key] && nuoviEsercizi[key].title);
      if (!title) {
        // esercizio non in catalogo: serve il nome e almeno un muscolo principale
        const pri = (x.muscoli?.primari || []).map(muscolo), sec = (x.muscoli?.secondari || []).map(muscolo);
        const nomeNuovo = txt(x.nome);
        if (!nomeNuovo || !pri.length || pri.includes(null) || sec.includes(null)) {
          errori.push(`${at}: «${key}» non è nel catalogo. Per crearlo servono "nome" e "muscoli": { "primari": [...], "secondari": [...] } con muscoli validi (${Object.keys(muscles).join(', ')}).`);
          return null;
        }
        title = nomeNuovo.slice(0, 50);
        nuoviEsercizi[key] = { title, primary: [...new Set(pri)], secondary: [...new Set(sec)].filter((m) => !pri.includes(m)) };
        avvisi.push(`«${title}» non è nel catalogo: verrà creato come esercizio tuo (senza disegno, con la mappa dei muscoli).`);
      } else if (x.muscoli) avvisi.push(`${at}: "muscoli" ignorato, «${title}» è già nel catalogo.`);

      const serie = x.serie === undefined ? 3 : x.serie;
      if (!Number.isInteger(serie) || serie < 1 || serie > 10) errori.push(`${at} (${title}): "serie" deve essere un intero da 1 a 10.`);
      const reps = parseRipetizioni(x.ripetizioni);
      if (!reps) errori.push(`${at} (${title}): "ripetizioni" deve essere un numero (10) o un intervallo ("8-10").`);
      const rec = parseRecupero(x.recupero);
      if (rec.err) errori.push(`${at} (${title}): "recupero" in secondi (es. 90) o come "2:30".`);
      let tipoCarico = x.tipoCarico;
      if (tipoCarico === undefined || tipoCarico === null) tipoCarico = guess(title);
      else if (!TIPI_CARICO_VALIDI.includes(tipoCarico)) { errori.push(`${at} (${title}): "tipoCarico" deve essere uno di ${TIPI_CARICO_VALIDI.join(', ')}.`); tipoCarico = 'machine'; }
      let kg = null;
      if (x.kg !== undefined && x.kg !== null) {
        if (typeof x.kg === 'number' && Number.isFinite(x.kg) && x.kg >= 0 && x.kg <= 1000) kg = Math.round(x.kg * 4) / 4;
        else errori.push(`${at} (${title}): "kg" deve essere un numero (es. 22.5).`);
      }
      labels.push(x.superserie === undefined || x.superserie === null || x.superserie === '' ? null : String(x.superserie));
      return {
        id: null, nome: txt(x.nome).slice(0, 60) || title, key, serie: Number.isInteger(serie) ? serie : 3, reps: reps || '10',
        recupero: rec.sec ? recuperoTxt(rec.sec) : '', tipoCarico, ss: false, kg, note: txt(x.note).slice(0, 300),
      };
    });
    // superserie: esercizi consecutivi con la stessa etichetta. Nella bozza «ss» lega l'esercizio al successivo.
    const seen = new Set();
    labels.forEach((l, i) => {
      if (!l) return;
      if (labels[i - 1] !== l && seen.has(l)) avvisi.push(`${dove}: superserie «${l}» con esercizi non consecutivi, legati solo quelli vicini.`);
      seen.add(l);
      if (labels[i + 1] === l && esercizi[i]) esercizi[i].ss = true;
      if (labels[i - 1] !== l && labels[i + 1] !== l) avvisi.push(`${dove}: superserie «${l}» con un solo esercizio, ignorata.`);
    });
    return { g, nome, attrezzatura, esercizi: esercizi.filter(Boolean) };
  });

  if (errori.length) return fail();
  return {
    ok: true,
    draft: { id: null, titolo, inizio, settimane, note: txt(sch.note).slice(0, 1000), giorni },
    nuoviEsercizi, avvisi,
  };
}
