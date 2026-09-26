import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFout } from '@shared/fouten';
import { PRIJS_STARTSET } from '@shared/prijsStartset';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

// OFM-022: opruimen, lijst, dagelijkse back-up (FE-100) en terugzetten (FE-101, V-19).

const nepLog = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
const nepPaden = vi.hoisted(() => ({ backupMap: '', database: '' }));
vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\nergens', isPackaged: false, relaunch: vi.fn(), exit: vi.fn() },
}));
vi.mock('../log', () => ({ log: nepLog }));
vi.mock('../paden', () => ({ paden: nepPaden }));

const { dagelijkseBackup, isIntact, lijstBackups, maakBackup, ruimOp, tijdstipVan } =
  await import('./backup');
const { zetTerug } = await import('./herstel');
const { haalInstelling } = await import('../db/repo/instellingen');
const { database } = await import('../db/verbinding');
const { SCHEMA_VERSIE, migreer } = await import('../db/migraties');
const { openDatabase } = await import('../db/verbinding');

let t: TestDatabase;
let map: string;
beforeEach(async () => {
  t = await maakTestDatabase();
  map = join(t.map, 'Back-ups');
  mkdirSync(map);
  nepPaden.backupMap = map;
  nepPaden.database = t.pad;
  vi.clearAllMocks();
});
afterEach(() => t.opruimen());

/** Maakt migratie 007 (OFM-049) ongedaan: de kolom `standaardkeuze` en zijn index weg. */
/** Vóór OFM-047 (migratie 008): zonder `invoer_gewijzigd`; de versietabel mag blijven, 008 bouwt hem opnieuw. */
function zonderInvoerGewijzigd(db: Database.Database): void {
  db.exec('ALTER TABLE offertes DROP COLUMN invoer_gewijzigd');
}

function zonderStandaardkeuze(db: Database.Database): void {
  zonderInvoerGewijzigd(db);
  db.exec(`
    DROP INDEX idx_keuzeopties_standaardkeuze;
    ALTER TABLE keuzeopties DROP COLUMN standaardkeuze;
  `);
}

/**
 * Maakt van een kopie van de huidige database een database van vóór OFM-043 (zonder migratie 004), met
 * de volledige prijslijst-startset van toen (die migratie 006 van OFM-048 grotendeels opruimt).
 */
function maakVersie2(db: Database.Database): void {
  zonderStandaardkeuze(db);
  db.exec(`
    DROP TABLE werkzaamheid_materiaal;
    DROP TABLE werkzaamheid_soortwerk;
    DROP TABLE werkzaamheid_opties;
    DROP TABLE materialen;
    DROP TABLE werkzaamheden;
    DELETE FROM prijsposten WHERE sleutel LIKE '%:%';
  `);
  const invoegen = db.prepare(
    'INSERT OR IGNORE INTO prijsposten (id, sleutel, omschrijving, eenheid, prijs_cent, btw_tarief, volgorde) VALUES (?, ?, ?, ?, NULL, ?, ?)',
  );
  PRIJS_STARTSET.forEach((p, i) =>
    invoegen.run(`start-${p.sleutel}`, p.sleutel, p.omschrijving, p.eenheid, p.btwTarief, (i + 1) * 10),
  );
}

function nepBackup(dag: number, reden = 'dagelijks'): string {
  const naam = `offerte-maker-2026-08-${String(dag).padStart(2, '0')}-120000-${reden}.sqlite`;
  writeFileSync(join(map, naam), 'x');
  return naam;
}

function backups(): string[] {
  return readdirSync(map).filter((n) => n.startsWith('offerte-maker-'));
}

