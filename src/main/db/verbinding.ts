import Database from 'better-sqlite3';
import { paden } from '../paden';

// Eén SQLite-verbinding in main (TDO §4). Repositories halen hem op met `database()`.

export type Db = Database.Database;

export function openDatabase(pad: string): Db {
  const db = new Database(pad);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

let huidige: Db | null = null;

/** §14.1 stap 3: de database van de app openen (`paden.database`). */
export function openAppDatabase(): Db {
  huidige = openDatabase(paden.database);
  return huidige;
}

/** De open verbinding; gooit als de database nog niet open is. */
export function database(): Db {
  if (!huidige) throw new Error('De database is nog niet geopend.');
  return huidige;
}

/** Alleen voor tests: een eigen (tijdelijke) database als de huidige gebruiken. */
export function gebruikDatabase(db: Db | null): void {
  huidige = db;
}

export function sluitDatabase(): void {
  if (huidige?.open) huidige.close();
  huidige = null;
}
