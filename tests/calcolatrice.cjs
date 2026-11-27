// Calcolatrice nella schermata esercizio: percentuale, dischi per lato, bilancieri salvati nelle impostazioni.
const { chromium } = require('playwright');
const fs = require('fs');
const { stato } = require('./dati.cjs');
const U = 'http://localhost:8765/';
let bad = 0;
const ok = (m) => console.log('  ✓ ' + m), ko = (m) => { bad++; console.log('  ✗ ' + m); };

(async () => {
  const b = await chromium.launch();
  for (const [w, scheme] of [[390, 'light'], [320, 'dark']]) {
    console.log(`\n===== ${w}px ${scheme}`);
    const p = await b.newPage({ viewport: { width: w, height: 800 }, colorScheme: scheme, acceptDownloads: true });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
    const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('palestra.v1')));
    const overflow = async (where) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 1) ko(`${where}: scorre in orizzontale di ${o}px`); };
    const txt = (sel) => p.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ').trim());
    await p.goto(U); await p.evaluate((s) => localStorage.setItem('palestra.v1', JSON.stringify(s)), stato()); await p.reload(); await p.waitForTimeout(300);
    await p.goto(U + '#/giorno/C'); await p.waitForTimeout(250); await p.click('#start'); await p.waitForTimeout(250);
    await p.click('#doneSet'); await p.waitForTimeout(100);

    await p.click('#calcBtn'); await p.waitForTimeout(200);
    (await p.$('#calcOv .calc-sheet')) ? ok('il pulsante «Calcola» apre il pannello') : ko('pannello non aperto');
    await overflow('calcolatrice percentuale');
    const base = await p.$$eval('[data-base]', (x) => x.map((e) => e.dataset.base));
    base.join(',') === 'max,oggi,altro' ? ok('parti da: massimale, carico di oggi, altro') : ko('basi ' + base);
    await p.click('[data-base="oggi"]'); await p.click('[data-pv="50"]'); await p.waitForTimeout(80);
    const oggi = +(await p.$eval('.set.cur [data-f=load]', (e) => e.value));
    const r50 = await txt('.c-res b');
    r50 === `${(Math.round((oggi * 0.5) / 2.5) * 2.5).toLocaleString('it-IT')} kg` ? ok(`50% del carico di oggi (${oggi}): ${r50}`) : ko(`50%: ${r50} (oggi ${oggi})`);
    const sc = await p.$$eval('[data-pv]', (x) => x.map((e) => e.dataset.pv)).then((x) => x.join(','));
    sc === '50,70,80,90' ? ok('scorciatoie 50 · 70 · 80 · 90') : ko('scorciatoie ' + sc);
    await p.$eval('#cWheel', (w) => { w.scrollTop = 54 * 26; }); await p.waitForTimeout(450);
    (await p.$eval('#cWheel', (w) => w.getAttribute('aria-valuenow'))) === '55' && /^55% di/.test(await txt('.c-how')) ? ok('rotellina: 55%') : ko('rotellina: ' + await txt('.c-how'));
    await p.fill('#cAltro', '100'); await p.waitForTimeout(80);
    (await txt('.c-res b')) === '55 kg' ? ok('altro: 55% di 100 = 55 kg') : ko('altro ' + await txt('.c-res b'));
    (await txt('#cUse')) === 'Usa 55 kg nella serie 2' ? ok('pulsante «Usa 55 kg nella serie 2»') : ko('usa: ' + await txt('#cUse'));

    // dischi: nessun bilanciere predefinito
    await p.click('[data-ct="dischi"]'); await p.click('[data-kind="bil"]'); await p.waitForTimeout(80);
    (await p.$$('[data-bar]')).length === 0 && (await p.$('.c-empty')) ? ok('dischi: nessun bilanciere all\'inizio, invito con +') : ko('bilancieri predefiniti presenti');
    (await p.$('#cUse')) ? ko('«Usa» attivo senza bilanciere') : ok('«Usa» spento finché manca il bilanciere');
    await p.click('#cBarAdd'); await p.fill('#cBarN', 'Olimpico'); await p.fill('#cBarK', '20'); await p.click('#cBarSave'); await p.waitForTimeout(80);
    await p.click('#cBarAdd'); await p.fill('#cBarN', 'EZ'); await p.fill('#cBarK', '10'); await p.click('#cBarSave'); await p.waitForTimeout(80);
    const bl = (await p.$$eval('[data-bar]', (x) => x.map((e) => e.textContent.trim()))).join('|');
    bl === 'Olimpico 20|EZ 10' ? ok('bilancieri aggiunti: Olimpico 20, EZ 10') : ko('bilancieri ' + bl);
    await p.click('[data-bar="0"]'); await p.fill('#cTot', '80'); await p.press('#cTot', 'Enter'); await p.waitForTimeout(80);
    (await txt('.c-side')) === '30 kg per lato 25 5' ? ok('80 kg con l\'olimpico: 30 per lato = 25 + 5') : ko('per lato: ' + await txt('.c-side'));
    await overflow('calcolatrice dischi');
    await p.fill('#cTot', '81'); await p.press('#cTot', 'Enter'); await p.waitForTimeout(80);
    /il più vicino è 80 kg/.test(await txt('.c-warn').catch(() => '')) ? ok('81 kg: avvisa e propone 80') : ko('avviso non componibile');
    await p.click('[data-bar="1"]'); await p.fill('#cTot', '47,5'); await p.press('#cTot', 'Enter'); await p.waitForTimeout(80);
    (await txt('.c-side')) === '18,75 kg per lato 15 2,5 1,25' ? ok('47,5 kg con l\'EZ: 18,75 per lato') : ko('EZ: ' + await txt('.c-side'));
    // dischi della palestra modificati: senza 1,25 il più vicino è 17,5 o 20 per lato
    await p.click('#cDiscEdit'); await p.fill('#cDisc', '20 10 5 2,5'); await p.click('#cDiscSave'); await p.waitForTimeout(80);
    const side2 = await txt('.c-side');
    /^(17,5|20) kg per lato/.test(side2) && /il più vicino/.test(await txt('.c-warn').catch(() => '')) ? ok('dischi modificati: ricalcola (' + side2 + ')') : ko('dischi modificati: ' + side2);
    await p.click('#cUse'); await p.waitForTimeout(250);
    (await p.$('#calcOv')) ? ko('pannello ancora aperto dopo «Usa»') : ok('«Usa» chiude il pannello');
    const v = await p.$eval('.set.cur [data-f=load]', (e) => e.value);
    v === '45' || v === '50' ? ok('carico scritto nella serie in corso: ' + v) : ko('carico nella serie: ' + v);
    const s = (await st()).settings;
    s.bilancieri.length === 2 && s.dischi.join(',') === '20,10,5,2.5' ? ok('bilancieri e dischi salvati nelle impostazioni') : ko('impostazioni ' + JSON.stringify([s.bilancieri, s.dischi]));
    // elimina un bilanciere
    await p.click('#calcBtn'); await p.waitForTimeout(150);
    if (!(await p.$('#cBarEdit'))) { await p.click('[data-ct="dischi"]'); await p.click('[data-kind="bil"]'); }
    await p.click('#cBarEdit'); await p.click('[data-delbar="1"]'); await p.waitForTimeout(80);
    (await p.$$('[data-bar]')).length === 1 ? ok('bilanciere eliminato') : ko('eliminazione bilanciere');
    // da percentuale dentro i dischi, poi manubri
    await p.click('#cDiscEdit'); await p.fill('#cDisc', '25 20 15 10 5 2,5 1,25'); await p.click('#cDiscSave'); await p.waitForTimeout(80);
    await p.fill('#cAltro', '100'); await p.press('#cAltro', 'Enter'); await p.waitForTimeout(80); await p.click('[data-pv="80"]'); await p.waitForTimeout(80);
    (await p.$eval('#cTot', (e) => e.value)) === '80' && (await txt('#cFromTxt')) === '80% di 100 = 80 kg' ? ok('da percentuale compila il carico totale (80% di 100)') : ko('da percentuale: ' + await p.$eval('#cTot', (e) => e.value) + ' / ' + await txt('#cFromTxt'));
    await p.click('[data-kind="man"]'); await p.waitForTimeout(80);
    if (await p.$eval('#cComp', (e) => e.getAttribute('aria-checked')) === 'true') await p.click('#cComp');
    await p.fill('#cAltro', '66'); await p.press('#cAltro', 'Enter'); await p.waitForTimeout(80); await p.click('[data-pv="70"]'); await p.waitForTimeout(80);
    (await p.$eval('#cTot', (e) => e.value)) === '46' && /→ 46 kg$/.test(await txt('#cFromTxt')) ? ok('manubri: 70% di 66 → 46 kg') : ko('manubri pct: ' + await p.$eval('#cTot', (e) => e.value) + ' / ' + await txt('#cFromTxt'));
    (await txt('.c-man')) === '23 kg per manubrio 46 kg ÷ 2' ? ok('23 kg per manubrio (46 ÷ 2)') : ko('per manubrio: ' + await txt('.c-man'));
    /^Usa 46 kg nella serie [0-9]$/.test(await txt('#cUse')) ? ok('«Usa» scrive il totale (46 kg)') : ko('usa manubri: ' + await txt('#cUse'));
    await p.click('#cComp'); await p.waitForTimeout(80);
    (await p.$('.c-empty')) && !(await p.$('#cUse')) ? ok('componibili: maniglia da aggiungere con +') : ko('componibili senza maniglia');
    await p.click('#cManAdd'); await p.fill('#cManN', 'Maniglia'); await p.fill('#cManK', '2,5'); await p.click('#cManSave'); await p.waitForTimeout(80);
    await p.fill('#cTot', '40'); await p.press('#cTot', 'Enter'); await p.waitForTimeout(80);
    (await txt('.c-side-s')) === '8,75 kg per lato, su ogni manubrio 5 2,5 1,25' ? ok('40 kg: 8,75 per lato su ogni manubrio') : ko('componibili: ' + await txt('.c-side-s'));
    await overflow('calcolatrice manubri');
    const s2 = (await st()).settings;
    s2.manComp === true && s2.maniglie.length === 1 && s2.maniglie[0].kg === 2.5 ? ok('maniglia e interruttore salvati') : ko('impostazioni manubri ' + JSON.stringify([s2.manComp, s2.maniglie]));
    await p.click('#cClose'); (await p.$('#calcOv')) ? ko('Chiudi non chiude') : ok('Chiudi');
    // nel backup completo
    await p.goto(U + '#/storico/impostazioni'); await p.waitForTimeout(250);
    const dl = p.waitForEvent('download', { timeout: 5000 }).catch(() => null); await p.click('#exp'); const d = await dl;
    if (d) { const f = JSON.parse(fs.readFileSync(await d.path(), 'utf8')); (f.settings && f.settings.bilancieri && f.settings.bilancieri[0].nome === 'Olimpico') ? ok('bilancieri nel backup completo') : ko('bilancieri non nel backup'); }
    else console.log('  · backup: download non intercettato');
    console.log('  errori JS: ' + (errs.length ? errs.join(' | ') : 'nessuno')); bad += errs.length;
    await p.close();
  }
  await b.close();
  console.log('\nPROBLEMI: ' + bad); process.exit(bad ? 1 : 0);
})();
