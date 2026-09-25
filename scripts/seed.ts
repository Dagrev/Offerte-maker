import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { SEED_AANTAL, vulMetSeed } from './seedGegevens';

// `pnpm seed` (TDO §2.3, §15.4, V-04): vult de database in OFFERTE_MAKER_DATA met 5.000 offertes
// (vaste random-seed 42). Draait onder Electron-als-Node, zodat better-sqlite3 laadt. Werkt alleen met
// een expliciete OFFERTE_MAKER_DATA: nooit per ongeluk in de echte gegevens van %APPDATA%.
// De app mag tijdens het seeden niet draaien.

const dataMap = process.env['OFFERTE_MAKER_DATA'];
if (!dataMap) {
  console.error('Zet OFFERTE_MAKER_DATA op een (test)map, bijvoorbeeld:');
  console.error('  $env:OFFERTE_MAKER_DATA = "C:\\temp\\ofm-seed"; pnpm seed');
  process.exit(1);
}

mkdirSync(dataMap, { recursive: true });
const pad = join(dataMap, 'offerte-maker.sqlite');
const db = new Database(pad);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const start = performance.now();
try {
  const uitkomst = vulMetSeed(db, { documentenMap: process.env['OFFERTE_MAKER_DOCS'] ?? 'Offertes' });
  const duur = Math.round(performance.now() - start);
  console.log(`${uitkomst.aantal} offertes in ${pad} (${duur} ms).`);
  console.log(`Per status: ${JSON.stringify(uitkomst.perStatus)}`);
  if (uitkomst.aantal !== SEED_AANTAL) process.exitCode = 1;
} finally {
  db.close();
}
