# Formato «palestra-scheda» (versione 1)

Il file JSON con cui una scheda di allenamento entra nell'app da **Le tue schede → Importa scheda**.
L'app legge il file, mostra la scheda nell'editor già compilata e la salva solo quando premi **Salva**:
importare non tocca le schede esistenti né lo storico dei carichi.

Esempio completo: [`esempio-scheda.json`](esempio-scheda.json). Lettura e controlli: `js/scheda-import.js`
(`parseSchedaJSON`), provati da `node tests/scheda-import.cjs`.

## Struttura

```json
{
  "formato": "palestra-scheda",
  "versione": 1,
  "scheda": {
    "titolo": "Ipertrofia 3 giorni",
    "inizio": "2027-01-04",
    "settimane": 8,
    "note": "…",
    "giorni": [
      {
        "nome": "Spinta",
        "esercizi": [
          { "esercizio": "bb_bench", "serie": 4, "ripetizioni": "6-8", "recupero": 150, "kg": 70 },
          { "esercizio": "lateral_raise", "serie": 3, "ripetizioni": "12-15", "recupero": 60, "superserie": "S1" },
          { "esercizio": "triceps_pushdown", "serie": 3, "ripetizioni": "10-12", "recupero": 60, "superserie": "S1" }
        ]
      }
    ]
  }
}
```

### File

| Campo | Obbligatorio | Valore |
|---|---|---|
| `formato` | sì | sempre `"palestra-scheda"` (distingue la scheda da backup ed export) |
| `versione` | sì | `1` |
| `scheda` | sì | oggetto descritto sotto |

### `scheda`

| Campo | Obbligatorio | Valore | Se manca |
|---|---|---|---|
| `titolo` | sì | testo, max 60 caratteri (es. `"Ipertrofia 4 giorni"`) | «Scheda importata» |
| `inizio` | no | data `AAAA-MM-GG`; se non è lunedì si usa il lunedì della stessa settimana | l'app propone il lunedì corrente |
| `settimane` | no | intero da 1 a 26 | 8 |
| `note` | no | testo libero sulla scheda (progressione, scarico…) | — |
| `giorni` | sì | lista di giornate, da 1 a 10, **nell'ordine A, B, C…** | — |

### `giorni[]`

| Campo | Obbligatorio | Valore |
|---|---|---|
| `nome` | sì | nome della giornata, max 40 caratteri (es. `"Petto + spalle"`) |
| `esercizi` | sì | lista di esercizi in ordine di esecuzione, almeno uno |
| `attrezzatura` | no | cosa portare quel giorno (in home come «Porta con te»): lista di chiavi note o testo libero (max 30 caratteri), es. `["cintura", "fasce"]` |

Attrezzi noti: `cintura`, `fasce`, `straps`, `cintura_zavorra`, `ginocchiere`, `gomitiere`, `magnesite`, `guanti`, `elastici`,
`cavigliere`, `scarpe_squat`, `asciugamano`. Vale anche il nome mostrato (`"Scarpe da squat"` = `scarpe_squat`);
qualsiasi altra voce breve entra come voce libera.

La lettera della giornata (A, B, C…) non si scrive: la dà la posizione nella lista.

### `esercizi[]`

| Campo | Obbligatorio | Valore | Se manca |
|---|---|---|---|
| `esercizio` | sì | **id del catalogo** (tabella sotto), es. `"bb_bench"` | — |
| `nome` | no | nome da mostrare, se diverso da quello del catalogo | nome del catalogo |
| `serie` | no | intero da 1 a 10 | 3 |
| `ripetizioni` | sì | numero (`10`, `"10"`) o intervallo (`"8-10"`) | — |
| `recupero` | no | **secondi** (`90`, `150`); accettati anche `"2:30"`, `"90s"`, `"2'"` | nessun recupero |
| `tipoCarico` | no | come si legge il carico (sotto) | dedotto dal nome |
| `kg` | no | carico iniziale proposto alla prima seduta (es. `22.5`) | — |
| `superserie` | no | etichetta (`"S1"`, `"A"`…): esercizi **consecutivi** con la stessa etichetta sono in superserie | da solo |
| `note` | no | indicazione tecnica (tempo, pausa, cedimento…) | — |
| `muscoli` | solo se `esercizio` non è nel catalogo | `{ "primari": [...], "secondari": [...] }` | — |

