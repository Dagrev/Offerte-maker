import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migreer } from '../../src/main/db/migraties';
import { gebruikDatabase, openDatabase, type Db } from '../../src/main/db/verbinding';

// Testdatabase in een tijdelijke map, gemigreerd en ingesteld als `database()`.
// Mock in het testbestand `electron` (app.getPath) en `src/main/log` (zie src/main/db/*.test.ts).

export interface TestDatabase {
  db: Db;
  map: string;
  pad: string;
  opruimen: () => void;
}

export async function maakTestDatabase(opties: { migreren?: boolean } = {}): Promise<TestDatabase> {
  const map = mkdtempSync(join(tmpdir(), 'ofm-db-'));
  const pad = join(map, 'offerte-maker.sqlite');
  const db = openDatabase(pad);
  if (opties.migreren !== false) await migreer(db, { backup: () => Promise.resolve() });
  gebruikDatabase(db);
  return {
    db,
    map,
    pad,
    opruimen: () => {
      gebruikDatabase(null);
      if (db.open) db.close();
      rmSync(map, { recursive: true, force: true });
    },
  };
}
