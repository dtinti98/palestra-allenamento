// Home: frecce per cambiare settimana, settimana completata, «Completa» nelle settimane passate.
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
    const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('palestra.v1')));
    const txt = (sel) => p.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ').trim());
    const overflow = async (where) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 1) ko(`${where}: scorre in orizzontale di ${o}px`); };
    await p.goto(U); await p.evaluate((s) => localStorage.setItem('palestra.v1', JSON.stringify(s)), stato()); await p.reload(); await p.waitForTimeout(300);

    const cur = +(await txt('.wk-nav b')).replace(/\D/g, '');
    cur >= 2 ? ok(`settimana corrente ${cur}, frecce presenti`) : ko('settimana ' + cur);
    /\d+ di \d+ sedute/.test(await txt('.wk-nav small')) ? ok('date e sedute: ' + await txt('.wk-nav small')) : ko('riga settimana: ' + await txt('.wk-nav small'));
    await overflow('home');

    // indietro: settimana passata
    await p.click('#wPrev'); await p.waitForTimeout(150);
    (await txt('.wk-nav b')) === `Settimana ${cur - 1}` && (await p.$('.past-band')) ? ok(`‹ porta alla settimana ${cur - 1} con la fascia «settimana passata»`) : ko('indietro');
    new RegExp(`settimana ${cur - 1} di`, 'i').test(await txt('.mast .kick')) ? ok('il titolo mostra la settimana guardata') : ko('kicker ' + await txt('.mast .kick'));
    (await p.$('.next-box')) ? ko('prossima seduta mostrata nella settimana passata') : ok('niente «prossima seduta» nella settimana passata');
    // segna come mancante una giornata della settimana passata togliendola dal diario
    await p.evaluate((wk) => { const s = JSON.parse(localStorage.getItem('palestra.v1')); const sc = s.diario.schede[s.diario.schede.length - 1]; sc.seduteSvolte[wk - 1] = (sc.seduteSvolte[wk - 1] || []).filter((g) => g !== 'D'); s.sessions = s.sessions.filter((x) => !(x.settimana === wk && x.giorno === 'D')); localStorage.setItem('palestra.v1', JSON.stringify(s)); }, cur - 1);
    await p.reload(); await p.waitForTimeout(250);
    (await p.$('.past-band')) ? ko('dopo il ricaricamento resta sulla settimana passata') : ok('ricaricando torna alla settimana corrente');
    await p.click('#wPrev'); await p.waitForTimeout(150);
    const comp = await p.$('a.day.miss[href*="giorno/D"] .comp');
    comp ? ok('giornata D mancante: «Completa»') : ko('nessun «Completa» su D');
    await overflow('settimana passata');
    await p.click('a.day.miss[href*="giorno/D"]'); await p.waitForTimeout(250);
    (await p.$eval('#week', (e) => e.value)) === String(cur - 1) ? ok(`la giornata si apre nella settimana ${cur - 1}`) : ko('settimana nella giornata ' + await p.$eval('#week', (e) => e.value));
    await p.click('#start'); await p.waitForTimeout(250);
    const S1 = await st(); const ses = S1.sessions.find((x) => x.id === S1.current);
    ses && ses.settimana === cur - 1 && ses.giorno === 'D' ? ok(`seduta registrata nella settimana ${cur - 1}`) : ko('seduta ' + JSON.stringify(ses && [ses.settimana, ses.giorno]));
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('palestra.v1')); s.sessions = s.sessions.filter((x) => x.id !== s.current); s.current = null; localStorage.setItem('palestra.v1', JSON.stringify(s)); });
    await p.goto(U + '#/'); await p.reload(); await p.waitForTimeout(250);

    // torna alla corrente con la fascia
    await p.click('#wPrev'); await p.waitForTimeout(100); await p.click('#wBack'); await p.waitForTimeout(100);
    (await txt('.wk-nav b')) === `Settimana ${cur}` && !(await p.$('.past-band')) ? ok('«Torna alla» riporta alla settimana corrente') : ko('torna');

    // settimana completa: riquadro scuro e «Passa alla settimana N+1»
    await p.evaluate((wk) => { const s = JSON.parse(localStorage.getItem('palestra.v1')); const sc = s.diario.schede[s.diario.schede.length - 1]; sc.seduteSvolte[wk - 1] = [...sc.giorni]; localStorage.setItem('palestra.v1', JSON.stringify(s)); }, cur);
    await p.reload(); await p.waitForTimeout(250);
    (await p.$('.wk-done #wAdv')) && (await txt('#wAdv')) === `Passa alla settimana ${cur + 1} →` ? ok('settimana completata: «Passa alla settimana ' + (cur + 1) + '»') : ko('riquadro settimana completata');
    await overflow('settimana completata');
    await p.click('#wAdv'); await p.waitForTimeout(150);
    (await txt('.wk-nav b')) === `Settimana ${cur + 1}` && (await p.$('.next-box')) ? ok(`passato alla settimana ${cur + 1}`) : ko('passaggio');
    (await st()).settings.weekAdv.week === cur + 1 ? ok('scelta salvata') : ko('weekAdv non salvato');
    await p.reload(); await p.waitForTimeout(200);
    (await txt('.wk-nav b')) === `Settimana ${cur + 1}` ? ok('resta dopo il ricaricamento') : ko('non resta');
    // ‹ dopo essere passati: si può rimanere sulla settimana di prima
    await p.click('#wPrev'); await p.waitForTimeout(150);
    (await p.$('#wUndo')) ? ok('dopo il passaggio, ‹ offre «Rimani sulla ' + cur + '»') : ko('manca il ritorno');
    await p.click('#wUndo'); await p.waitForTimeout(150);
    (await txt('.wk-nav b')) === `Settimana ${cur}` && (await p.$('#wAdv')) && !(await st()).settings.weekAdv ? ok('rimasto sulla ' + cur + ', pulsante «Passa» di nuovo visibile') : ko('rimani: ' + await txt('.wk-nav b'));
    // › guarda soltanto: tornando indietro il pulsante c'è ancora
    await p.click('#wNext'); await p.waitForTimeout(150);
    (await txt('.wk-nav b')) === `Settimana ${cur + 1}` && /futura/.test(await txt('.past-band')) && !(await st()).settings.weekAdv ? ok('› mostra la settimana ' + (cur + 1) + ' senza passarci') : ko('› futura');
    await p.click('#wPrev'); await p.waitForTimeout(150);
    (await p.$('.wk-done #wAdv')) ? ok('tornando indietro «Passa alla settimana» c\'è ancora') : ko('pulsante sparito');
    await p.click('#wAdv'); await p.waitForTimeout(150);
    // › prima della fine: guarda la futura e passa col pulsante (chiede conferma, accettata)
    await p.click('#wNext'); await p.waitForTimeout(150); await p.click('#wAdv'); await p.waitForTimeout(150);
    (await txt('.wk-nav b')) === `Settimana ${cur + 2}` ? ok('dalla settimana futura si passa con il pulsante') : ko('passa futura ' + await txt('.wk-nav b'));
    await p.click('.day >> nth=0'); await p.waitForTimeout(200);
    (await p.$eval('#week', (e) => e.value)) === String(cur + 2) ? ok('la giornata parte nella settimana nuova') : ko('settimana giornata ' + await p.$eval('#week', (e) => e.value));
    console.log('  errori JS: ' + (errs.length ? errs.join(' | ') : 'nessuno')); bad += errs.length;
    await p.close();
  }
  await b.close();
  console.log('\nPROBLEMI: ' + bad); process.exit(bad ? 1 : 0);
})();