Il recupero si scrive in secondi e l'app lo mostra nella sua notazione: 90 → 90″, 120 → 2′, 150 → 2′30″.

**Tipi di carico** (`tipoCarico`): `barbell` bilanciere · `machine` macchina o cavi · `sum` due manubri (si scrive la somma) ·
`single` un manubrio · `plate` disco · `bw` corpo libero + zavorra (kg = zavorra) · `free` altro.

**Esercizio non in catalogo**: si usa un id nuovo in minuscolo con trattini bassi, più `nome` e `muscoli`.
L'app lo crea tra gli esercizi tuoi (senza disegno, con la mappa dei muscoli). Muscoli validi:
`petto`, `dorso`, `trapezi`, `lombari`, `deltoidi` (laterali), `deltoidi-ant`, `deltoidi-post`, `bicipiti`, `tricipiti`,
`avambracci`, `addome`, `glutei`, `abduttori`, `quadricipiti`, `femorali`, `polpacci`.

```json
{ "esercizio": "pressa_orizzontale", "nome": "Pressa orizzontale",
  "muscoli": { "primari": ["quadricipiti"], "secondari": ["glutei"] },
  "serie": 3, "ripetizioni": "10-12", "recupero": 90, "tipoCarico": "machine" }
```

## Cosa l'app rifiuta

Il file non viene importato, con un messaggio che dice giornata ed esercizio, se: non è JSON, `formato` è diverso,
mancano le giornate o gli esercizi, un id non è nel catalogo e non ha `nome` e `muscoli`, `ripetizioni` non è un numero
o un intervallo (niente «max» o «30 secondi»: scriverli nelle `note`), `serie` è fuori da 1–10, `tipoCarico` o `recupero` non si leggono.
Sono solo avvisi (il file passa): `inizio` non di lunedì, attrezzo non tra quelli noti (entra come voce libera), superserie con un solo esercizio, campi sconosciuti (ignorati).

## Regole per chi converte una scheda

- Un file per scheda, nome consigliato `scheda-<titolo>-<AAAA-MM-GG>.json`, UTF-8.
- Per ogni esercizio cercare l'id nel catalogo qui sotto; il nome scritto nella scheda originale va in `nome` solo se diverso.
- Ripetizioni a piramide (12/10/8): intervallo `"8-12"` e la sequenza nelle `note`. Esercizi a tempo (plank 45″): `ripetizioni` 1 e il tempo nelle `note`.
- Attrezzatura: se la scheda la indica (cintura, fasce, straps…) va in `attrezzatura` della giornata; altrimenti si deduce solo se è ovvia (zavorra per trazioni o dip zavorrati).
- Tecniche (drop set, rest-pause, tempo 3-1-1, RIR/RPE) nelle `note` dell'esercizio; progressione e scarico nelle `note` della scheda.
- Il file non contiene dati personali oltre alla scheda stessa.

## Catalogo degli esercizi (id)

Aggiornato al catalogo in `js/exercises.js` + `js/exercises_extra.js`. Un id che manca qui si può comunque usare con `muscoli`.

