import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { AppFout } from '@shared/fouten';
import { backupBestandSchema } from '@shared/schemas';
import type { BackupItem } from '@shared/types';
import { haalInstelling, wijzigInstelling } from '../db/repo/instellingen';
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
  ruimOp(opties.backupMap ?? paden.backupMap);
  return bestand;
}

// ---------- OFM-022: opruimen, lijst en dagelijkse back-up (§14.2, §14.1 stap 4, FE-100/101) ----------

export const BACKUPS_HOUDEN = 30;

/** Het tijdstip-deel uit de naam: `offerte-maker-YYYY-MM-DD-HHmmss-…` → `YYYY-MM-DD-HHmmss`. */
function tijdsleutel(bestand: string): string {
  return bestand.slice('offerte-maker-'.length, 'offerte-maker-YYYY-MM-DD-HHmmss'.length);
}

/** Alleen onze back-ups (regex V-19), nieuwste eerst; andere bestanden in de map tellen niet mee. */
function backupNamen(map: string): string[] {
  let namen: string[];
  try {
    namen = readdirSync(map);
  } catch {
    return [];
  }
  return namen
    .filter((n) => backupBestandSchema.safeParse(n).success)
    .sort((a, b) => tijdsleutel(b).localeCompare(tijdsleutel(a)) || b.localeCompare(a));
}

/** Houdt de nieuwste `houden` back-ups (op het tijdstip in de naam) en verwijdert de rest. */
export function ruimOp(map: string = paden.backupMap, houden: number = BACKUPS_HOUDEN): string[] {
  const weg = backupNamen(map).slice(houden);
  for (const bestand of weg) verwijderKopie(join(map, bestand));
  if (weg.length > 0) log.info(`back-ups opgeruimd: ${weg.length}`);
  return weg;
}

/** `YYYY-MM-DD-HHmmss` → `YYYY-MM-DDTHH:mm:ss` (lokale tijd, zonder zone). */
export function tijdstipVan(bestand: string): string {
  const s = tijdsleutel(bestand);
  return `${s.slice(0, 10)}T${s.slice(11, 13)}:${s.slice(13, 15)}:${s.slice(15, 17)}`;
}

/** `backup:lijst`: nieuwste eerst, met tijdstip uit de naam en grootte in bytes. */
export function lijstBackups(map: string = paden.backupMap): BackupItem[] {
  return backupNamen(map).map((bestand) => ({
    bestand,
    tijdstip: tijdstipVan(bestand),
    grootteBytes: statSync(join(map, bestand)).size,
  }));
}

/**
 * §14.1 stap 4: dagelijkse back-up als `app.laatsteBackupDatum` niet `vandaag` is. De datum wordt alleen
 * bij succes gezet (V-19); een mislukte poging stopt de opstart niet en wordt bij de volgende start herhaald.
 */
export async function dagelijkseBackup(vandaag: string, opties: BackupOpties = {}): Promise<string | null> {
  if (haalInstelling('app').laatsteBackupDatum === vandaag) return null;
  try {
    const bestand = await maakBackup('dagelijks', opties);
    wijzigInstelling('app', { laatsteBackupDatum: vandaag });
    return bestand;
  } catch {
    log.warn('dagelijkse back-up mislukt; volgende start opnieuw');
    return null;
  }
}
