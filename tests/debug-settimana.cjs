// Giro di debug con il backup vero: import, allenamento B dopo le sedute A e D, storico, export, editor, ripristino.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os');
const { BACKUP } = require('./dati.cjs');
const U = 'http://localhost:8765/';
let bad = 0;
const ok = (m) => console.log('  ✓ ' + m), ko = (m) => { bad++; console.log('  ✗ ' + m); };

(async () => {
  const b = await chromium.launch();
  for (const [w, scheme] of [[375, 'light'], [320, 'dark']]) {
    console.log(`\n===== ${w}px ${scheme}`);
    const p = await b.newPage({ viewport: { width: w, height: 800 }, colorScheme: scheme });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
    const go = async (h) => { await p.goto(U + h); await p.waitForTimeout(250); };
    const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('palestra.v1')));
    const txt = () => p.$eval('#app', (e) => e.innerText);
    const overflow = async (where) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 1) ko(`${where}: scroll orizzontale ${o}px`); };
    const dayDone = () => p.$$eval('a.day', (x) => x.map((a) => (a.classList.contains('done') ? 'x' : '-')).join(''));
    const download = async (sel) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.click(sel)]); if (!d) return null; const f = os.tmpdir() + '/dbg-' + Date.now() + '.json'; await d.saveAs(f); return f; };

    await go(''); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    await p.setInputFiles('#imp', BACKUP); await p.waitForTimeout(400);
    let s = await st();
    s.sessions.length === 2 && !s.current ? ok('import: 2 allenamenti della settimana 4, nessuno aperto') : ko('sessioni importate ' + s.sessions.length + ' current ' + s.current);
    await go('');
    (await dayDone()) === 'x--x' ? ok('home: A e D fatti, B e C da fare') : ko('home: ' + await dayDone());
    await overflow('home');

    // giornata A già fatta: carichi mostrati quelli della settimana 4
    await go('#/giorno/A'); const tA = await txt();
    /72/.test(tA) ? ok('giornata A mostra i carichi della settimana 4') : ko('giornata A: carichi settimana 4 non visibili');

    // allenamento B: carichi proposti dalla settimana 3
    await go('#/giorno/B'); await p.click('#start'); await p.waitForTimeout(250);
    s = await st(); const sch2 = s.diario.schede.find((x) => x.id === 2);
    const exB = sch2.esercizi.find((e) => e.giorno === 'B');
    const last = exB.storico[exB.storico.length - 1];
    const v = await p.$eval('.set.cur [data-f=load]', (e) => e.value);
    if (exB.tipoCarico === 'bw') ok(`B: primo esercizio a corpo libero (${exB.nome})`);
    else +String(v).replace(',', '.') === last.carico ? ok(`B: carico proposto ${v} (settimana ${last.settimana})`) : ko(`B carico proposto ${v}, atteso ${last.carico}`);
    await overflow('sessione B');
    if (!v) await p.fill('.set.cur [data-f=load]', '10');
    await p.click('#doneSet'); await p.waitForTimeout(100);
    (await p.$('#restClock')) ? ok('recupero sul pulsante') : ko('recupero assente');
    await p.click('#doneSet'); await p.waitForTimeout(100);
    (await p.$$('.set.done')).length === 2 ? ok('serie segnata durante il recupero') : ko('serie durante il recupero');
    await p.click('#finish'); await p.waitForTimeout(200); await p.click('#close').catch(() => {}); await p.waitForTimeout(150);
    s = await st(); (!s.current && s.sessions.length === 3) ? ok('seduta B chiusa e salvata') : ko('chiusura B: current ' + s.current);
    await go(''); (await dayDone()) === 'xx-x' ? ok('home: A B D fatti') : ko('home dopo B: ' + await dayDone());

    // storico
    for (const sec of ['riepilogo', 'peso', 'forza', 'volume', 'allenamenti', 'impostazioni']) { await go('#/storico/' + sec); await overflow('storico ' + sec); }
    await go('#/storico/riepilogo'); const tR = await txt();
    /3\s*\/\s*4|3 di 4/.test(tR) ? ok('riepilogo: 3 sedute su 4 questa settimana') : console.log('  · riepilogo (controllo a vista):', tR.slice(0, 160).replace(/\n/g, ' | '));
    await go('#/storico/forza'); await p.click('[data-sch="2"]').catch(() => {}); await p.waitForTimeout(150);
    const opt = await p.$$eval('#essel option', (o) => (o.find((x) => x.textContent.includes('Hip thrust')) || {}).value);
    if (opt) { await p.selectOption('#essel', opt); await p.waitForTimeout(150); /S4|sett\. 4|23\/11/.test(await txt()) ? ok('forza: Hip thrust con la settimana 4') : console.log('  · forza hip thrust (a vista):', (await txt()).slice(-200).replace(/\n/g, ' | ')); }

    // export della settimana 4
    await go('#/storico/impostazioni');
    const wk = await p.$$eval('#expw option', (o) => o.map((x) => [x.value, x.textContent]));
    const f = await download('#expShare');
    if (f) {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      const rows = j.settimane.flatMap((x) => x.diario.allenamento);
      const r = (n) => rows.find((x) => x.esercizio === n);
      const hip = r('Hip thrust macchinario'), spider = r('Curl spider manubri'), ss = r('French press (superset)');
      (hip && hip.cella_carico === 'H58' && hip.carico === 100) ? ok('export: Hip thrust H58 = 100') : ko('export hip ' + JSON.stringify(hip));
      (spider && spider.cella_carico === 'H42' && spider.carico === 28 && spider.cella_reps === 'Z42') ? ok('export: Curl spider H42 = 28, reps Z42') : ko('export spider ' + JSON.stringify(spider));
      (ss && ss.carico === 20) ? ok('export: French press superserie = 20') : ko('export superserie ' + JSON.stringify(ss));
      const sed = j.settimane[0].diario.sedute || j.settimane[0].diario.seduteSvolte;
      console.log('  · settimana esportata:', wk[0] && wk[0][1], '· sedute:', JSON.stringify(sed));
    } else ko('export: download non trovato');

    // editor: salvare la scheda 2 senza modifiche non deve cambiare niente
    s = await st(); const before = s.diario.schede.find((x) => x.id === 2);
    await go('#/scheda/2'); await overflow('editor scheda 2');
    (await p.$eval('#sSet', (e) => e.value)) === '8' ? ok('editor: scheda 2 di 8 settimane') : ko('editor settimane ' + await p.$eval('#sSet', (e) => e.value));
    await p.click('#sSave'); await p.waitForTimeout(250);
    s = await st(); const after = s.diario.schede.find((x) => x.id === 2);
    (after.fine === before.fine && after.settimane.length === before.settimane.length && after.inizio === before.inizio) ? ok('salvare senza modifiche non cambia date e settimane') : ko(`date cambiate: ${before.fine}→${after.fine}, ${before.settimane.length}→${after.settimane.length}`);
    const sig = (x) => JSON.stringify(x.esercizi.map((e) => [e.id, e.nome, e.serie, e.range, e.recupero, e.tipoCarico, e.storico.length, e.gruppo, e.note]));
    sig(after) === sig(before) ? ok('esercizi invariati (anche note e gruppi)') : ko('esercizi cambiati salvando');
    JSON.stringify(s.settings.superserie['2-D']) === JSON.stringify(['s2-r66']) ? ok('superserie D conservata') : ko('superserie D ' + JSON.stringify(s.settings.superserie['2-D']));
    await go(''); (await dayDone()) === 'xx-x' ? ok('home dopo il salvataggio: A B D fatti') : ko('home dopo modifica ' + await dayDone());
    // scheda 1 passata
    s = await st(); const b1 = s.diario.schede.find((x) => x.id === 1);
    await go('#/scheda/1'); await p.click('#sSave'); await p.waitForTimeout(250);
    s = await st(); const a1 = s.diario.schede.find((x) => x.id === 1);
    (a1.fine === b1.fine && sig(a1) === sig(b1)) ? ok('scheda 1: salvataggio senza modifiche invariato') : ko(`scheda 1 cambiata: ${b1.fine}→${a1.fine}`);

    // esercizio creato → backup → ripristino su app vuota
    await go('#/scheda/2'); await p.click('[data-add="2"]'); await p.fill('#pq', 'zzz'); await p.waitForTimeout(80); await p.click('#pNew'); await p.waitForTimeout(80);
    await p.fill('#cNome', 'Croci ai cavi alti'); await p.click('#cPri [data-m]'); await p.click('#cSave'); await p.waitForTimeout(150);
    await p.click('#sSave'); await p.waitForTimeout(250);
    await go('#/storico/impostazioni');
    const bk = await download('#exp');
    if (bk) {
      await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
      await go(''); await p.setInputFiles('#imp', bk); await p.waitForTimeout(400);
      s = await st();
      Object.keys(s.customEx || {}).length === 1 ? ok('ripristino: esercizio creato conservato') : ko('ripristino: esercizio creato perso');
      s.sessions.length === 3 ? ok('ripristino: 3 allenamenti') : ko('ripristino sessioni ' + s.sessions.length);
      await go('#/giorno/C'); const nT = (await p.$$('.ex-item .thumb svg')).length, nE = (await p.$$('.ex-item')).length;
      nT === nE ? ok(`ripristino: miniature giornata C (${nE})`) : ko(`miniature dopo ripristino ${nT}/${nE}`);
      // reimportare il backup del diario dopo una modifica chiede conferma
      let asked = ''; p.removeAllListeners('dialog'); p.on('dialog', (d) => { asked = d.message(); d.dismiss(); });
      await go('#/storico/impostazioni'); await p.setInputFiles('#imp', BACKUP); await p.waitForTimeout(400);
      /modificato/.test(asked) && (await st()).diario.schede[1].esercizi.length === s.diario.schede[1].esercizi.length ? ok('import di un diario sopra schede modificate: chiede conferma') : ko('import sopra schede modificate senza conferma: ' + asked);
      p.removeAllListeners('dialog'); p.on('dialog', (d) => d.accept());
    } else ko('backup: download non trovato');

    // eliminare la scheda con un allenamento aperto
    await go('#/giorno/C'); await p.click('#start'); await p.waitForTimeout(200);
    await go('#/scheda/2'); await p.click('#sDel'); await p.waitForTimeout(250);
    s = await st(); !s.current ? ok('eliminando la scheda si chiude l\'allenamento aperto') : ko('allenamento aperto su scheda eliminata');
    await go(''); await go('#/sessione'); await go('#/storico/allenamenti'); await go('#/storico/forza');
    console.log('  errori JS:', errs.length ? errs : 'nessuno'); if (errs.length) bad++;
    await p.close();
  }
  console.log('\nPROBLEMI:', bad); await b.close();
})();