function voegOfferteToe(db: Database.Database, id: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO offertes (id, offertedatum, geldig_tot, klant_json, invoer_json, aangemaakt_op, bijgewerkt_op)
     VALUES (?, '2026-09-25', '2026-10-25', '{}', '{}', 'x', 'x')`,
  ).run(id);
}

function aantalOffertes(pad: string): number {
  const db = new Database(pad, { readonly: true });
  try {
    return (db.prepare('SELECT COUNT(*) AS n FROM offertes').get() as { n: number }).n;
  } finally {
    db.close();
  }
}

describe('opruimen en lijst (§14.2)', () => {
  it('houdt de nieuwste 30 op tijdstip in de naam en laat andere bestanden staan', () => {
    for (let dag = 1; dag <= 31; dag++) nepBackup(dag, dag % 2 ? 'dagelijks' : 'handmatig');
    writeFileSync(join(map, 'notities.txt'), 'blijft');
    writeFileSync(join(map, 'offerte-maker-oud.sqlite'), 'past niet op de regex');
    const weg = ruimOp(map);
    expect(weg).toEqual(['offerte-maker-2026-08-01-120000-dagelijks.sqlite']);
    expect(backups()).toHaveLength(31); // 30 echte + het bestand dat niet op de regex past
    expect(existsSync(join(map, 'notities.txt'))).toBe(true);
  });

  it('lijst: nieuwste eerst, met tijdstip en grootte', () => {
    nepBackup(2);
    nepBackup(10, 'voor-herstel');
    writeFileSync(join(map, 'iets-anders.sqlite'), 'x');
    expect(lijstBackups(map)).toEqual([
      {
        bestand: 'offerte-maker-2026-08-10-120000-voor-herstel.sqlite',
        tijdstip: '2026-08-10T12:00:00',
        grootteBytes: 1,
      },
      {
        bestand: 'offerte-maker-2026-08-02-120000-dagelijks.sqlite',
        tijdstip: '2026-08-02T12:00:00',
        grootteBytes: 1,
      },
    ]);
    expect(tijdstipVan('offerte-maker-2026-09-05-070309-handmatig.sqlite')).toBe('2026-09-05T07:03:09');
    expect(lijstBackups(join(map, 'bestaat-niet'))).toEqual([]);
  });

  it('maakBackup ruimt daarna op naar 30 (NFE-012: de nieuwe is intact)', async () => {
    for (let dag = 1; dag <= 30; dag++) nepBackup(dag);
    const bestand = await maakBackup('handmatig', { db: t.db, backupMap: map });
    expect(backups()).toHaveLength(30);
    expect(backups()).toContain(bestand);
    expect(backups()).not.toContain('offerte-maker-2026-08-01-120000-dagelijks.sqlite');
    expect(isIntact(join(map, bestand))).toBe(true);
  });
});

describe('dagelijkseBackup (§14.1 stap 4, FE-100, V-19)', () => {
  it('twee keer starten op één dag geeft één dagelijkse back-up', async () => {
    expect(await dagelijkseBackup('2026-09-25', { backupMap: map })).not.toBeNull();
    expect(await dagelijkseBackup('2026-09-25', { backupMap: map })).toBeNull();
    expect(backups().filter((n) => n.endsWith('-dagelijks.sqlite'))).toHaveLength(1);
    expect(haalInstelling('app').laatsteBackupDatum).toBe('2026-09-25');
  });

  it('31 back-ups en een nieuwe dag → 30 over', async () => {
    for (let dag = 1; dag <= 31; dag++) nepBackup(dag);
    await dagelijkseBackup('2026-09-26', { backupMap: map });
    expect(backups()).toHaveLength(30);
    for (const n of backups()) expect(n >= 'offerte-maker-2026-08-03').toBe(true);
  });

  it('mislukt → datum niet gezet, volgende start opnieuw', async () => {
    const uit = await dagelijkseBackup('2026-09-25', { backupMap: join(map, 'bestaat', 'niet') });
    expect(uit).toBeNull();
    expect(haalInstelling('app').laatsteBackupDatum).toBeNull();
    expect(nepLog.error).toHaveBeenCalled();
    // Logregels bevatten geen klantgegevens: alleen reden en bestandsnaam.
    expect(await dagelijkseBackup('2026-09-25', { backupMap: map })).not.toBeNull();
  });
});

describe('zetTerug (§14.2, V-19, FE-101)', () => {
  it('2 offertes terugzetten over 3: na herstel 2, en een voor-herstel-back-up met 3', async () => {
    voegOfferteToe(t.db, 'a');
    voegOfferteToe(t.db, 'b');
    const bestand = await maakBackup('handmatig', {
      db: t.db,
      backupMap: map,
      nu: new Date(2026, 8, 1, 9, 0, 0),
    });
    voegOfferteToe(t.db, 'c');

    const herstart = vi.fn();
    await zetTerug(bestand, { herstart });

    expect(herstart).toHaveBeenCalledOnce();
    expect(() => database()).toThrow(); // gesloten vóór het vervangen
    expect(aantalOffertes(t.pad)).toBe(2);
    expect(existsSync(`${t.pad}-wal`)).toBe(false);
    expect(existsSync(`${t.pad}.herstel`)).toBe(false);
    const voorHerstel = backups().find((n) => n.endsWith('-voor-herstel.sqlite'));
    expect(voorHerstel).toBeDefined();
    expect(aantalOffertes(join(map, voorHerstel ?? ''))).toBe(3);
    expect(isIntact(join(map, voorHerstel ?? ''))).toBe(true);
  });

  it('OFM-034: back-up met schemaversie 1 wordt teruggezet; bij de herstart draait migratie 002 opnieuw', async () => {
    const bestand = await maakBackup('handmatig', {
      db: t.db,
      backupMap: map,
      nu: new Date(2026, 8, 1, 9, 0, 0),
    });
    // Maak er een back-up van vóór OFM-034 van: zonder keuzeopties, garantie als getal, versie 1.
    const kopie = new Database(join(map, bestand));
    maakVersie2(kopie);
    kopie.exec('DROP TABLE keuzeopties');
    kopie
      .prepare(
        `INSERT INTO offertes (id, offertedatum, geldig_tot, klant_json, invoer_json, aangemaakt_op, bijgewerkt_op)
         VALUES ('oud', '2026-09-01', '2026-10-01', '{}', '{"garantieJaren":20,"isolatie":"geen"}', 'x', 'x')`,
      )
      .run();
    kopie.pragma('user_version = 1');
    kopie.close();

    await zetTerug(bestand, { herstart: vi.fn() });
    const db = openDatabase(t.pad);
    try {
      expect(await migreer(db, { backup: () => Promise.resolve() })).toMatchObject({
        van: 1,
        naar: SCHEMA_VERSIE,
      });
      const invoer = db.prepare("SELECT invoer_json FROM offertes WHERE id = 'oud'").get() as {
        invoer_json: string;
      };
      // Migratie 005 (OFM-045) heeft de oude velden omgezet: isolatie "geen" geeft geen werkzaamheid.
      expect(JSON.parse(invoer.invoer_json)).toEqual({ garantieJaren: '20', werkzaamheden: [] });
      expect(db.prepare('SELECT COUNT(*) AS n FROM keuzeopties').get()).toEqual({ n: 21 });
    } finally {
      db.close();
    }
  });

  it('OFM-043/045/048: back-up met schemaversie 2 wordt teruggezet; bij de herstart draaien 004 t/m 006 opnieuw', async () => {
    const bestand = await maakBackup('handmatig', {
      db: t.db,
      backupMap: map,
      nu: new Date(2026, 8, 2, 9, 0, 0),
    });
    const kopie = new Database(join(map, bestand));
    maakVersie2(kopie);
    // Een oude offerte (vóór OFM-044) met isolatie en een regel met een eigen prijs.
    kopie
      .prepare(
        "INSERT INTO keuzeopties (id, lijst, sleutel, label, volgorde) VALUES ('iso-80', 'isolatie', '80', '80 mm (Rc 3,5)', 20)",
      )
      .run();
    const regel = {
      id: 'r1',
      omschrijving: 'Isolatie PIR 80 mm (Rc 3,5)',
      aantalHonderdsten: 2000,
      eenheid: 'm²',
      prijsCent: 3100,
      btwTarief: 21,
      prijsbron: 'handmatig',
      prijspostId: 'start-isolatie_80',
    };
    kopie
      .prepare(
        `INSERT INTO offertes (id, offertedatum, geldig_tot, klant_json, invoer_json, inhoud_json, aangemaakt_op, bijgewerkt_op)
         VALUES ('oud', '2026-09-01', '2026-10-01', '{}', ?, ?, 'x', 'x')`,
      )
      .run(
        JSON.stringify({
          garantieJaren: '10',
          dakvlakken: [{ id: 'v', naam: 'Dak', modus: 'm2', lengteM: null, breedteM: null, m2: 20 }],
          isolatie: '80',
          isolatieAndersMm: null,
        }),
        JSON.stringify({ regels: [regel] }),
      );
    kopie.pragma('user_version = 2');
    kopie.close();

    await zetTerug(bestand, { herstart: vi.fn() });
    const db = openDatabase(t.pad);
    try {
      expect(await migreer(db, { backup: () => Promise.resolve() })).toMatchObject({
        van: 2,
        naar: SCHEMA_VERSIE,
      });
      expect(db.prepare('SELECT COUNT(*) AS n FROM werkzaamheden').get()).toEqual({ n: 8 });
      // OFM-048: de oude post isolatie_80 staat in een regel en wordt een materiaal (zelfde id en prijs);
      // de ongebruikte oude posten zonder prijs verdwijnen, de vaste posten blijven.
      expect(db.prepare('SELECT COUNT(*) AS n FROM materialen').get()).toEqual({ n: 10 });
      expect(db.prepare("SELECT sleutel FROM prijsposten WHERE id = 'start-isolatie_80'").get()).toEqual({
        sleutel: 'mat:isolatie_80',
      });
      expect(
        db
          .prepare("SELECT sleutel FROM prijsposten WHERE sleutel NOT LIKE '%:%' ORDER BY volgorde")
          .all()
          .map((r) => (r as { sleutel: string }).sleutel),
      ).toEqual(['steiger', 'voorrijkosten', 'verzekerde_garantie']);
      // Per werkzaamheid een prijs per eenheid en een prijs per uur.
      expect(db.prepare("SELECT COUNT(*) AS n FROM prijsposten WHERE sleutel LIKE 'werk:%'").get()).toEqual({
        n: 16,
      });
      const { invoer_json } = db.prepare("SELECT invoer_json FROM offertes WHERE id = 'oud'").get() as {
        invoer_json: string;
      };
      const invoer = JSON.parse(invoer_json) as Record<string, unknown>;
      expect(invoer).not.toHaveProperty('isolatie');
      expect(invoer['werkzaamheden']).toMatchObject([
        {
          sleutel: 'isoleren',
          aantal: 20,
          prijsCent: 0,
          materialen: [
            { eenmalig: { label: 'Dampremmende laag' }, aantal: 20, prijsCent: null },
            { eenmalig: { label: 'Isolatie PIR 80 mm (Rc 3,5)' }, aantal: 20, prijsCent: 3100 },
          ],
        },
      ]);
      expect(db.prepare("SELECT COUNT(*) AS n FROM keuzeopties WHERE lijst = 'isolatie'").get()).toEqual({
        n: 0,
      });
    } finally {
      db.close();
    }
  });

  it('OFM-049: back-up met schemaversie 6 wordt teruggezet; bij de herstart draait 007 opnieuw', async () => {
    const bestand = await maakBackup('handmatig', {
      db: t.db,
      backupMap: map,
      nu: new Date(2026, 8, 3, 9, 0, 0),
    });
    const kopie = new Database(join(map, bestand));
    zonderStandaardkeuze(kopie);
    kopie.pragma('user_version = 6');
    kopie.close();

    await zetTerug(bestand, { herstart: vi.fn() });
    const db = openDatabase(t.pad);
    try {
      expect(await migreer(db, { backup: () => Promise.resolve() })).toMatchObject({
        van: 6,
        naar: SCHEMA_VERSIE,
      });
      expect(
        db.prepare('SELECT lijst, sleutel FROM keuzeopties WHERE standaardkeuze = 1 ORDER BY lijst').all(),
      ).toEqual([
        { lijst: 'garantie', sleutel: '10' },
        { lijst: 'hoogte', sleutel: '1' },
      ]);
    } finally {
      db.close();
    }
  });

  it('de gekozen back-up mag de oudste van 30 zijn (opruimen raakt hem niet vóór het kopiëren)', async () => {
    voegOfferteToe(t.db, 'a');
    const bestand = await maakBackup('handmatig', {
      db: t.db,
      backupMap: map,
      nu: new Date(2026, 0, 1, 0, 0, 0),
    });
    for (let dag = 1; dag <= 29; dag++) nepBackup(dag);
    voegOfferteToe(t.db, 'b');
    await zetTerug(bestand, { herstart: vi.fn() });
    expect(aantalOffertes(t.pad)).toBe(1);
  });

  async function verwachtGeweigerd(bestand: string, code: string, melding?: string): Promise<void> {
    voegOfferteToe(t.db, 'z');
    const herstart = vi.fn();
    const voor = backups();
    try {
      await zetTerug(bestand, { herstart });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppFout);
      expect((e as AppFout).code).toBe(code);
      if (melding) expect((e as AppFout).melding).toBe(melding);
    }
    expect(herstart).not.toHaveBeenCalled();
    expect(backups()).toEqual(voor); // geen voor-herstel-back-up
    expect(database().prepare('SELECT COUNT(*) AS n FROM offertes').get()).toEqual({ n: 1 });
  }

  it('weigert een naam die niet op de regex past (ook padtraversal)', async () => {
    await verwachtGeweigerd('..\\offerte-maker.sqlite', 'VALIDATIE');
    await verwachtGeweigerd('offerte-maker-2026-08-01-120000-dagelijks.sqlite\\..\\x', 'VALIDATIE');
  });

  it('weigert een bestand dat niet in backupMap staat', async () => {
    await verwachtGeweigerd(
      'offerte-maker-2026-08-01-120000-dagelijks.sqlite',
      'HERSTEL_MISLUKT',
      'Terugzetten is niet gelukt. Er is niets veranderd.',
    );
  });

  it('weigert een back-up die de integrity_check niet haalt', async () => {
    const naam = nepBackup(5); // geen SQLite-bestand
    await verwachtGeweigerd(naam, 'HERSTEL_MISLUKT');
  });

  it('weigert een back-up van een nieuwere schemaversie', async () => {
    const bestand = await maakBackup('handmatig', {
      db: t.db,
      backupMap: map,
      nu: new Date(2026, 8, 1, 9, 0, 0),
    });
    const kopie = new Database(join(map, bestand));
    kopie.pragma(`user_version = ${SCHEMA_VERSIE + 1}`);
    kopie.close();
    await verwachtGeweigerd(
      bestand,
      'VALIDATIE',
      'Deze back-up komt van een nieuwere versie van de app en kan niet worden teruggezet.',
    );
  });
});
