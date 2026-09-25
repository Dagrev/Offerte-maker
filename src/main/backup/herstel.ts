import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { app } from 'electron';
import { AppFout } from '@shared/fouten';
import { backupBestandSchema } from '@shared/schemas';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import { SCHEMA_VERSIE } from '../db/migraties';
import { openAppDatabase, sluitDatabase } from '../db/verbinding';
import { log } from '../log';
import { paden } from '../paden';
import { isIntact, maakBackup } from './backup';

// Back-up terugzetten (TDO §14.2, V-19, FE-101). Eigenaar: OFM-022. Staat los van backup.ts omdat het
// de migraties nodig heeft (schemaversie), en migraties.ts zelf backup.ts gebruikt.

export interface HerstelOpties {
  backupMap?: string;
  /** Pad van de app-database (standaard `paden.database`). */
  databasePad?: string;
  /** Standaard `app.relaunch(); app.exit(0)`. In tests een nep. */
  herstart?: () => void;
  /** Standaard `openAppDatabase()`: de oude database weer openen als het vervangen mislukt. */
  heropen?: () => void;
}

function schemaVersie(pad: string): number {
  const db = new Database(pad, { readonly: true, fileMustExist: true });
  try {
    return db.pragma('user_version', { simple: true }) as number;
  } finally {
    db.close();
  }
}

/**
 * Zet een back-up terug. `bestand` is alleen een naam (regex V-19); main bouwt het pad zelf uit
 * `backupMap`, dus `..\` werkt niet. Eerst alle controles en een `voor-herstel`-back-up; pas daarna
 * wordt de database gesloten en vervangen. Bij elke fout vóór het vervangen verandert er niets.
 */
export async function zetTerug(bestand: string, opties: HerstelOpties = {}): Promise<void> {
  if (!backupBestandSchema.safeParse(bestand).success) {
    throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
  }
  const map = opties.backupMap ?? paden.backupMap;
  const bron = join(map, bestand);
  if (!existsSync(bron) || !isIntact(bron)) {
    log.warn(`herstel geweigerd: ${bestand} ontbreekt of is niet intact`);
    throw new AppFout('HERSTEL_MISLUKT');
  }
  if (schemaVersie(bron) > SCHEMA_VERSIE) {
    log.warn(`herstel geweigerd: ${bestand} heeft een nieuwere schemaversie`);
    throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.backupVanNieuwereVersie);
  }

  const doel = opties.databasePad ?? paden.database;
  const tijdelijk = `${doel}.herstel`;
  try {
    // Eerst naast de database kopiëren, vóór de voor-herstel-back-up: die ruimt op naar 30 en zou
    // anders de gekozen (oudste) back-up kunnen weghalen. Mislukt dit, dan is er niets veranderd.
    copyFileSync(bron, tijdelijk);
  } catch (fout: unknown) {
    rmSync(tijdelijk, { force: true });
    log.error('herstel: kopiëren mislukt', fout);
    throw new AppFout('HERSTEL_MISLUKT');
  }

  try {
    await maakBackup('voor-herstel', { backupMap: map });
  } catch {
    rmSync(tijdelijk, { force: true });
    throw new AppFout('HERSTEL_MISLUKT');
  }

  sluitDatabase();
  try {
    for (const extra of ['-wal', '-shm']) rmSync(doel + extra, { force: true });
    renameSync(tijdelijk, doel);
  } catch (fout: unknown) {
    rmSync(tijdelijk, { force: true });
    log.error('herstel: vervangen mislukt, oude database blijft', fout);
    (opties.heropen ?? openAppDatabase)();
    throw new AppFout('HERSTEL_MISLUKT');
  }

  log.info(`back-up teruggezet: ${bestand}; app herstart`);
  (
    opties.herstart ??
    (() => {
      app.relaunch();
      app.exit(0);
    })
  )();
}
