// Storico → Peso: importare misurazioni vecchie da JSON (testo incollato o file).
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
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    const dialogs = []; p.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('palestra.v1')));
    await p.goto(U); await p.evaluate((s) => localStorage.setItem('palestra.v1', JSON.stringify(s)), stato()); await p.reload(); await p.waitForTimeout(300);
    await p.goto(U + '#/storico/peso'); await p.waitForTimeout(300);
    await p.click('#misura > summary'); await p.click('#mimp > summary'); await p.waitForTimeout(100);
    const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    o > 1 ? ko('scorre in orizzontale di ' + o + 'px') : ok('pannello importazione senza scorrimento orizzontale');
    const json = { formato: 'palestra-misure', versione: 1, misure: [
      { data: '2025-09-01', peso: 76.4, grasso_pct: 16.2, vita: 84, glutei: 98 },
      { data: '15/10/2025', peso: '77,1', bf: 0.155, bicipite: 36.5 },
      { data: '2025-11-01', peso: 500 },
      { data: 'ieri', vita: 80 },
    ] };
    await p.fill('#mjson', JSON.stringify(json)); await p.click('#mimpgo'); await p.waitForTimeout(250);
    /Importare 2 misurazioni dal 01\/09\/2025 al 15\/10\/2025/.test(dialogs[0] || '') && /Scartate 2/.test(dialogs[0]) ? ok('conferma con 2 importabili e 2 scartate') : ko('conferma: ' + dialogs[0]);
    const S = await st();
    const a = S.misure.find((m) => m.data === '2025-09-01'), c = S.misure.find((m) => m.data === '2025-10-15');
    a && a.peso === 76.4 && a.fianchi === 98 && a.vita === 84 ? ok('1/9/2025: peso, vita, glutei → fianchi') : ko('misura 1 ' + JSON.stringify(a));
    c && c.peso === 77.1 && c.grasso_pct === 15.5 && c.braccio === 36.5 ? ok('15/10/2025: data italiana, virgola, BF 0,155 → 15,5%, bicipite') : ko('misura 2 ' + JSON.stringify(c));
    S.pesate.some((x) => x.data === '2025-09-01' && x.peso === 76.4) ? ok('il peso entra anche nelle pesate') : ko('pesata mancante');
    // stessa data: aggiorna senza perdere i campi già salvati
    await p.click('#misura > summary').catch(() => {}); if (!(await p.$('#mimp[open]'))) await p.click('#mimp > summary');
    await p.fill('#mjson', JSON.stringify([{ data: '2025-09-01', torace: 101 }])); await p.click('#mimpgo'); await p.waitForTimeout(250);
    const a2 = (await st()).misure.find((m) => m.data === '2025-09-01');
    a2 && a2.torace === 101 && a2.vita === 84 && /verrà aggiornata/.test(dialogs[1] || '') ? ok('stessa data: aggiunge il torace e tiene la vita') : ko('aggiorna ' + JSON.stringify(a2) + ' / ' + dialogs[1]);
    // testo non valido
    if (!(await p.$('#mimp[open]'))) { await p.click('#misura > summary').catch(() => {}); await p.click('#mimp > summary'); }
    await p.fill('#mjson', '{misure: ['); await p.click('#mimpgo'); await p.waitForTimeout(200);
    /non è JSON valido/.test(await p.textContent('#toast').catch(() => '')) || /non è JSON valido/.test(await p.evaluate(() => document.body.innerText)) ? ok('JSON rotto: avviso') : ko('nessun avviso per JSON rotto');
    console.log('  errori JS: ' + (errs.length ? errs.join(' | ') : 'nessuno')); bad += errs.length;
    await p.close();
  }
  await b.close();
  console.log('\nPROBLEMI: ' + bad); process.exit(bad ? 1 : 0);
})();
