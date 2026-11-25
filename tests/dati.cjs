// I test usano un backup creato con tools/export_data.py, che NON sta nel repository
// (contiene dati personali). Indica il file con PALESTRA_BACKUP=/percorso/backup.json
const fs = require('fs');
const BACKUP = process.env.PALESTRA_BACKUP || '/mnt/project-files/palestra/backup/palestra_backup_diario_2026-11-25.json';
if (!fs.existsSync(BACKUP)) { console.error('Manca il backup per i test: imposta PALESTRA_BACKUP'); process.exit(2); }
const DIARIO = JSON.parse(fs.readFileSync(BACKUP, 'utf8')).diario;
const stato = (x = {}) => ({ sessions: [], pesate: [], misure: [], exported: [], current: null, settings: {}, diario: DIARIO, ...x });
module.exports = { BACKUP, DIARIO, stato };
