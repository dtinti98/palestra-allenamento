// Creazione e modifica delle schede dal telefono.
const { chromium } = require('playwright');
const { stato } = require('./dati.cjs');
const U = 'http://localhost:8765/';
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
    const overflow = async (where) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 1) ko(`${where}: scorre in orizzontale di ${o}px`); };

    // ---- app vuota: nuova scheda
    await go(''); await p.evaluate(() => localStorage.clear()); await go(''); await p.reload(); await p.waitForTimeout(300);
    await p.click('a[href="#/scheda/nuova"]'); await p.waitForTimeout(200);
    await overflow('editor vuoto');
    await p.fill('#sTit', 'Forza base'); await p.fill('[data-dname="0"]', 'Spinta');
    await p.click('#sSave'); (await p.$eval('#toast', (e) => e.textContent)).includes('almeno un esercizio') ? ok('scheda senza esercizi bloccata') : ko('scheda vuota salvata');
    await p.click('[data-add="0"]'); await p.fill('#pq', 'panca'); await p.waitForTimeout(100);
    const found = await p.$$eval('.pick-item', (x) => x.length); found > 3 ? ok(`ricerca nella lista: ${found} esercizi con «panca»`) : ko('ricerca lista: ' + found);
    await p.click('.pick-item'); await p.waitForTimeout(150);
    await p.click('[data-add="0"]'); await p.fill('#pq', 'zzz'); await p.waitForTimeout(80);
    await p.click('#pNew'); await p.waitForTimeout(100);
    await p.fill('#cNome', 'Pressa 45 gradi'); await p.click('#cSave');
    (await p.$eval('#toast', (e) => e.textContent)).includes('muscolo principale') ? ok('nuovo esercizio senza muscoli bloccato') : ko('nuovo esercizio senza muscoli accettato');
    await p.click('#cPri [data-m="quadricipiti"]'); await p.click('#cSec [data-m="glutei"]'); await p.click('#cSave'); await p.waitForTimeout(150);
    (await p.$$('.ed-ex')).length === 2 ? ok('esercizio dalla lista + esercizio creato al momento') : ko('esercizi nella giornata: ' + (await p.$$('.ed-ex')).length);
    await p.fill('.ed-ex[data-x="0"] [data-f="reps"]', '6-8'); await p.selectOption('.ed-ex[data-x="0"] [data-f="recupero"]', '2′');
    await p.fill('.ed-ex[data-x="0"] [data-f="serie"]', '4');
    await p.click('[data-ss="0:0"]'); await p.waitForTimeout(100);
    (await p.$('.ss-link.on')) ? ok('superserie nell\'editor') : ko('superserie editor');
    await p.click('#addDay'); await p.waitForTimeout(100);
    await p.click('[data-add="1"]'); await p.fill('#pq', 'trazioni'); await p.waitForTimeout(80); await p.click('.pick-item'); await p.waitForTimeout(100);
    await p.click('.ed-ex[data-g="0"][data-x="1"] [data-a="up"]'); await p.waitForTimeout(80);
    (await p.$eval('.ed-ex[data-g="0"][data-x="0"] .ed-nome', (e) => e.value)) === 'Pressa 45 gradi' ? ok('riordino esercizi') : ko('riordino');
    await p.click('.ed-ex[data-g="0"][data-x="0"] [data-a="down"]'); await p.waitForTimeout(80);
    await overflow('editor pieno');
    await p.click('#sSave'); await p.waitForTimeout(250);
    const s1 = await st();
    const sch = s1.diario && s1.diario.schede[0];
    (sch && sch.esercizi.length === 3 && sch.giorni.join('') === 'AB' && sch.esercizi[0].serie === 4 && sch.esercizi[0].range.join('-') === '6-8' && sch.esercizi[0].recupero === '2′') ? ok('scheda salvata: 2 giornate, 3 esercizi, serie/rip./recupero') : ko('scheda salvata: ' + JSON.stringify(sch && sch.esercizi.map((e) => [e.nome, e.serie, e.range, e.recupero])));
    (s1.settings.superserie && s1.settings.superserie[`${sch.id}-A`].length === 1) ? ok('superserie salvata') : ko('superserie non salvata');
    await go('');
    (await p.$$('a.day')).length === 2 ? ok('home con la nuova scheda: 2 giornate') : ko('home giornate: ' + (await p.$$('a.day')).length);
    await go('#/giorno/A'); (await p.$$('.ex-item .thumb svg')).length === 2 ? ok('miniature anche per l\'esercizio creato') : ko('miniature');
    await p.click('#start'); await p.waitForTimeout(200);
    (await p.$('.ss-banner:not(.off)')) ? ok('allenamento con superserie dalla scheda creata') : ko('superserie non attiva in sessione');
    await p.fill('.set.cur [data-f=load]', '20'); await p.click('#doneSet'); await p.waitForTimeout(150);
    const nm = await p.$eval('.ex-head h2', (e) => e.textContent); nm === 'Pressa 45 gradi' ? ok('alterna sull\'esercizio creato') : ko('alternanza: ' + nm);
    await overflow('sessione esercizio creato');
    await go('#/esercizi'); (await p.$$('.tile')).length === 79 ? ok('libreria: 78 + 1 creato') : ko('libreria ' + (await p.$$('.tile')).length);

    // ---- modifica di una scheda passata con storico
    await p.evaluate((s) => localStorage.setItem('palestra.v1', JSON.stringify(s)), stato()); await p.reload(); await p.waitForTimeout(300);
    await go('#/schede'); (await p.$$('.sch-item')).length === 2 ? ok('elenco schede: 2') : ko('elenco schede ' + (await p.$$('.sch-item')).length);
    await overflow('elenco schede');
    await go('#/scheda/1'); await p.waitForTimeout(200);
    const n1 = await p.$$eval('.ed-ex', (x) => x.length);
    await p.fill('.ed-ex[data-g="0"][data-x="0"] [data-f="serie"]', '5');
    await p.click('#sSave'); await p.waitForTimeout(250);
    const s2 = await st(); const sc1 = s2.diario.schede.find((x) => x.id === 1);
    (sc1.esercizi.length === n1 && sc1.esercizi[0].serie === 5 && sc1.esercizi[0].storico.length > 0 && s2.diario.schede.length === 2) ? ok(`scheda 1 modificata, storico carichi conservato (${sc1.esercizi[0].storico.length} settimane)`) : ko('modifica scheda passata');
    await go('#/storico/forza'); await p.click('[data-sch="1"]'); (await p.$$('.chart-svg')).length ? ok('storico ancora calcolato dopo la modifica') : ko('storico rotto dopo modifica');
    await go('#/scheda/2'); await p.click('#sDel'); await p.waitForTimeout(200);
    (await st()).diario.schede.length === 1 ? ok('scheda eliminata') : ko('eliminazione scheda');
    await go(''); (await p.$$('a.day')).length > 0 ? ok('home dopo l\'eliminazione') : ko('home vuota dopo eliminazione');
    console.log('  errori JS:', errs.length ? errs : 'nessuno'); if (errs.length) bad++;
    await p.close();
  }
  console.log('\nPROBLEMI:', bad);
  await b.close();
})();
