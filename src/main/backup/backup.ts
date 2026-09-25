import { rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { AppFout } from '@shared/fouten';
import { database, type Db } from '../db/verbinding';
import { log } from '../log';
import { paden } from '../paden';

// Kern van de back-up (TDO §14.2 eerste bullet, V-19, NFE-012). OFM-022 bouwt hier omheen: dagelijkse
// back-up bij opstart, lijst, handmatig, opruimen (nieuwste 30) en herstel.

export type BackupReden = 'dagelijks' | 'handmatig' | 'voor-migratie' | 'voor-herstel';

function tweeCijfers(n: number): string {
  return String(n).padStart(2, '0');
}

/** `offerte-maker-YYYY-MM-DD-HHmmss-<reden>.sqlite` in lokale tijd; past op de regex uit V-19. */
export function backupBestandsnaam(reden: BackupReden, nu: Date): string {
  const datum = `${nu.getFullYear()}-${tweeCijfers(nu.getMonth() + 1)}-${tweeCijfers(nu.getDate())}`;
  const tijd = `${tweeCijfers(nu.getHours())}${tweeCijfers(nu.getMinutes())}${tweeCijfers(nu.getSeconds())}`;
  return `offerte-maker-${datum}-${tijd}-${reden}.sqlite`;
}

/** `PRAGMA integrity_check` op een (read-only geopend) databasebestand. */
export function isIntact(pad: string): boolean {
  let kopie: Db | null = null;
  try {
    kopie = new Database(pad, { readonly: true, fileMustExist: true });
    return kopie.pragma('integrity_check', { simple: true }) === 'ok';
  } catch {
    return false;
  } finally {
    kopie?.close();
  }
}

/**
 * De kopie erft WAL-modus; dan maakt zelfs een read-only open `-wal`/`-shm`-bestanden ernaast. Met
 * `journal_mode = DELETE` is de back-up één losstaand bestand (ook nodig om hem later terug te zetten).
 */
function zetLosstaand(pad: string): void {
  const kopie = new Database(pad, { fileMustExist: true });
  try {
    kopie.pragma('journal_mode = DELETE');
  } finally {
    kopie.close();
  }
}

function verwijderKopie(pad: string): void {
  for (const extra of ['', '-wal', '-shm', '-journal']) rmSync(pad + extra, { force: true });
}

export interface BackupOpties {
  db?: Db;
  backupMap?: string;
  nu?: Date;
}

/**
 * Online-back-up met better-sqlite3 naar `backupMap`, daarna `integrity_check` op de kopie.
 * Mislukt een van beide: kopie weg, fout gelogd, `AppFout('BACKUP_MISLUKT')`. Geeft de bestandsnaam.
 */
export async function maakBackup(reden: BackupReden, opties: BackupOpties = {}): Promise<string> {
  const db = opties.db ?? database();
  const bestand = backupBestandsnaam(reden, opties.nu ?? new Date());
  const pad = join(opties.backupMap ?? paden.backupMap, bestand);

  try {
    await db.backup(pad);
    zetLosstaand(pad);
  } catch (fout: unknown) {
    verwijderKopie(pad);
    log.error(`back-up ${reden} mislukt`, fout);
    throw new AppFout('BACKUP_MISLUKT');
  }

  if (!isIntact(pad)) {
    verwijderKopie(pad);
    log.error(`back-up ${reden}: integrity_check niet ok, kopie verwijderd`);
    throw new AppFout('BACKUP_MISLUKT');
  }

  log.info(`back-up gemaakt: ${bestand}`);
  return bestand;
}
