const { chromium } = require('playwright');
const fs = require('fs'), os = require('os');
const { DIARIO } = require('./dati.cjs');
const U = 'http://localhost:8765/';
const out = os.tmpdir() + '/palestra-screens/';
fs.mkdirSync(out, { recursive: true });
let bad = 0;
const ok = (m) => console.log('  ✓ ' + m), ko = (m) => { bad++; console.log('  ✗ ' + m); };
const st = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('palestra.v1')));
const setSt = (p, s) => p.evaluate((s) => localStorage.setItem('palestra.v1', JSON.stringify(s)), s);
const base = (x = {}) => ({ sessions: [], pesate: [], misure: [], exported: [], current: null, settings: {}, diario: DIARIO, ...x });

(async () => {
  const b = await chromium.launch();
  // ---------- casi limite
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
    await p.clock.setFixedTime(new Date('2026-11-24T10:00:00'));
    await p.goto(U); await setSt(p, base({ misure: [{ data: '2026-11-20', vita: 76, massa_muscolare: 30 }] }));
    // solo misure: export disponibile
    await p.goto(U + '#/storico/allenamenti'); await p.reload(); await p.waitForTimeout(300);
    (await p.$('#expShare')) ? ok('export disponibile con sole misure') : ko('export assente con sole misure');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#expShare')]); const f = os.tmpdir() + '/m.json'; await dl.saveAs(f);
    const ex = JSON.parse(fs.readFileSync(f, 'utf8'));
    (ex.misure.length === 1 && ex.settimane[0].diario.misure[0].colonne.vita === 'H' && ex.settimane[0].diario.allenamento.length === 0) ? ok('export solo misure corretto') : ko('export solo misure: ' + JSON.stringify(ex.settimane[0].diario));
    // import su app vuota (backup completo)
    await p.click('[data-per="settimana"]').catch(() => {});
    const [db] = await Promise.all([p.waitForEvent('download'), p.click('#exp')]); const fb = os.tmpdir() + '/b.json'; await db.saveAs(fb);
    await setSt(p, base()); await p.reload(); await p.waitForTimeout(300);
    await p.setInputFiles('#imp', fb); await p.waitForTimeout(300);
    const s1 = await st(p);
    s1.misure.length === 1 && s1.misure[0].massa_muscolare === 30 ? ok('import backup su app vuota ripristina le misure') : ko('import misure: ' + JSON.stringify(s1.misure));
    await p.setInputFiles('#imp', fb); await p.waitForTimeout(300);
    (await st(p)).misure.length === 1 ? ok('import ripetuto non duplica') : ko('import duplica');
    // file non valido
    fs.writeFileSync(os.tmpdir() + '/x.json', '{"ciao":1}');
    await p.setInputFiles('#imp', os.tmpdir() + '/x.json'); await p.waitForTimeout(200);
    (await p.$eval('#toast', (e) => e.textContent)).includes('non valido') ? ok('file estraneo rifiutato') : ko('file estraneo accettato');
    // misura con stessa data del diario: campi uniti
    await setSt(p, base({ misure: [{ data: '2026-10-10', vita: 74 }] })); await p.goto(U + '#/storico/peso'); await p.reload(); await p.waitForTimeout(300);
    const merged = await p.evaluate(async (D) => { const { makeStats } = await import('./js/stats.js'); return makeStats(D, JSON.parse(localStorage.getItem('palestra.v1')), '2026-11-24').misure.find((m) => m.data === '2026-10-10'); }, DIARIO);
    (merged.vita === 74 && merged.peso === 63.6 && merged.braccio === 33 && merged.massa_magra > 50) ? ok('misura sulla stessa data del diario: campi uniti') : ko('unione misure: ' + JSON.stringify(merged));
    // valori fuori scala
    await p.click('#misura summary'); await p.fill('[data-m="vita"]', '7'); await p.click('#msave');
    (await p.$eval('#toast', (e) => e.textContent)).includes('Vita non valido') ? ok('vita fuori scala bloccata') : ko('vita 7 cm accettata');
    // pesata aggiorna il peso della misurazione
    await setSt(p, base({ misure: [{ data: '2026-11-24', peso: 64, vita: 75 }], pesate: [{ data: '2026-11-24', peso: 64 }] })); await p.reload(); await p.waitForTimeout(300);
    await p.fill('#wkg', '64,6'); await p.click('#wsave'); await p.waitForTimeout(200);
    (await st(p)).misure[0].peso === 64.6 ? ok('pesata allinea il peso della misurazione') : ko('pesata e misura disallineate');
    // altezza non valida
    await p.goto(U + '#/storico/allenamenti'); await p.waitForTimeout(200);
    await p.fill('#altezza', '17'); await p.$eval('#altezza', (e) => e.dispatchEvent(new Event('change'))); await p.waitForTimeout(100);
    (await st(p)).settings.altezza == null ? ok('altezza non valida scartata') : ko('altezza 17 accettata');
    // promemoria in home: lunedì 30/11 con dati della settimana del 23/11
    await setSt(p, base({ misure: [{ data: '2026-11-24', vita: 75 }] }));
    await p.clock.setFixedTime(new Date('2026-11-30T09:00:00')); await p.goto(U + '#/'); await p.reload(); await p.waitForTimeout(300);
    (await p.$('text=Fine settimana: esporta i dati')) ? ok('promemoria export il lunedì') : ko('promemoria assente il lunedì');
    await p.clock.setFixedTime(new Date('2026-11-25T09:00:00')); await p.reload(); await p.waitForTimeout(300);
    !(await p.$('text=Fine settimana: esporta i dati')) ? ok('niente promemoria a metà settimana') : ko('promemoria a metà settimana');
    console.log('  errori JS:', errs.length ? errs : 'nessuno'); if (errs.length) bad++;
    await ctx.close();
  }
  // ---------- controllo visivo 320 px scuro
  {
    const ctx = await b.newContext({ viewport: { width: 320, height: 640 }, colorScheme: 'dark', deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.clock.setFixedTime(new Date('2026-11-24T10:00:00'));
    await p.goto(U); await setSt(p, base({ settings: { altezza: 175, nascita: '1990-01-01' }, misure: [{ data: '2026-11-20', peso: 64.2, grasso_pct: 14.5, vita: 75, fianchi: 92, braccio: 34, massa_muscolare: 30.5 }], pesate: [{ data: '2026-11-24', peso: 64.4 }] }));
    for (const r of ['', 'storico/riepilogo', 'storico/peso', 'storico/forza', 'storico/volume', 'storico/allenamenti', 'esercizi']) {
      await p.goto(U + '#/' + r); await p.reload(); await p.waitForTimeout(350);
      if (r === 'storico/peso') await p.click('#misura summary');
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      over > 0 ? ko(`${r || 'home'}: scorre in orizzontale di ${over}px`) : ok(`${r || 'home'}: niente scroll orizzontale a 320px`);
      await p.screenshot({ path: out + (r.replace('/', '-') || 'home') + '.png', fullPage: true });
    }
    console.log('  errori JS:', errs.length ? errs : 'nessuno'); if (errs.length) bad++;
    await ctx.close();
  }
  console.log('PROBLEMI:', bad);
  await b.close();
})();
