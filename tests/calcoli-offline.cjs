const { chromium } = require('playwright');
const { DIARIO, stato } = require('./dati.cjs');
const URL = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto(URL); await p.evaluate((s) => localStorage.setItem('palestra.v1', JSON.stringify(s)), stato()); await p.reload();
  // allenamento completo dei 4 giorni con reps diverse
  for (const g of ['A', 'B', 'C', 'D']) {
    await p.goto(URL + '#/giorno/' + g); await p.waitForTimeout(200); await p.click('#start'); await p.waitForTimeout(150);
    for (let k = 0; k < 15; k++) {
      while (await p.$('#doneSet')) {
        await p.fill('.set.cur [data-f=reps]', '9');
        await p.click('#doneSet'); await p.waitForTimeout(40);
        if (await p.$('#timer:not([hidden]) [data-t=x]')) await p.click('#timer [data-t=x]');
      }
      const t = await p.$eval('#next', (e) => e.textContent).catch(() => null);
      if (!t) break;
      await p.click('#next'); await p.waitForTimeout(100);
      if (/Fine/.test(t)) break;
    }
    await p.click('#close'); await p.waitForTimeout(150);
  }
  const res = await p.evaluate(async (D) => {
    const { makeStats } = await import('./js/stats.js');
    const S = JSON.parse(localStorage.getItem('palestra.v1'));
    const st = makeStats(D, S, '2026-11-24');
    return {
      sett12: st.sett.find((s) => s.globale === 12), forza: st.forza, tonn: st.tonnKpi,
      mass12: st.massimali.filter((m) => m.globale === 12),
      trazioni: st.carichi.filter((c) => c.esercizio === 'Trazioni prone zavorrate').map((c) => [c.settimana, c.carico, c.reps, c.fonte]),
      gruppi: st.gruppiSintesi(2).rows.map((r) => [r.gruppo, r.prima, r.ultima]),
      sessions: S.sessions.length,
    };
  }, DIARIO);
  console.log(JSON.stringify(res, null, 1));
  // pagina esercizio mostra la settimana 4 dell'app
  await p.goto(URL + '#/esercizio/ez_curl'); await p.waitForTimeout(200);
  console.log('ez_curl righe:', await p.$$eval('table tr', (r) => r.slice(0, 3).map((x) => x.textContent.replace(/\s+/g, ' '))));
  // offline
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.reload(); await p.waitForTimeout(800);
  const sw = await p.evaluate(() => navigator.serviceWorker.controller ? 'attivo' : 'non attivo');
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(800);
  const days = await p.$$eval('a.day', (x) => x.length);
  await p.goto(URL + '#/storico/forza'); await p.waitForTimeout(300);
  const svg = await p.$$eval('.chart-svg', (x) => x.length);
  console.log('service worker:', sw, '| offline home giornate:', days, '| offline grafici forza:', svg);
  console.log('errori:', errs);
  await b.close();
})();
