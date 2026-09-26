import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backupBestandSchema } from '@shared/schemas';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

const nepLog = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: nepLog }));

const { backupBestandsnaam, isIntact, maakBackup } = await import('./backup');
const { openDatabase } = await import('../db/verbinding');

let t: TestDatabase;
let backupMap: string;
beforeEach(async () => {
  t = await maakTestDatabase();
  backupMap = join(t.map, 'Back-ups');
  mkdirSync(backupMap);
});
afterEach(() => t.opruimen());

describe('backupBestandsnaam', () => {
  it('lokale tijd, past op de regex uit V-19', () => {
    const naam = backupBestandsnaam('handmatig', new Date(2026, 8, 5, 7, 3, 9));
    expect(naam).toBe('offerte-maker-2026-09-05-070309-handmatig.sqlite');
    for (const reden of ['dagelijks', 'handmatig', 'voor-migratie', 'voor-herstel'] as const) {
      expect(backupBestandSchema.safeParse(backupBestandsnaam(reden, new Date())).success).toBe(true);
    }
  });
});

describe('maakBackup (§14.2, NFE-012)', () => {
  it('maakt een integere kopie met alle data', async () => {
    t.db.prepare("INSERT INTO instellingen (sleutel, waarde_json) VALUES ('app', '{}')").run();
    const bestand = await maakBackup('handmatig', {
      db: t.db,
      backupMap,
      nu: new Date(2026, 8, 25, 21, 0, 0),
    });
    expect(bestand).toBe('offerte-maker-2026-09-25-210000-handmatig.sqlite');
    const pad = join(backupMap, bestand);
    expect(isIntact(pad)).toBe(true);
    const kopie = openDatabase(pad);
    expect(kopie.prepare('SELECT COUNT(*) AS n FROM instellingen').get()).toEqual({ n: 1 });
    expect(kopie.prepare('SELECT COUNT(*) AS n FROM prijsposten').get()).toEqual(
      t.db.prepare('SELECT COUNT(*) AS n FROM prijsposten').get(),
    );
    kopie.close();
  });

  it('gebruikt standaard de huidige database', async () => {
    const bestand = await maakBackup('dagelijks', { backupMap });
    expect(readdirSync(backupMap)).toEqual([bestand]);
  });

  it('mislukte back-up: geen kopie, BACKUP_MISLUKT, fout gelogd', async () => {
    await expect(
      maakBackup('handmatig', { db: t.db, backupMap: join(t.map, 'bestaat', 'niet') }),
    ).rejects.toMatchObject({ code: 'BACKUP_MISLUKT' });
    expect(nepLog.error).toHaveBeenCalled();
  });

  it('kopie die integrity_check niet haalt wordt verwijderd', async () => {
    const nu = new Date(2026, 8, 25, 22, 0, 0);
    const pad = join(backupMap, backupBestandsnaam('handmatig', nu));
    const nep = {
      backup: (doel: string) => {
        writeFileSync(doel, 'dit is geen database');
        return Promise.resolve();
      },
    };
    await expect(maakBackup('handmatig', { db: nep as never, backupMap, nu })).rejects.toMatchObject({
      code: 'BACKUP_MISLUKT',
    });
    expect(existsSync(pad)).toBe(false);
  });

  it('isIntact is false voor een ontbrekend bestand', () => {
    expect(isIntact(join(backupMap, 'bestaat-niet.sqlite'))).toBe(false);
  });
});
