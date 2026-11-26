// Allenamento aperto (banner al cambio giornata) e allenamento libero fuori scheda.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os');
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
    const overflow = async (where) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 1) ko(`${where}: scroll orizzontale ${o}px`); };
    const hash = () => p.evaluate(() => location.hash);
    await go(''); await p.evaluate((s) => localStorage.setItem('palestra.v1', JSON.stringify(s)), stato()); await p.reload(); await p.waitForTimeout(300);
    const n0 = (await st()).sessions.length;

    // ---- banner: giornata A iniziata senza serie, poi tocco B
    await go('#/giorno/A'); await p.click('#start'); await p.waitForTimeout(200);
    await go('#/giorno/A'); (await hash()) === '#/sessione' ? ok('stessa giornata: si riapre e continua') : ko('stessa giornata: ' + await hash());
    await go('#/giorno/B');
    const ban = await p.$eval('.switch-banner', (e) => e.innerText).catch(() => '');
    /giorno A/.test(ban) && /scartato/.test(ban) ? ok('banner su altra giornata (A senza serie: verrà scartata)') : ko('banner: ' + ban);
    await overflow('banner');
    await p.click('#swGo'); await p.waitForTimeout(250);
    let s = await st(); const curB = s.sessions.find((x) => x.id === s.current);
    (curB && curB.giorno === 'B' && s.sessions.length === n0 + 1) ? ok('A scartata, B iniziata') : ko(`dopo il cambio: ${s.sessions.length - n0} sessioni nuove, corrente ${curB && curB.giorno}`);
    // B con una serie fatta, poi tocco C → B salvata
    const v = await p.$eval('.set.cur [data-f=load]', (e) => e.value); if (!v) await p.fill('.set.cur [data-f=load]', '10');
    await p.click('#doneSet'); await p.waitForTimeout(120);
    await go('#/giorno/C');
    /salvate/.test(await p.$eval('.switch-banner', (e) => e.innerText).catch(() => '')) ? ok('banner: B ha serie fatte, verrà salvata') : ko('banner B');
    await p.click('[href="#/sessione"]'); await p.waitForTimeout(200); (await hash()) === '#/sessione' ? ok('«Torna all\'allenamento»') : ko('torna all\'allenamento');
    await go('#/giorno/C'); await p.click('#swGo'); await p.waitForTimeout(250);
    s = await st();
    (s.sessions.find((x) => x.giorno === 'B' && x.chiusa) && s.sessions.find((x) => x.id === s.current).giorno === 'C') ? ok('B salvata e chiusa, C iniziata') : ko('B non salvata');
    // anche il tasto «Inizia» non chiede più conferme di sistema: chiude e parte
    await go('#/'); (await p.$('a.free-card')) ? ok('home: allenamento libero') : ko('manca allenamento libero in home');

    // ---- allenamento libero con C aperta (senza serie)
    await p.click('a.free-card'); await p.waitForTimeout(250);
    (await p.$('.switch-banner')) ? ok('banner anche per l\'allenamento libero') : ko('libero senza banner');
    await p.click('#swGo'); await p.waitForTimeout(250);
    s = await st(); let cur = s.sessions.find((x) => x.id === s.current);
    (cur && cur.libero && !s.sessions.some((x) => x.giorno === 'C')) ? ok('C scartata, libero iniziato') : ko('avvio libero');
    (await p.$('#fq')) ? ok('scelta esercizio') : ko('manca la scelta esercizio');
    await overflow('scelta libero');
    await p.fill('#fq', 'hip thrust'); await p.waitForTimeout(150);
    await p.click('[data-key]'); await p.waitForTimeout(250);
    const name1 = await p.$eval('.ex-head h2', (e) => e.textContent);
    /hip thrust/i.test(name1) ? ok('esercizio aggiunto: ' + name1) : ko('esercizio aggiunto: ' + name1);
    const prevTxt = await p.$eval('.card.prev', (e) => e.innerText);
    /100/.test(prevTxt) || /Nessun dato/.test(prevTxt) ? ok('le volte scorse dal movimento: ' + prevTxt.split('\n').slice(1, 3).join(' | ')) : ko('volte scorse: ' + prevTxt);
    await overflow('sessione libera');
    // reps obbligatorie
    if (!(await p.$eval('.set.cur [data-f=load]', (e) => e.value))) await p.fill('.set.cur [data-f=load]', '100');
    await p.click('#doneSet'); await p.waitForTimeout(120);
    (await p.$$('.set.done')).length === 0 ? ok('senza ripetizioni la serie non si segna') : ko('serie segnata senza ripetizioni');
    for (let i = 0; i < 3; i++) { await p.fill('.set.cur [data-f=reps]', '10'); await p.click('#doneSet'); await p.waitForTimeout(100); }
    (await p.$$('.set.done')).length === 3 ? ok('3 serie fatte') : ko('serie fatte ' + (await p.$$('.set.done')).length);
    await p.click('#setAdd'); await p.waitForTimeout(120);
    await p.fill('.set.cur [data-f=reps]', '8'); await p.click('#doneSet'); await p.waitForTimeout(120);
    (await p.$$('.set.done')).length === 4 ? ok('+ Serie: quarta serie') : ko('+ serie');
    // secondo esercizio
    await p.click('#freeAdd'); await p.waitForTimeout(200);
    await p.fill('#fq', 'curl'); await p.waitForTimeout(150); await p.click('[data-key]'); await p.waitForTimeout(250);
    await p.fill('.set.cur [data-f=load]', '20'); await p.fill('.set.cur [data-f=reps]', '12'); await p.click('#doneSet'); await p.waitForTimeout(120);
    await p.click('#list'); await p.waitForTimeout(150); (await p.$$('[data-i]')).length === 2 ? ok('lista: 2 esercizi') : ko('lista libero');
    await p.click('[data-i="1"]'); await p.waitForTimeout(150);
    await p.click('#finish'); await p.waitForTimeout(200);
    const txt = await p.$eval('#txt', (e) => e.value);
    /Allenamento libero/.test(txt) && /× 10\/10\/10\/8/.test(txt) ? ok('riepilogo: ' + txt.split('\n')[1]) : ko('riepilogo libero: ' + txt);
    await p.click('#close'); await p.waitForTimeout(200);
    s = await st(); const lib = s.sessions.find((x) => x.libero);
    (lib && lib.chiusa && !s.current && lib.lista.length === 2) ? ok('allenamento libero salvato') : ko('libero non salvato');
    // non conta nella scheda
    await go(''); const doneB = await p.$$eval('a.day', (x) => x.map((a) => a.innerText.includes('Fatto')));
    ok('home giornate fatte: ' + doneB.map((x) => (x ? 'x' : '-')).join(''));
    // storico, volume, esercizio
    await go('#/storico/allenamenti'); /Allenamento libero/.test(await p.$eval('#app', (e) => e.innerText)) ? ok('storico: allenamento libero elencato') : ko('storico allenamenti');

    await go('#/storico/volume'); /Allenamenti liberi/i.test(await p.$eval('#app', (e) => e.innerText)) ? ok('volume: tonnellaggio liberi a parte') : ko('volume senza liberi');
    await overflow('volume');
    await go('#/esercizio/' + lib.lista[0].illustrazione); /Negli allenamenti liberi/i.test(await p.$eval('#app', (e) => e.innerText)) ? ok('pagina esercizio: carichi dei liberi') : ko('pagina esercizio senza liberi');
    // export
    await go('#/storico/impostazioni');
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.click('#expShare')]);
    if (d) {
      const f = os.tmpdir() + '/lib-exp.json'; await d.saveAs(f); const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      const wk = j.settimane.find((x) => x.liberi && x.liberi.length);
      const l0 = wk && wk.liberi[0], e0 = l0 && l0.esercizi[0];
      (e0 && e0.id_movimento && e0.muscolo_primario && e0.serie.length === 4 && e0.carico_max === 100 && e0.tonnellaggio === 3800 && l0.tonnellaggio_totale === 3800 + 240) ? ok('export: liberi con serie, carico max, tonnellaggio, muscolo') : ko('export liberi: ' + JSON.stringify(l0));
      (wk && !wk.diario.allenamento.some((r) => r.giorno === 'L')) ? ok('export: liberi fuori dalle celle del diario') : ko('liberi nelle celle del diario');
      /Allenamento libero/.test(wk.testo || j.testo) ? ok('export: testo con l\'allenamento libero') : ko('testo export');
    } else ko('export non scaricato');
    // libero vuoto: annulla
    await go('#/libero'); await p.waitForTimeout(150); await p.click('#fCancel'); await p.waitForTimeout(200);
    s = await st(); (!s.current && s.sessions.filter((x) => x.libero).length === 1) ? ok('libero annullato senza esercizi: scartato') : ko('libero vuoto rimasto');
    console.log('  errori JS:', errs.length ? errs : 'nessuno'); if (errs.length) bad++;
    await p.close();
  }
  console.log('\nPROBLEMI:', bad); await b.close();
})();