| id | Esercizio | Muscoli principali |
|---|---|---|
| `ab_wheel` | Ab wheel / rollout | Addome |
| `abductor_machine` | Abduzioni al macchinario | Abduttori (gluteo medio) |
| `db_lunge` | Affondi con manubri | Quadricipiti, Glutei |
| `front_raise` | Alzate frontali con manubri | Deltoidi anteriori |
| `bent_lateral_raise` | Alzate laterali a busto inclinato | Deltoidi laterali |
| `lateral_raise` | Alzate laterali con manubri | Deltoidi laterali |
| `arnold_press` | Arnold press | Deltoidi anteriori, Deltoidi laterali |
| `back_extension` | Back extension 45° (glute bias) | Glutei |
| `back_squat` | Back squat | Quadricipiti, Glutei |
| `bulgarian_split_squat` | Bulgarian split squat | Quadricipiti, Glutei |
| `seated_calf` | Calf da seduto | Polpacci |
| `calf_raise` | Calf in piedi | Polpacci |
| `cable_crossover` | Croci ai cavi | Petto |
| `incline_db_fly` | Croci con manubri su panca inclinata | Petto |
| `db_fly` | Croci con manubri su panca piana | Petto |
| `cable_crunch` | Crunch ai cavi | Addome |
| `hammer_curl` | Curl a martello | Bicipiti |
| `incline_hammer_curl` | Curl a martello su panca inclinata | Bicipiti |
| `preacher_curl` | Curl alla panca Scott | Bicipiti |
| `ez_curl` | Curl con bilanciere EZ | Bicipiti |
| `db_curl` | Curl con manubri | Bicipiti |
| `spider_curl` | Curl spider con manubri | Bicipiti |
| `dip` | Dip alle parallele | Petto |
| `overhead_triceps` | Estensioni tricipiti sopra la testa | Tricipiti |
| `face_pull` | Face pull ai cavi | Deltoidi posteriori |
| `skullcrusher` | French press con bilanciere EZ | Tricipiti |
| `db_french_press` | French press con manubri | Tricipiti |
| `front_squat` | Front squat | Quadricipiti |
| `goblet_squat` | Goblet squat | Quadricipiti, Glutei |
| `hack_squat` | Hack squat | Quadricipiti |
| `hanging_leg_raise` | Hanging leg raise | Addome |
| `hip_thrust_machine` | Hip thrust al macchinario | Glutei |
| `lat_pulldown_wide` | Lat machine presa larga | Dorsali |
| `lat_pulldown_close` | Lat machine presa stretta | Dorsali |
| `leg_curl` | Leg curl | Femorali |
| `seated_leg_curl` | Leg curl da seduto | Femorali |
| `leg_extension` | Leg extension | Quadricipiti |
| `leg_press` | Leg press | Quadricipiti, Glutei |
| `bb_military` | Military press con bilanciere | Deltoidi anteriori, Deltoidi laterali |
| `db_military` | Military press con manubri | Deltoidi laterali |
| `incline_bb_bench` | Panca inclinata con bilanciere | Petto |
| `incline_db_bench` | Panca inclinata con manubri | Petto |
| `bb_bench` | Panca piana con bilanciere | Petto |
| `flat_db_bench` | Panca piana con manubri | Petto |
| `close_grip_bench` | Panca presa stretta | Tricipiti |
| `smith_pause_squat` | Pause squat al multipower | Quadricipiti, Glutei |
| `pec_deck` | Pectoral machine (butterfly) | Petto |
| `pushup` | Piegamenti sulle braccia | Petto |
| `plank` | Plank | Addome |
| `straight_arm_pulldown` | Pull down a braccia tese | Dorsali |
| `cable_row` | Pulley basso (cable row) | Dorsali |
| `db_pullover` | Pullover con manubrio | Dorsali |
| `triceps_pushdown` | Push down ai cavi con corda | Tricipiti |
| `chest_supported_row` | Rematore chest-supported | Dorsali |
| `bb_row` | Rematore con bilanciere | Dorsali |
| `db_bent_row` | Rematore con manubri a busto flesso | Dorsali |
| `db_row_bench` | Rematore con manubrio su panca | Dorsali |
| `pendlay_row` | Rematore Pendlay | Dorsali |
| `t_bar_row` | Rematore T-bar | Dorsali |
| `reverse_fly` | Reverse fly con manubri | Deltoidi posteriori |
| `rdl` | Romanian deadlift | Femorali, Glutei |
| `db_shrug` | Scrollate con manubri | Trapezi |
| `sl_db_deadlift` | Stacco a gambe tese con manubri | Femorali |
| `deadlift` | Stacco da terra | Glutei, Femorali, Lombari |
| `upright_row` | Tirate al mento con bilanciere | Deltoidi laterali |
| `pullup` | Trazioni prone | Dorsali |
| `chin_up` | Trazioni supine (chin up) | Dorsali |
