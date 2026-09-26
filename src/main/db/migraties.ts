/// <reference types="vite/client" />
import { KEUZE_LIJSTEN, KEUZE_STARTSET } from '@shared/keuzelijsten';
import { PRIJS_STARTSET } from '@shared/prijsStartset';
import { maakBackup, type BackupReden } from '../backup/backup';
import { log } from '../log';
import type { Db } from './verbinding';

// Migraties (TDO §4.1, V-12, V-13). Bestanden `migraties/NNN_naam.sql`, meegebundeld door vite.

export interface Migratie {
  nr: number;
  naam: string;
  sql: string;
}

/** Zet `{ './migraties/001_basis.sql': sql }` om in een gesorteerde lijst migraties. */
export function laadMigraties(bestanden: Record<string, string>): Migratie[] {
  return Object.entries(bestanden)
    .map(([pad, sql]) => {
      const naam = pad.split('/').pop() ?? pad;
      const treffer = /^(\d{3})_[\w-]+\.sql$/.exec(naam);
      if (!treffer?.[1]) throw new Error(`Ongeldige migratienaam: ${naam}`);
      return { nr: Number(treffer[1]), naam, sql };
    })
    .sort((a, b) => a.nr - b.nr);
}

const standaardMigraties = laadMigraties(
  import.meta.glob<string>('./migraties/*.sql', { query: '?raw', import: 'default', eager: true }),
);

/** Hoogste schemaversie die deze app kent (OFM-022: nieuwere back-ups weigeren, V-19). */
export const SCHEMA_VERSIE = standaardMigraties.at(-1)?.nr ?? 0;

export function voegStartsetIn(db: Db): void {
  const invoegen = db.prepare(
    'INSERT INTO prijsposten (id, sleutel, omschrijving, eenheid, prijs_cent, btw_tarief, volgorde) VALUES (?, ?, ?, ?, NULL, ?, ?)',
  );
  PRIJS_STARTSET.forEach((post, index) => {
    invoegen.run(
      `start-${post.sleutel}`,
      post.sleutel,
      post.omschrijving,
      post.eenheid,
      post.btwTarief,
      (index + 1) * 10,
    );
  });
}

/** Startset van de keuzelijsten (OFM-034), direct na migratie 002; `volgorde` = (index + 1) × 10. */
export function voegKeuzeStartsetIn(db: Db): void {
  const invoegen = db.prepare(
    'INSERT INTO keuzeopties (id, lijst, sleutel, label, volgorde, verborgen, standaard) VALUES (?, ?, ?, ?, ?, 0, 1)',
  );
  for (const lijst of KEUZE_LIJSTEN) {
    KEUZE_STARTSET[lijst].forEach((optie, index) => {
      invoegen.run(`start-${lijst}-${optie.sleutel}`, lijst, optie.sleutel, optie.label, (index + 1) * 10);
    });
  }
}

/** Startsets per migratie (V-13): de SQL-bestanden zelf bevatten geen INSERTs. */
const NA_MIGRATIE: Record<string, (db: Db) => void> = {
  '001_basis.sql': voegStartsetIn,
  '002_keuzelijsten.sql': voegKeuzeStartsetIn,
};

function isLeeg(db: Db): boolean {
  const rij = db
    .prepare("SELECT COUNT(*) AS aantal FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .get() as { aantal: number };
  return rij.aantal === 0;
}

export interface MigreerOpties {
  migraties?: Migratie[];
  backup?: (reden: BackupReden) => Promise<unknown>;
}

export interface MigreerUitkomst {
  van: number;
  naar: number;
  backupGemaakt: boolean;
}

/**
 * Past alle ontbrekende migraties toe, elk in een eigen transactie, en zet `user_version`.
 * Vooraf een back-up `voor-migratie`, behalve bij een net aangemaakte, lege database (V-12).
 */
export async function migreer(db: Db, opties: MigreerOpties = {}): Promise<MigreerUitkomst> {
  const migraties = opties.migraties ?? standaardMigraties;
  const backup = opties.backup ?? ((reden: BackupReden) => maakBackup(reden, { db }));

  const van = db.pragma('user_version', { simple: true }) as number;
  const open = migraties.filter((m) => m.nr > van);
  if (open.length === 0) return { van, naar: van, backupGemaakt: false };

  const nieuw = van === 0 && isLeeg(db);
  if (!nieuw) await backup('voor-migratie');

  for (const migratie of open) {
    db.transaction(() => {
      db.exec(migratie.sql);
      NA_MIGRATIE[migratie.naam]?.(db);
      db.pragma(`user_version = ${migratie.nr}`);
    })();
    log.info(`migratie ${migratie.naam} toegepast`);
  }

  const naar = open[open.length - 1]?.nr ?? van;
  return { van, naar, backupGemaakt: !nieuw };
}
