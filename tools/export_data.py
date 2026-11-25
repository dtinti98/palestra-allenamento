"""Crea dal Diario palestra (xlsx) un backup da importare nell'app.

Uso: python3 tools/export_data.py Diario_palestra_2026-2027.xlsx palestra_backup.json
Il file va importato dal telefono (Storico → Allenamenti → Importa, o dalla schermata
iniziale). I dati restano sul telefono: non mettere il backup nel repository.
Legge le schede del foglio «Allenamento» (carichi E..P, ripetizioni medie W..AH
quando presenti) e le pesate di «Peso e misure» (per le medie settimanali).
"""
import datetime as dt
import json
import re
import sys

import openpyxl

ILLU = {
    'Curl bilanciere EZ': 'ez_curl', 'Curl bilanciere EZ (superset)': 'ez_curl',
    'Panca presa stretta': 'close_grip_bench', 'Curl spider manubri': 'spider_curl',
    'French press manubri': 'db_french_press', 'French press (superset)': 'db_french_press',
    'Curl martello su panca inclinata': 'incline_hammer_curl',
    'Estensioni tricipiti sopra testa, manubrio': 'overhead_triceps',
    'Trazioni prone zavorrate': 'pullup', 'Trazioni zavorrate': 'pullup',
    'Rematore Pendlay': 'pendlay_row', 'Rematore manubrio su panca': 'db_row_bench',
    'Pullover manubrio': 'db_pullover', 'Reverse fly manubri': 'reverse_fly',
    'Scrollate manubri': 'db_shrug', 'Panca inclinata bilanciere': 'incline_bb_bench',
    'Panca piana manubri': 'flat_db_bench', 'Military press manubri': 'db_military',
    'Alzate laterali manubri': 'lateral_raise', 'Alzate laterali (richiamo)': 'lateral_raise',
    'Dip alle parallele': 'dip', 'Alzate laterali busto inclinato': 'bent_lateral_raise',
    'Hip thrust macchinario': 'hip_thrust_machine', 'Back extension 45° glute bias': 'back_extension',
    'Leg curl': 'leg_curl', 'Leg Curl': 'leg_curl', 'Abduzioni macchinario': 'abductor_machine',
    'Calf': 'calf_raise', 'Panca inclinata manubri (richiamo)': 'incline_db_bench',
    'Incline DB Press': 'incline_db_bench', 'Rematore manubri (richiamo)': 'db_bent_row',
    'Back Squat - top set 1x5': 'back_squat', 'Back Squat - back-off 3x5': 'back_squat',
    'Panca piana bilanciere': 'bb_bench', 'Panca piana - volume': 'bb_bench',
    'Panca piana - top set 1x3': 'bb_bench', 'Panca piana - back-off 4x3': 'bb_bench',
    'Romanian Deadlift': 'rdl', 'Rematore chest-supported': 'chest_supported_row',
    'Bulgarian Split Squat': 'bulgarian_split_squat', 'Ab wheel / rollout': 'ab_wheel',
    'Deadlift - top set 1x4': 'deadlift', 'Deadlift - back-off 3x4': 'deadlift',
    'Stacco da terra - tecnico': 'deadlift', 'Front Squat': 'front_squat',
    'Military Press': 'bb_military', 'Hanging Leg Raise': 'hanging_leg_raise',
    'Pause Squat (multipower)': 'smith_pause_squat', 'Cable Row / Pulley': 'cable_row',
}
GRUPPO = {
    'Back Squat - top set 1x5': 'Quadricipiti', 'Back Squat - back-off 3x5': 'Quadricipiti', 'Panca piana bilanciere': 'Petto',
    'Romanian Deadlift': 'Catena posteriore', 'Rematore chest-supported': 'Dorso', 'Bulgarian Split Squat': 'Quadricipiti',
    'Deadlift - top set 1x4': 'Catena posteriore', 'Deadlift - back-off 3x4': 'Catena posteriore', 'Panca piana - volume': 'Petto',
    'Front Squat': 'Quadricipiti', 'Trazioni zavorrate': 'Dorso', 'Military Press': 'Spalle', 'Panca piana - top set 1x3': 'Petto',
    'Panca piana - back-off 4x3': 'Petto', 'Pause Squat (multipower)': 'Quadricipiti', 'Stacco da terra - tecnico': 'Catena posteriore',
    'Incline DB Press': 'Petto', 'Leg Curl': 'Catena posteriore', 'Cable Row / Pulley': 'Dorso',
    'Curl bilanciere EZ': 'Bicipiti', 'Panca presa stretta': 'Tricipiti', 'Curl spider manubri': 'Bicipiti', 'French press manubri': 'Tricipiti',
    'Curl martello su panca inclinata': 'Bicipiti', 'Estensioni tricipiti sopra testa, manubrio': 'Tricipiti',
    'Trazioni prone zavorrate': 'Dorso', 'Rematore Pendlay': 'Dorso', 'Rematore manubrio su panca': 'Dorso', 'Pullover manubrio': 'Dorso',
    'Reverse fly manubri': 'Spalle', 'Scrollate manubri': 'Dorso', 'Panca inclinata bilanciere': 'Petto', 'Panca piana manubri': 'Petto',
    'Military press manubri': 'Spalle', 'Alzate laterali manubri': 'Spalle', 'Dip alle parallele': 'Petto', 'Alzate laterali busto inclinato': 'Spalle',
    'Hip thrust macchinario': 'Glutei', 'Back extension 45° glute bias': 'Glutei', 'Leg curl': 'Catena posteriore', 'Abduzioni macchinario': 'Glutei',
    'Calf': 'Catena posteriore', 'Panca inclinata manubri (richiamo)': 'Petto', 'Rematore manubri (richiamo)': 'Dorso',
    'Alzate laterali (richiamo)': 'Spalle', 'Curl bilanciere EZ (superset)': 'Bicipiti', 'French press (superset)': 'Tricipiti',
}
# esercizi di riferimento per i massimali stimati (come nella dashboard)
RIFERIMENTO = {
    (1, 'Back Squat - top set 1x5'): 'Squat', (1, 'Back Squat - back-off 3x5'): 'Squat', (1, 'Panca piana bilanciere'): 'Panca',
    (1, 'Panca piana - volume'): 'Panca', (1, 'Panca piana - top set 1x3'): 'Panca', (1, 'Panca piana - back-off 4x3'): 'Panca',
    (1, 'Deadlift - top set 1x4'): 'Stacco', (1, 'Deadlift - back-off 3x4'): 'Stacco',
    (2, 'Panca inclinata bilanciere'): 'Panca inclinata', (2, 'Trazioni prone zavorrate'): 'Trazioni',
    (2, 'Rematore Pendlay'): 'Rematore Pendlay', (2, 'Hip thrust macchinario'): 'Hip thrust',
}
SINGLE = {'Rematore manubrio su panca', 'Pullover manubrio', 'Estensioni tricipiti sopra testa, manubrio'}
BODYWEIGHT = {'Trazioni prone zavorrate', 'Trazioni zavorrate', 'Dip alle parallele'}
FREE = {'Ab wheel / rollout', 'Hanging Leg Raise'}


