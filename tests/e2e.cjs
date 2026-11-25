const { chromium } = require('playwright');
const { BACKUP, stato } = require('./dati.cjs');
const URL = 'http://localhost:8765/';
const issues = [];
const bad = (m) => { issues.push(m); console.log('  ✗', m); };
const ok = (m) => console.log('  ✓', m);
(async () => {
  const b = await chromium.launch();
  for (const [w, cs] of [[390, 'dark'], [320, 'light']]) {
    console.log(`\n===== ${w}px ${cs}`);
    const ctx = await b.newContext({ viewport: { width: w, height: 760 }, colorScheme: cs, serviceWorkers: 'block' });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: URL });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => bad('JS error: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') bad('console: ' + m.text()); });
    p.on('dialog', (d) => d.accept());
    const overflow = async (where) => {
      const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (o > 1) bad(`${where}: la pagina scorre in orizzontale di ${o}px`);
    };
    const go = async (h) => { await p.goto(URL + h); await p.waitForTimeout(250); };
    await go('');
    await p.evaluate(() => localStorage.clear()); await go('');
    // app vuota: benvenuto, esercizi e pesate funzionano senza scheda
    (await p.$('#imp')) && !(await p.$('a.day')) ? ok('app vuota: schermata di benvenuto') : bad('app vuota: niente benvenuto');
    await overflow('benvenuto');
    await go('#/esercizi'); (await p.$$('.tile')).length === 67 ? ok('app vuota: 67 esercizi in libreria') : bad('app vuota: libreria ' + (await p.$$('.tile')).length);
    await go('#/giorno/A'); p.url().endsWith('#/') ? ok('app vuota: giornata → home') : bad('app vuota: giornata ' + p.url());
    await go('#/storico/forza'); (await p.$$('.segs a')).length === 2 ? ok('app vuota: storico solo peso e allenamenti') : bad('app vuota: storico ' + (await p.$$('.segs a')).length);
    await go('#/storico/peso'); await p.fill('#wkg', '64'); await p.click('#wsave'); await p.waitForTimeout(150);
    (await p.$$('[data-delw]')).length === 1 ? ok('app vuota: pesata salvata') : bad('app vuota: pesata');
    await go('#/storico/allenamenti'); await overflow('storico vuoto');
    await p.evaluate(() => localStorage.clear()); await go('');
    await p.setInputFiles('#imp', BACKUP); await p.waitForTimeout(400);
    (await p.$eval('#toast', (e) => e.textContent)).includes('2 schede') ? ok('import del backup dalla schermata iniziale') : bad('import backup: ' + await p.$eval('#toast', (e) => e.textContent));
    await go('');
    const days = await p.$$eval('a.day', (a) => a.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    days.length === 4 ? ok('home: 4 giornate') : bad('home: giornate ' + days.length);
    await overflow('home');
    for (const g of ['A', 'B', 'C', 'D']) {
      await go('#/giorno/' + g);
      const n = await p.$$eval('.ex-item', (x) => x.length);
      const svgs = await p.$$eval('.ex-item svg', (x) => x.length);
      if (n !== svgs) bad(`giorno ${g}: ${n} esercizi ma ${svgs} disegni`);
      await overflow('giornata ' + g);
      await p.click('#start'); await p.waitForTimeout(200);
      let guard = 0;
      while (guard++ < 20) {
        if (!(await p.$('#doneSet, #next'))) break;
        const name = await p.$eval('.ex-head h2', (e) => e.textContent);
        await overflow(`allenamento ${g} · ${name}`);
        // usa gli stepper sulla prima serie
        if (await p.$('#doneSet')) {
          await p.click('.set.cur [data-act="load+"]'); await p.click('.set.cur [data-act="load-"]');
          await p.click('.set.cur [data-act="reps+"]');
        }
        while (await p.$('#doneSet')) {
          await p.click('#doneSet'); await p.waitForTimeout(60);
          await p.evaluate(() => {});
        }
        const vals = await p.$$eval('.set input[data-f=load]', (x) => x.map((i) => i.value));
        if (vals.some((v) => v === '' || v === 'NaN')) bad(`${name}: carico vuoto/NaN dopo le serie ${vals}`);
        const last = await p.$eval('#next', (e) => e.textContent);
        await p.click('#next'); await p.waitForTimeout(150);
        if (/Fine/.test(last)) break;
      }
      const url = p.url();
      if (!url.includes('riepilogo')) bad(`giorno ${g}: dopo l'ultimo esercizio non arrivo al riepilogo (${url})`);
      const txt = await p.$eval('#txt', (t) => t.value).catch(() => '');
      if (/NaN|undefined|null/.test(txt)) bad(`riepilogo ${g}: testo con valori sbagliati\n${txt}`);
      if (/non fatto|saltato/.test(txt)) bad(`riepilogo ${g}: esercizi non registrati\n${txt}`);
      await overflow('riepilogo ' + g);
      await p.click('#copy'); await p.click('#close'); await p.waitForTimeout(200);
      ok(`giorno ${g}: allenamento completo e salvato`);
      if (g === 'B') console.log(txt);
    }
    await go('');
    const done = await p.$$eval('a.day.done', (x) => x.length);
    done === 4 ? ok('home: 4 giornate fatte') : bad('home: giornate fatte ' + done);
    // sessione con salto, indietro, lista, deseleziona serie, ricarica
    await go('#/giorno/A'); await p.click('#start'); await p.waitForTimeout(200);
    await p.click('#doneSet');
    await p.click('.set[data-i="0"] [data-act=done]'); // annulla
    const curAfterUndo = await p.$eval('#doneSet', (e) => e.textContent);
    /Serie 1/.test(curAfterUndo) ? ok('annullare una serie funziona') : bad('annullare serie: ' + curAfterUndo);
    await p.click('#doneSet'); await p.waitForTimeout(80);
    (await p.$eval('#skip', (e) => e.textContent)) === 'Prossimo esercizio' ? ok('link «Prossimo esercizio»') : bad('link: ' + await p.$eval('#skip', (e) => e.textContent));
    const nm0 = await p.$eval('.ex-head h2', (e) => e.textContent);
    await p.click('#skip'); await p.waitForTimeout(150);
    const nm = await p.$eval('.ex-head h2', (e) => e.textContent); nm !== nm0 ? ok('prossimo esercizio: ' + nm) : bad('prossimo esercizio non cambia');
    await p.click('#prev'); await p.waitForTimeout(150);
    (await p.$$eval('.set.done', (x) => x.length)) === 1 && !(await p.$('.set.done ~ .set.done')) ? ok('serie lasciate come erano') : bad('le serie sono cambiate passando al prossimo');
    await p.click('#list'); await p.waitForTimeout(150);
    const li = await p.$$eval('[data-i]', (x) => x.length); li === 6 ? ok('lista esercizi') : bad('lista esercizi ' + li);
    await p.click('[data-i="3"]'); await p.waitForTimeout(150);
    await p.reload(); await p.waitForTimeout(300);
    const after = await p.$eval('.top-title span', (e) => e.textContent);
    /4\/6/.test(after) ? ok('ricarica a metà: riprende dallo stesso esercizio') : bad('ricarica: ' + after);
    // carico vuoto
    await p.fill('.set.cur [data-f=load]', ''); await p.click('#doneSet');
    const toast = await p.$eval('#toast', (e) => e.textContent); /carico/.test(toast) ? ok('carico vuoto bloccato') : bad('carico vuoto non segnalato');
    await p.fill('.set.cur [data-f=load]', '12,5'); await p.fill('.set.cur [data-f=reps]', '9'); await p.click('#doneSet');
    (await p.$('#doneSet .ring')) && (await p.$('#restClock')) && !(await p.$('#timer')) ? ok('recupero sul pulsante della serie, niente popup') : bad('recupero: niente conto sul pulsante o popup ancora presente');
    await p.click('#restAdj [data-t="+15"]'); await p.click('#restAdj [data-t="-15"]');
    const off = await p.$eval('#doneSet .ring path', (e) => +e.style.strokeDashoffset); (off > 0 && off <= 100) ? ok('bordo del recupero si riempie') : bad('bordo del recupero: ' + off);
    const before = await p.$eval('#doneSet', (e) => e.textContent); await p.click('#doneSet'); await p.waitForTimeout(80);
    (await p.$$eval('.set.done', (x) => x.length)) >= 2 ? ok('durante il recupero si può segnare la serie dopo (' + before.trim().split('Recupero')[0].trim() + ')') : bad('recupero blocca la serie successiva');
    const v = await p.$eval('.set[data-i="0"] [data-f=load]', (e) => e.value); v === '12.5' || v === '12,5' ? ok('virgola decimale accettata') : bad('virgola: ' + v);
    await go(''); const resume = await p.$('.resume'); resume ? ok('home: banner Riprendi') : bad('manca banner Riprendi');
    // nuova sessione mentre una è aperta (dialog accettato)
    await go('#/giorno/C'); await p.click('#start'); await p.waitForTimeout(200);
    (await p.$eval('.top-title span', (e) => e.textContent)).includes('Giorno C') ? ok('nuova sessione sostituisce quella aperta') : bad('nuova sessione');
    await go('#/riepilogo'); await p.click('#close');
    // esercizi
    await go('#/esercizi'); const tiles = await p.$$eval('.tile', (x) => x.length); ok('libreria: ' + tiles + ' esercizi'); await overflow('libreria');
    for (const bt of await p.$$('.filters button')) { await bt.click(); }
    await p.fill('#q', 'panca'); const pn = await p.$$eval('.tile', (x) => x.length); pn > 0 ? ok('ricerca "panca": ' + pn) : bad('ricerca vuota');
    await p.fill('#q', 'zzz'); (await p.$('.empty')) ? ok('ricerca senza risultati') : bad('ricerca senza risultati: nessun messaggio');
    const keys = await p.evaluate(async () => Object.keys((await import('./js/exercises.js')).LIB));
    for (const k of keys) { await go('#/esercizio/' + k); const s = await p.$$eval('svg', (x) => x.length); if (s < 2) bad('esercizio ' + k + ': disegni mancanti'); await overflow('esercizio ' + k); }
    ok('aperte tutte le ' + keys.length + ' pagine esercizio');
    await go('#/esercizio/pullup?from=s2-r46'); await p.click('.play'); await p.click('.play');
    // storico
    for (const s of ['riepilogo', 'peso', 'forza', 'volume', 'allenamenti']) {
      await go('#/storico/' + s);
      const html = await p.$eval('#app', (e) => e.innerHTML);
      if (/NaN|undefined|Infinity/.test(html.replace(/data-tip="[^"]*"/g, (m) => (/NaN|undefined|Infinity/.test(m) ? m : '')))) bad(`storico ${s}: valori NaN/undefined/Infinity`);
      await overflow('storico ' + s);
    }
    ok('storico: 5 sezioni aperte');
    await go('#/storico/peso'); await p.click('[data-w="+"]'); await p.click('#wsave'); await p.waitForTimeout(200);
    const mine = await p.$$eval('[data-delw]', (x) => x.length); mine === 1 ? ok('pesata salvata') : bad('pesata non salvata');
    await p.fill('#wkg', 'abc'); await p.click('#wsave'); (await p.$eval('#toast', (e) => e.textContent)).includes('non valido') ? ok('pesata non valida bloccata') : bad('pesata non valida accettata');
    // superserie
    await p.evaluate(() => { const st = JSON.parse(localStorage.getItem('palestra.v1')); st.current = null; localStorage.setItem('palestra.v1', JSON.stringify(st)); });
    await p.reload(); await go('#/giorno/D');
    const ssOn = await p.$$eval('.ss-link.on', (x) => x.length); ssOn === 1 ? ok('superserie del diario proposta (Curl + French press)') : bad('superserie proposte: ' + ssOn);
    await p.click('.ss-link:not(.on)'); await p.waitForTimeout(100);
    (await p.$$eval('.ss-link.on', (x) => x.length)) === 2 ? ok('scelta superserie nella giornata') : bad('scelta superserie');
    await p.click('.ss-link.on'); await p.waitForTimeout(100);
    await p.click('#start'); await p.waitForTimeout(200);
    await p.click('#list'); await p.waitForTimeout(150);
    const nEx = await p.$$eval('[data-i]', (x) => x.length); await p.click(`[data-i="${nEx - 2}"]`); await p.waitForTimeout(200);
    (await p.$('.ss-banner:not(.off)')) ? ok('banner superserie in sessione') : bad('manca banner superserie');
    const n1 = await p.$eval('.ex-head h2', (e) => e.textContent);
    await p.click('#doneSet'); await p.waitForTimeout(150);
    const n2 = await p.$eval('.ex-head h2', (e) => e.textContent); const cur2 = await p.$eval('.set.cur', (e) => e.dataset.i);
    (n2 !== n1 && cur2 === '0' && !(await p.$('#restClock'))) ? ok(`superserie: dopo ${n1} serie 1 → ${n2} serie 1, senza recupero`) : bad(`superserie alternanza: ${n1} → ${n2}, serie ${cur2}`);
    await p.click('#doneSet'); await p.waitForTimeout(150);
    const n3 = await p.$eval('.ex-head h2', (e) => e.textContent); const cur3 = await p.$eval('.set.cur', (e) => e.dataset.i);
    (n3 === n1 && cur3 === '1' && (await p.$('#restClock'))) ? ok('superserie: fine giro → recupero, poi serie 2 del primo') : bad(`superserie giro: ${n3}, serie ${cur3}`);
    await p.click('#ssOff'); await p.waitForTimeout(100);
    (await p.$('.ss-banner.off')) ? ok('superserie separabile in sessione') : bad('separa superserie');
    await p.click('#ssOn'); await p.waitForTimeout(100);
    await p.click('#finish'); await p.waitForTimeout(150); await p.click('#close').catch(() => {}); await p.waitForTimeout(150);
    // misure corporee
    await go('#/storico/peso'); await p.click('#misura summary');
    await p.click('#msave'); (await p.$eval('#toast', (e) => e.textContent)).includes('almeno') ? ok('misurazione vuota bloccata') : bad('misurazione vuota accettata');
    for (const [k, v] of [['peso', '64,2'], ['grasso_pct', '14'], ['vita', '75'], ['fianchi', '92'], ['braccio', '34'], ['massa_muscolare', '30,5']]) await p.fill(`[data-m="${k}"]`, v);
    (await p.$eval('#mcalc', (e) => e.textContent)).includes('8,99') ? ok('massa grassa calcolata dal vivo') : bad('calcolo massa grassa: ' + await p.$eval('#mcalc', (e) => e.textContent));
    await p.click('#msave'); await p.waitForTimeout(200);
    const sm = await p.evaluate(() => JSON.parse(localStorage.getItem('palestra.v1')));
    (sm.misure.length === 1 && sm.misure[0].fianchi === 92 && sm.misure[0].massa_muscolare === 30.5 && sm.pesate.some((x) => x.data === sm.misure[0].data && x.peso === 64.2)) ? ok('misurazione salvata (e pesata del giorno)') : bad('misurazione non salvata ' + JSON.stringify(sm.misure));
    (await p.$$('[data-delm]')).length === 1 && (await p.$('#mkey')) ? ok('tabella e grafico misure') : bad('tabella/grafico misure mancanti');
    await p.selectOption('#mkey', 'braccio'); await p.waitForTimeout(100);
    (await p.$eval('#mkey', (e) => e.value)) === 'braccio' ? ok('grafico misure: cambio misura') : bad('select misura');
    await p.click('#copyw'); await p.click('[data-delw]'); await p.waitForTimeout(150);
    for (const v of ['30', '0', '60']) { await p.click('[data-range="' + v + '"]'); await p.waitForTimeout(80); }
    await go('#/storico/forza');
    for (const id of ['1', '2']) { await p.click(`[data-sch="${id}"]`); await p.waitForTimeout(120); const opts = await p.$$eval('#essel option', (x) => x.map((o) => o.value)); for (const o of opts.slice(0, 4)) await p.selectOption('#essel', o); }
    ok('forza: schede e selezione esercizio');
    await go('#/storico/volume'); await p.click('[data-sch="1"]'); await p.click('[data-sch="2"]');
    await p.click('.chart-svg [data-tip]'); (await p.$('.charttip:not([hidden])')) ? ok('tooltip al tocco') : bad('tooltip non compare');
    await go('#/storico/allenamenti');
    await p.selectOption('#theme', 'light'); await p.selectOption('#theme', 'auto');
    await p.fill('#nascita', '1990-01-01'); await p.$eval('#nascita', (e) => e.dispatchEvent(new Event('change')));
    await p.fill('#bw', '64'); await p.$eval('#bw', (e) => e.dispatchEvent(new Event('change')));
    const st = await p.evaluate(() => JSON.parse(localStorage.getItem('palestra.v1')));
    st.settings.bw === 64 && st.settings.nascita === '1990-01-01' ? ok('impostazione peso corporeo salvata') : bad('bw non salvato');
    const nSess = st.sessions.length;
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exp')]); const path = require('os').tmpdir() + '/palestra-backup-test.json'; await dl.saveAs(path);
    await p.click('[data-del]'); await p.waitForTimeout(150);
    await p.setInputFiles('#imp', path); await p.waitForTimeout(300);
    const st2 = await p.evaluate(() => JSON.parse(localStorage.getItem('palestra.v1')));
    st2.sessions.length === nSess ? ok('backup esporta/importa') : bad(`backup: ${nSess} → ${st2.sessions.length}`);
    // export settimanale per Claude
    const [dw] = await Promise.all([p.waitForEvent('download'), p.click('#expShare')]); const wpath = require('os').tmpdir() + '/palestra-week-test.json'; await dw.saveAs(wpath);
    const ex = JSON.parse(require('fs').readFileSync(wpath, 'utf8'));
    (ex.settimane[0].diario.misure && ex.settimane[0].diario.misure[0] && ex.settimane[0].diario.misure[0].colonne.fianchi === 'I' && ex.misure.length === 1) ? ok('export contiene le misure con le colonne del diario') : bad('misure non esportate');
    (ex.tipo === 'palestra-export' && ex.settimane[0].diario.allenamento.length && ex.settimane[0].diario.allenamento.every((r) => /^[A-Z]+\d+$/.test(r.cella_carico) && r.carico > 0)) ? ok(`export settimana: ${ex.settimane[0].diario.allenamento.length} righe, celle ${ex.settimane[0].diario.allenamento[0].cella_carico}/${ex.settimane[0].diario.allenamento[0].cella_reps}`) : bad('export settimana malformato');
    (await p.$eval('#expw', (e) => e.selectedOptions[0].textContent)).includes('già esportata') ? ok('settimana segnata come esportata') : bad('settimana non segnata');
    for (const per of ['mese', 'scheda', 'totale']) {
      await p.click(`[data-per="${per}"]`); await p.waitForTimeout(120);
      const [dp] = await Promise.all([p.waitForEvent('download'), p.click('#expShare')]); const pp = require('os').tmpdir() + `/palestra-${per}.json`; await dp.saveAs(pp);
      const e2 = JSON.parse(require('fs').readFileSync(pp, 'utf8'));
      (e2.periodo.tipo === per && e2.settimane.length >= 1 && e2.sessions.length === nSess) ? ok(`export ${per}: ${e2.periodo.etichetta}, ${e2.settimane.length} sett.`) : bad(`export ${per} malformato`);
    }
    await p.click('[data-per="settimana"]'); await p.waitForTimeout(120);
    await p.click('[data-del]'); await p.waitForTimeout(150);
    await p.setInputFiles('#imp', wpath); await p.waitForTimeout(300);
    const st3 = await p.evaluate(() => JSON.parse(localStorage.getItem('palestra.v1')));
    st3.sessions.length === nSess ? ok('import export settimanale') : bad(`import settimana: ${nSess} → ${st3.sessions.length}`);
    // rotte strane e storage corrotto
    await go('#/giorno/Z'); (p.url().endsWith('#/')) ? ok('giornata inesistente → home') : bad('giornata inesistente: ' + p.url());
    await go('#/esercizio/boh'); await go('#/storico/boh'); await go('#/qualcosa');
    await p.evaluate(() => localStorage.setItem('palestra.v1', '{rotto')); await go(''); (await p.$('#imp')) ? ok('storage corrotto: riparte pulita') : bad('storage corrotto rompe la home');
    await go('#/sessione'); p.url().endsWith('#/') ? ok('sessione inesistente → home') : bad('sessione inesistente: ' + p.url());
    await go('#/riepilogo');
    await ctx.close();
  }
  await b.close();
  console.log('\nPROBLEMI:', issues.length); issues.forEach((i) => console.log(' -', i.split('\n')[0]));
})();
