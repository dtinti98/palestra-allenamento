// «Importa scheda» dall'interfaccia: file d'esempio → editor precompilato → salvataggio → allenamento.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os');
const U = 'http://localhost:8765/';
const ESEMPIO = __dirname + '/../docs/esempio-scheda.json';
let bad = 0;
const ok = (m) => console.log('  ✓ ' + m), ko = (m) => { bad++; console.log('  ✗ ' + m); };

(async () => {
  const b = await chromium.launch();
  for (const [w, scheme] of [[390, 'light'], [320, 'dark']]) {
    console.log(`\n===== ${w}px ${scheme}`);
    const p = await b.newPage({ viewport: { width: w, height: 800 }, colorScheme: scheme });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
    const go = async (h) => { await p.goto(U + h); await p.waitForTimeout(250); };
    const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('palestra.v1')));
    const overflow = async (where) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 1) ko(`${where}: scroll orizzontale ${o}px`); };

    await go(''); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    await p.click('a[href="#/schede"]'); await p.waitForTimeout(200);
    (await p.$('#schImp')) ? ok('pulsante «Importa scheda» nelle schede') : ko('manca Importa scheda');

    // file sbagliato: errori in chiaro, nessuna scheda
    const badF = os.tmpdir() + '/scheda-errata.json';
    fs.writeFileSync(badF, JSON.stringify({ formato: 'palestra-scheda', versione: 1, scheda: { titolo: 'X', giorni: [{ nome: 'A', esercizi: [{ esercizio: 'boh', serie: 3, ripetizioni: '8-10' }] }] } }));
    await p.setInputFiles('#schImp', badF); await p.waitForTimeout(300);
    const errTxt = await p.$eval('#schImpErr', (e) => e.innerText).catch(() => '');
    /non è nel catalogo/.test(errTxt) ? ok('file con errori: messaggio chiaro') : ko('errori non mostrati: ' + errTxt);
    fs.writeFileSync(badF, '{ non json');
    await p.setInputFiles('#schImp', badF); await p.waitForTimeout(300);
    /JSON valido/.test(await p.$eval('#schImpErr', (e) => e.innerText).catch(() => '')) ? ok('file non JSON: messaggio chiaro') : ko('file non JSON');
    await overflow('errori import');

    // file d'esempio
    await p.setInputFiles('#schImp', ESEMPIO); await p.waitForTimeout(400);
    (await p.evaluate(() => location.hash)) === '#/scheda/nuova' ? ok('apre l\'editor') : ko('non apre l\'editor');
    (await p.$('.imp-ok')) ? ok('avviso «scheda importata»') : ko('manca avviso importata');
    (await p.$eval('#sTit', (e) => e.value)) === 'Ipertrofia 3 giorni' ? ok('titolo') : ko('titolo');
    (await p.$eval('#sIni', (e) => e.value)) === '2027-01-04' ? ok('inizio') : ko('inizio');
    (await p.$$('.ed-ex')).length === 12 ? ok('12 esercizi in 3 giornate') : ko('esercizi ' + (await p.$$('.ed-ex')).length);
    (await p.$eval('.ed-ex[data-g="0"][data-x="0"] [data-f="recupero"]', (e) => e.value)) === '2′30″' ? ok('recupero 150 → 2′30″') : ko('recupero');
    (await p.$('[data-ss="0:2"].on')) ? ok('superserie S1 collegata') : ko('superserie non collegata');
    await overflow('editor importato');
    await p.click('#sSave'); await p.waitForTimeout(300);
    const s = await st(); const sch = s.diario && s.diario.schede[0];
    (sch && sch.esercizi.length === 12 && sch.giorni.join('') === 'ABC') ? ok('scheda salvata') : ko('scheda non salvata');
    const bench = sch.esercizi[0];
    (bench.caricoIniziale === 70 && /Scapole/.test(bench.note) && bench.range.join('-') === '6-8') ? ok('carico iniziale, note e ripetizioni salvati') : ko('esercizio 1: ' + JSON.stringify(bench));
    (s.customEx && s.customEx.pressa_orizzontale && s.customEx.pressa_orizzontale.primary[0] === 'quadricipiti') ? ok('esercizio nuovo creato con i muscoli') : ko('esercizio nuovo: ' + JSON.stringify(s.customEx));
    (s.settings.superserie[`${sch.id}-A`] || []).length === 1 ? ok('superserie salvata') : ko('superserie salvata');

    // allenamento: carico proposto dal file
    await go('#/giorno/A'); await p.click('#start'); await p.waitForTimeout(250);
    (await p.$eval('.set.cur [data-f=load]', (e) => e.value)) === '70' ? ok('prima seduta: propone 70 kg dal file') : ko('carico proposto ' + await p.$eval('.set.cur [data-f=load]', (e) => e.value));
    await go('#/giorno/C'); const nT = (await p.$$('.ex-item .thumb svg')).length, nE = (await p.$$('.ex-item')).length;
    nT === nE ? ok('miniature giornata C, anche per l\'esercizio creato') : ko(`miniature ${nT}/${nE}`);
    // reimport dello stesso file: non duplica l'esercizio creato
    await go('#/schede'); await p.setInputFiles('#schImp', ESEMPIO); await p.waitForTimeout(400);
    Object.keys((await st()).customEx).length === 1 ? ok('reimport: esercizio creato non duplicato') : ko('esercizi creati duplicati');
    console.log('  errori JS:', errs.length ? errs : 'nessuno'); if (errs.length) bad++;
    await p.close();
  }
  console.log('\nPROBLEMI:', bad); await b.close();
})();