def load_type(name, note):
    if name in BODYWEIGHT:
        return 'bw'
    if name in SINGLE:
        return 'single'
    if 'back extension' in name.lower():
        return 'plate'
    if name in FREE:
        return 'free'
    if 'somma dei due' in (note or '') or 'manubri' in name.lower() or name in ('Incline DB Press', 'Bulgarian Split Squat'):
        return 'sum'
    if any(k in name.lower() for k in ('macchinario', 'leg curl', 'calf', 'pulley', 'multipower')):
        return 'machine'
    return 'barbell'


def num(v):
    if v is None or v == '':
        return None
    f = float(v)
    return int(f) if f.is_integer() else round(f, 2)


def iso(d):
    return d.strftime('%Y-%m-%d') if isinstance(d, (dt.date, dt.datetime)) else None


def main(src, out):
    wb = openpyxl.load_workbook(src, data_only=True)
    pm = wb['Peso e misure']
    weigh = []
    for r in range(2, 600):
        d, p = pm.cell(r, 1).value, pm.cell(r, 2).value
        if isinstance(d, dt.datetime) and p is not None:
            weigh.append((d.date(), float(p)))

    def week_bw(monday):
        vals = [p for d, p in weigh if monday <= d < monday + dt.timedelta(days=7)]
        return round(sum(vals) / len(vals), 2) if vals else None

    ws = wb['Allenamento']
    schede = []
    r = 1
    while r < ws.max_row:
        a = ws.cell(r, 1).value
        if isinstance(a, str) and re.fullmatch(r'SCHEDA \d+', a.strip()):
            sid = int(a.split()[1])
            nome = ws.cell(r, 2).value
            if not nome or nome == '← nome':
                r += 1
                continue
            weeks = [ws.cell(r + 1, 5 + k).value for k in range(12)]
            sedute = [ws.cell(r + 2, 5 + k).value for k in range(12)]
            has_reps = ws.cell(r + 3, 23).value == 'Rip. S1'
            exs = []
            rr = r + 4
            while ws.cell(rr, 2).value and not str(ws.cell(rr, 1).value or '').startswith('Tonnellaggio'):
                name = str(ws.cell(rr, 2).value).strip()
                day = str(ws.cell(rr, 1).value).strip()
                sets = int(ws.cell(rr, 3).value or 0)
                reps = num(ws.cell(rr, 4).value)
                note = ws.cell(rr, 20).value or ''
                m = re.search(r'Rip\.\s*(\d+)\s*[–-]\s*(\d+)', note) or re.search(r'Rip\.\s*(\d+)', note)
                rng = [int(m.group(1)), int(m.group(2) if m.lastindex == 2 else m.group(1))] if m else None
                if not rng:
                    m2 = re.search(r'(\d+)\s*[–-]\s*(\d+)\s*reps', note)
                    rng = [int(m2.group(1)), int(m2.group(2))] if m2 else [int(reps), int(reps)] if reps else None
                rest = re.search(r'Rec\.\s*([^.]+?)\.', note)
                lt = load_type(name, note)
                hist = []
                for k in range(12):
                    kg = num(ws.cell(rr, 5 + k).value)
                    if kg is None:
                        continue
                    rd = num(ws.cell(rr, 23 + k).value) if has_reps else None
                    wk = weeks[k]
                    h = {'settimana': k + 1, 'data': iso(wk), 'carico': kg, 'reps': rd if rd is not None else reps,
                         'repsRegistrate': rd is not None}
                    if ws.cell(rr, 5 + k).fill.fgColor.rgb == 'FFFFF2CC':
                        h['piu'] = True
                    if lt == 'bw' and sid >= 2 and isinstance(wk, dt.datetime):  # convenzione peso corporeo + zavorra dalla Scheda 2
                        bw = week_bw(wk.date())
                        if bw is not None:
                            h['pesoCorporeo'] = bw
                    hist.append(h)
                exs.append({'id': f's{sid}-r{rr}', 'giorno': day, 'nome': name, 'illustrazione': ILLU.get(name),
                            'serie': sets, 'reps': reps, 'range': rng, 'recupero': rest.group(1).strip() if rest else None,
                            'note': note, 'tipoCarico': lt, 'gruppo': GRUPPO.get(name), 'riferimento': RIFERIMENTO.get((sid, name)),
                            'storico': hist})
                rr += 1
            giorni = sorted({e['giorno'] for e in exs})
            schede.append({'id': sid, 'nome': nome, 'inizio': iso(ws.cell(r, 5).value), 'fine': iso(ws.cell(r, 7).value),
                           'giorni': giorni, 'settimane': [iso(w) for w in weeks],
                           'seduteSvolte': [s.split() if s else [] for s in sedute], 'esercizi': exs})
            r = rr
        r += 1
    misure = []
    for r in range(2, 600):
        d = pm.cell(r, 1).value
        if isinstance(d, dt.datetime) and pm.cell(r, 4).value is not None:
            g = lambda c: num(pm.cell(r, c).value)
            misure.append({'data': iso(d), 'peso': g(2), 'grasso_pct': round(float(pm.cell(r, 4).value) * 100, 1),
                           'viscerale': round(float(pm.cell(r, 5).value or 0) * 100, 1), 'massa_grassa': g(6), 'massa_magra': g(7),
                           'vita': g(8), 'fianchi': g(9), 'torace': g(10), 'braccio': g(11), 'coscia': g(12), 'basale': g(13)})
    ctx = wb['Contesto']
    contesto = {'basale': num(ctx['B16'].value), 'fattore': num(ctx['B18'].value), 'fabbisogno': num(ctx['B19'].value)}
    die = wb['Dieta']
    piani = []
    for r in range(5, 10):
        if die.cell(r, 2).value and die.cell(r, 4).value:
            piani.append({'nome': die.cell(r, 2).value, 'dal': iso(die.cell(r, 3).value), 'kcal': num(die.cell(r, 4).value),
                          'proteine': num(die.cell(r, 5).value)})
    data = {'generato': dt.datetime.now().strftime('%Y-%m-%dT%H:%M'),
            'pesate': [{'data': d.isoformat(), 'peso': p} for d, p in weigh], 'misure': misure, 'contesto': contesto,
            'piani': piani, 'schede': schede}
    missing = [e['nome'] for s in schede for e in s['esercizi'] if not e['illustrazione']]
    if missing:
        print('Senza illustrazione:', missing, file=sys.stderr)
    backup = {'tipo': 'palestra-backup', 'versione': 1, 'creato': dt.datetime.now().isoformat(timespec='seconds'),
              'nota': 'Backup creato dal file Excel: contiene il diario (schede, carichi, pesate, misure).',
              'diario': data, 'sessions': [], 'pesate': [], 'misure': [], 'settings': {}}
    json.dump(backup, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"{out}: {len(schede)} schede, {sum(len(s['esercizi']) for s in schede)} esercizi")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
