# Palestra · allenamento guidato

Web app (statica, funziona anche offline) per allenarsi seguendo la scheda del diario palestra:

- **Home**: scegli la giornata (A, B, C, D) della scheda in corso; propone quella che manca questa settimana.
- **Allenamento guidato**: un esercizio alla volta, con disegno animato e muscoli coinvolti, carichi e ripetizioni delle settimane scorse, serie da registrare (carico e ripetizioni) e timer di recupero.
- **Riepilogo**: testo pronto da incollare in chat per aggiornare il diario («Curl bilanciere EZ: 28 × 10/10/9»).
- **Esercizi**: tutti gli esercizi del diario con illustrazione, mappa dei muscoli, consigli e andamento dei carichi.
- **Storico**: allenamenti registrati con l'app, impostazioni (peso corporeo per trazioni/dip, tema) e backup JSON.

Gli allenamenti registrati restano nel browser del telefono (localStorage). Usa «Esporta» nello Storico per un backup.

## Struttura

| File | Cosa contiene |
|---|---|
| `index.html`, `css/style.css` | pagina e stile |
| `js/app.js` | schermate, sessione guidata, timer, storico |
| `js/figure.js` | motore dei disegni (omino a tratto di matita, pose con angoli articolari, muscoli colorati) |
| `js/exercises.js` | catalogo dei movimenti: posa iniziale/finale, attrezzi, muscoli principali/secondari, consigli |
| `js/bodymap.js` | mappa del corpo fronte/retro |
| `js/scheda-import.js` | lettura delle schede da importare (formato in [`docs/formato-scheda.md`](docs/formato-scheda.md)) |
| `tools/export_data.py` | crea dal file Excel un backup da importare nell'app |

## I dati restano sul telefono

L'app pubblicata non contiene dati personali: al primo avvio è vuota e chiede di importare un backup.
Scheda, carichi, pesate e misure stanno solo nel browser del telefono (localStorage).
Da Storico → Impostazioni ed export si esporta un backup completo, che si reimporta su un altro telefono.

Per creare il backup dal diario Excel:

```bash
python3 tools/export_data.py Diario_palestra_2026-2027.xlsx palestra_backup.json
```

Il backup non va mai nel repository (`.gitignore` esclude `*backup*.json` e `data/`). Lo script legge il foglio «Allenamento» (carichi e ripetizioni medie di ogni scheda) e «Peso e misure»
(media settimanale del peso corporeo per trazioni e dip). Un esercizio nuovo va aggiunto al dizionario `ILLU`
dello script e, se è un movimento nuovo, a `LIB` in `js/exercises.js`.

## Provare in locale

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

## Online

Pubblicata con GitHub Pages dal branch `main` (cartella radice). Dal telefono: apri il link e «Aggiungi a schermata Home».

## Test

Con il server locale acceso (`python3 -m http.server 8765`), Playwright installato e un backup creato
con lo script (`PALESTRA_BACKUP=/percorso/palestra_backup.json`):

```bash
node tests/e2e.cjs            # tutte le sezioni, a 390 px (scuro) e 320 px (chiaro)
node tests/calcoli-offline.cjs # calcoli dopo una settimana registrata nell'app e uso offline
node tests/scheda-import.cjs # formato delle schede da importare (non serve il server)
node tests/casi-limite.cjs     # export con sole misure, import, promemoria, 320 px scuro
```
