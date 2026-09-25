import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRIJS_STARTSET } from '@shared/prijsStartset';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { laadMigraties, migreer } = await import('./migraties');
const { maakBackup } = await import('../backup/backup');
const { database, openDatabase, sluitDatabase, gebruikDatabase } = await import('./verbinding');

let t: TestDatabase | undefined;
afterEach(() => {
  t?.opruimen();
  t = undefined;
});

function tabellen(db: TestDatabase['db']): string[] {
  return (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[]
  ).map((r) => r.name);
}

describe('verbinding', () => {
  it('zet WAL, foreign keys en busy_timeout', async () => {
    t = await maakTestDatabase({ migreren: false });
    expect(t.db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(t.db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(t.db.pragma('busy_timeout', { simple: true })).toBe(5000);
    expect(database()).toBe(t.db);
  });

  it('database() gooit als er niets open is', () => {
    gebruikDatabase(null);
    expect(() => database()).toThrow();
    sluitDatabase();
  });
});

describe('001_basis.sql', () => {
  it('bevat geen INSERTs (V-13)', () => {
    const sql = readFileSync(join(import.meta.dirname, 'migraties', '001_basis.sql'), 'utf8');
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
  });
});

describe('migreer', () => {
  it('lege database: schema, startset, user_version 1, géén back-up (V-12)', async () => {
    t = await maakTestDatabase({ migreren: false });
    const backup = vi.fn(() => Promise.resolve());
    const uitkomst = await migreer(t.db, { backup });
    expect(uitkomst).toEqual({ van: 0, naar: 1, backupGemaakt: false });
    expect(backup).not.toHaveBeenCalled();
    expect(t.db.pragma('user_version', { simple: true })).toBe(1);
    expect(tabellen(t.db)).toEqual(
      expect.arrayContaining([
        'offertes',
        'offerte_versies',
        'pdf_bestanden',
        'instellingen',
        'bestanden',
        'prijsposten',
        'voorbeelden',
        'privacylog',
        'idx_offertes_datum',
        'idx_offertes_zoek',
        'idx_een_template',
        'idx_privacylog_tijd',
      ]),
    );
  });

  it('startset gelijk aan shared/prijsStartset.ts (FE-074, V-13)', async () => {
    t = await maakTestDatabase();
    const rijen = t.db.prepare('SELECT * FROM prijsposten ORDER BY volgorde').all();
    expect(rijen).toEqual(
      PRIJS_STARTSET.map((p, i) => ({
        id: `start-${p.sleutel}`,
        sleutel: p.sleutel,
        omschrijving: p.omschrijving,
        eenheid: p.eenheid,
        prijs_cent: null,
        btw_tarief: p.btwTarief,
        volgorde: (i + 1) * 10,
      })),
    );
    expect(rijen).toHaveLength(22);
  });

  it('niets te doen: geen back-up, versie blijft', async () => {
    t = await maakTestDatabase();
    const backup = vi.fn(() => Promise.resolve());
    expect(await migreer(t.db, { backup })).toEqual({ van: 1, naar: 1, backupGemaakt: false });
    expect(backup).not.toHaveBeenCalled();
  });

  it('database met data + migratie 002: data blijft, versie 2, back-up voor-migratie', async () => {
    t = await maakTestDatabase();
    t.db.prepare("INSERT INTO instellingen (sleutel, waarde_json) VALUES ('opmaak', '{}')").run();
    const backupMap = join(t.map, 'Back-ups');
    mkdirSync(backupMap);
    const migraties = laadMigraties({
      './migraties/001_basis.sql': 'SELECT 1;',
      './migraties/002_test.sql': 'ALTER TABLE offertes ADD COLUMN test_kolom TEXT;',
    });
    const uitkomst = await migreer(t.db, {
      migraties,
      backup: (reden) => maakBackup(reden, { db: t!.db, backupMap }),
    });
    expect(uitkomst).toEqual({ van: 1, naar: 2, backupGemaakt: true });
    expect(t.db.pragma('user_version', { simple: true })).toBe(2);
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM instellingen').get()).toEqual({ n: 1 });
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM prijsposten').get()).toEqual({ n: 22 });
    const bestanden = readdirSync(backupMap);
    expect(bestanden).toHaveLength(1);
    expect(bestanden[0]).toMatch(/-voor-migratie\.sqlite$/);
  });

  it('een mislukte migratie wordt teruggedraaid', async () => {
    t = await maakTestDatabase();
    const migraties = laadMigraties({
      './migraties/002_kapot.sql': 'CREATE TABLE tijdelijk (a TEXT); DIT IS GEEN SQL;',
    });
    await expect(migreer(t.db, { migraties, backup: () => Promise.resolve() })).rejects.toThrow();
    expect(t.db.pragma('user_version', { simple: true })).toBe(1);
    expect(tabellen(t.db)).not.toContain('tijdelijk');
  });

  it('weigert een ongeldige migratienaam', () => {
    expect(() => laadMigraties({ './migraties/basis.sql': '' })).toThrow('Ongeldige migratienaam');
  });

  it('opent een bestaande database opnieuw met behoud van data', async () => {
    t = await maakTestDatabase();
    t.db.close();
    const opnieuw = openDatabase(t.pad);
    expect(opnieuw.pragma('user_version', { simple: true })).toBe(1);
    opnieuw.close();
    expect(existsSync(t.pad)).toBe(true);
  });
});
