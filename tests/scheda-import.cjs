// Formato «palestra-scheda»: lettura, conversione nella bozza dell'editor ed errori chiari.
// Non serve il server: node tests/scheda-import.cjs
const fs = require('fs');
const path = require('path');
let bad = 0;
const ok = (m) => console.log('  ✓ ' + m), ko = (m) => { bad++; console.log('  ✗ ' + m); };
const check = (cond, m) => (cond ? ok(m) : ko(m));

(async () => {
  const root = path.join(__dirname, '..');
  const { parseSchedaJSON, parseRecupero, recuperoTxt } = await import(path.join(root, 'js/scheda-import.js'));
  const { LIB, MUSCLES } = await import(path.join(root, 'js/exercises.js'));
  const { guessLoad } = await import(path.join(root, 'js/editor.js'));
  const opts = { lib: LIB, muscles: MUSCLES, customEx: {}, guessLoad };

  console.log('\n===== esempio della documentazione');
  const r = parseSchedaJSON(fs.readFileSync(path.join(root, 'docs/esempio-scheda.json'), 'utf8'), opts);
  check(r.ok, 'esempio valido' + (r.ok ? '' : ': ' + r.errori.join(' | ')));
  const d = r.draft;
  check(d.titolo === 'Ipertrofia 3 giorni' && d.inizio === '2027-01-04' && d.settimane === 8, 'titolo, inizio e settimane');
  check(d.giorni.map((g) => g.g).join('') === 'ABC' && d.giorni[0].nome === 'Spinta', 'giornate A B C con i nomi');
  const panca = d.giorni[0].esercizi[0];
  check(panca.key === 'bb_bench' && panca.nome === LIB.bb_bench.title && panca.serie === 4 && panca.reps === '6-8' && panca.recupero === '2′30″' && panca.kg === 70 && panca.tipoCarico === 'barbell', 'esercizio: nome dal catalogo, serie, reps, recupero 2′30″, kg, carico');
  check(d.giorni[0].esercizi.map((x) => x.ss).join() === 'false,false,true,false', 'superserie: ss solo sul primo dei due');
  check(d.giorni[1].esercizi[3].nome === 'Curl bilanciere EZ', 'nome personalizzato tenuto');
  check(r.nuoviEsercizi.pressa_orizzontale && r.nuoviEsercizi.pressa_orizzontale.primary[0] === 'quadricipiti', 'esercizio fuori catalogo creato con i muscoli');
  check(d.giorni[2].esercizi[2].key === 'pressa_orizzontale', 'la bozza usa la chiave del nuovo esercizio');
  check(d.giorni[0].attrezzatura.length === 0 && d.giorni[1].attrezzatura.join() === 'cintura_zavorra,straps' && d.giorni[2].attrezzatura.join() === 'cintura,scarpe_squat', 'attrezzatura per giornata (anche col nome mostrato)');
  // le chiavi della bozza sono quelle dell'editor
  check(JSON.stringify(Object.keys(panca).sort()) === JSON.stringify(['id', 'nome', 'key', 'serie', 'reps', 'recupero', 'tipoCarico', 'ss', 'kg', 'note'].sort()), 'campi della bozza come in editor.js (+ kg, note)');

  console.log('\n===== conversioni');
  check([30, 45, 60, 75, 90, 100, 120, 150, 180, 240].map(recuperoTxt).join(' ') === '30″ 45″ 60″ 75″ 90″ 100″ 2′ 2′30″ 3′ 4′', 'recupero: notazione dell\'app');
  check(['90', '90s', '2:30', "2'", '2′30″', '1m30s', '2 min'].map((v) => parseRecupero(v).sec).join() === '90,90,150,120,150,90,120', 'recupero scritto in vari modi');
  const mini = (ex, extra = {}) => ({ formato: 'palestra-scheda', versione: 1, scheda: { titolo: 'T', settimane: 4, giorni: [{ nome: 'G', esercizi: [ex] }], ...extra } });
  let x = parseSchedaJSON(mini({ esercizio: 'db_curl', ripetizioni: 12 }), opts);
  check(x.ok && x.draft.inizio === null && x.draft.giorni[0].esercizi[0].reps === '12' && x.draft.giorni[0].esercizi[0].serie === 3 && x.draft.giorni[0].esercizi[0].recupero === '', 'campi facoltativi: inizio null, serie 3, senza recupero');
  check(x.draft.giorni[0].esercizi[0].tipoCarico === 'sum', 'tipoCarico dedotto dal nome (manubri = somma)');
  x = parseSchedaJSON(mini({ esercizio: 'db_curl', ripetizioni: '10–8' }, { inizio: '2027-01-06' }), opts);
  check(x.ok && x.draft.giorni[0].esercizi[0].reps === '8-10' && x.draft.inizio === '2027-01-04' && x.avvisi.some((a) => a.includes('lunedì')), 'intervallo rovesciato e inizio portato al lunedì');
  x = parseSchedaJSON(mini({ esercizio: 'nuovo_x', nome: 'Nuovo X', muscoli: { primari: ['Dorsali'], secondari: ['bicipiti'] }, ripetizioni: 10 }), opts);
  check(x.ok && x.nuoviEsercizi.nuovo_x.primary[0] === 'dorso', 'muscoli anche col nome mostrato (Dorsali = dorso)');

  x = parseSchedaJSON({ formato: 'palestra-scheda', versione: 1, scheda: { titolo: 'T', giorni: [{ nome: 'G', attrezzatura: ['Fasce', 'fasce', 'Corda per saltare'], esercizi: [{ esercizio: 'db_curl', ripetizioni: 10 }] }] } }, opts);
  check(x.ok && x.draft.giorni[0].attrezzatura.join() === 'fasce,Corda per saltare' && x.avvisi.some((a) => a.includes('voce libera')), 'attrezzatura: doppioni tolti, voce libera con avviso');

  console.log('\n===== errori');
  const err = (inp, frase, m) => { const e = parseSchedaJSON(inp, opts); check(!e.ok && e.errori.some((t) => t.includes(frase)), m + (e.ok ? ' (accettato)' : `: ${e.errori[0]}`)); };
  err('{ non json', 'JSON valido', 'testo non JSON');
  err({ formato: 'palestra-export' }, 'non è una scheda', 'file di un altro tipo');
  err(mini({ esercizio: 'inesistente', ripetizioni: 10 }), 'non è nel catalogo', 'id sconosciuto senza muscoli');
  err(mini({ esercizio: 'db_curl', ripetizioni: 'max' }), 'ripetizioni', 'ripetizioni non numeriche');
  err(mini({ esercizio: 'db_curl', ripetizioni: 10, serie: 0 }), 'serie', 'serie fuori intervallo');
  err(mini({ esercizio: 'db_curl', ripetizioni: 10, tipoCarico: 'kg' }), 'tipoCarico', 'tipoCarico sconosciuto');
  err(mini({ esercizio: 'db_curl', ripetizioni: 10, recupero: 'poco' }), 'recupero', 'recupero illeggibile');
  err({ formato: 'palestra-scheda', scheda: { titolo: 'T', giorni: [] } }, 'giorni', 'nessuna giornata');
  err({ formato: 'palestra-scheda', scheda: { titolo: 'T', giorni: [{ nome: 'G', attrezzatura: ['x'.repeat(40)], esercizi: [{ esercizio: 'db_curl', ripetizioni: 10 }] }] } }, 'troppo lungo', 'attrezzo troppo lungo');

  console.log(bad ? `\n${bad} controlli falliti` : '\nTutto ok');
  process.exit(bad ? 1 : 0);
})();
