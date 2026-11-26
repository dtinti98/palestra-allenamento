// Attrezzatura per giornata: scelta nell'editor, salvata nella scheda, mostrata in home («Porta con te»).
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
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept('Polsiere'));
    const go = async (h) => { await p.goto(U + h); await p.waitForTimeout(250); };
    const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('palestra.v1')));
    const overflow = async (where) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 1) ko(`${where}: scorre in orizzontale di ${o}px`); };
    await go(''); await p.evaluate((s) => localStorage.setItem('palestra.v1', JSON.stringify(s)), stato()); await p.reload(); await p.waitForTimeout(300);
    (await p.$('.next-box .gear')) ? ko('chip attrezzatura senza attrezzatura scelta') : ok('home: niente chip se non c\'è attrezzatura');

    // editor: scelgo l'attrezzatura per la giornata A (indice 0)
    await go('#/scheda/2'); await overflow('editor scheda');
    await p.click('[data-gear="0:cintura_zavorra"]'); await p.click('[data-gear="0:fasce"]'); await p.click('[data-gear="0:cintura"]');
    await p.click('[data-gear="0:fasce"]'); await p.click('[data-gear="0:fasce"]'); // spegni e riaccendi
    await p.click('[data-gearnew="0"]'); await p.waitForTimeout(150);
    const on = await p.$$eval('[data-gear^="0:"].on', (x) => x.map((e) => e.textContent.trim()));
    on.length === 4 && on.some((t) => /Polsiere/.test(t)) ? ok('editor: 4 voci accese, anche quella aggiunta (' + on.join(', ') + ')') : ko('editor: ' + on.join(', '));
    await p.click('#sSave'); await p.waitForTimeout(300);
    const sch = (await st()).diario.schede.find((x) => x.id === 2);
    JSON.stringify(sch.attrezzatura) === JSON.stringify({ A: ['cintura_zavorra', 'cintura', 'fasce', 'Polsiere'] }) ? ok('salvata nella scheda: ' + JSON.stringify(sch.attrezzatura)) : ko('salvata: ' + JSON.stringify(sch.attrezzatura));

    // home: prossima seduta A con i chip
    await go('');
    const chips = await p.$$eval('.next-box .gear span', (x) => x.map((e) => e.textContent));
    chips.join('|') === 'Cintura zavorra|Cintura|Fasce|Polsiere' ? ok('home: «Porta con te» ' + chips.join(', ')) : ko('home chip: ' + chips.join(', '));
    const lbl = await p.$eval('.next-box .gearlbl', (e) => e.textContent).catch(() => '');
    /Porta con te/i.test(lbl) ? ok('etichetta «Porta con te»') : ko('etichetta: ' + lbl);
    await overflow('home con chip');

    // riapro l'editor: resta selezionata, e la tolgo
    await go('#/scheda/2');
    const on2 = await p.$$eval('[data-gear^="0:"].on', (x) => x.length); on2 === 4 ? ok('riaprendo l\'editor la scelta resta') : ko('riapertura: ' + on2);
    for (const k of ['cintura_zavorra', 'cintura', 'fasce', 'Polsiere']) await p.click(`[data-gear="0:${k}"]`);
    await p.click('#sSave'); await p.waitForTimeout(300);
    const sch2 = (await st()).diario.schede.find((x) => x.id === 2);
    !sch2.attrezzatura || !sch2.attrezzatura.A ? ok('tolta tutta: la giornata non ha attrezzatura') : ko('dopo averla tolta: ' + JSON.stringify(sch2.attrezzatura));
    await go(''); (await p.$('.next-box .gear')) ? ko('chip ancora in home') : ok('home senza chip dopo averla tolta');

    console.log('  errori JS: ' + (errs.length ? errs.join(' | ') : 'nessuno')); bad += errs.length;
    await p.close();
  }
  await b.close();
  console.log('\nPROBLEMI: ' + bad); process.exit(bad ? 1 : 0);
})();
