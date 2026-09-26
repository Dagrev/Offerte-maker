import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEUZE_LIJSTEN, KEUZE_STARTSET, STANDAARDKEUZE_STARTSET } from '@shared/keuzelijsten';
import { PRIJS_STARTSET, VASTE_POSTEN } from '@shared/prijsStartset';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { SCHEMA_VERSIE, laadMigraties, migreer } = await import('./migraties');
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

describe('migratiebestanden', () => {
  it.each([
    '001_basis.sql',
    '002_keuzelijsten.sql',
    '003_naam.sql',
    '004_werkzaamheden.sql',
    '007_standaardkeuze.sql',
  ])('%s bevat geen INSERTs (V-13)', (naam) => {
    const sql = readFileSync(join(import.meta.dirname, 'migraties', naam), 'utf8');
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
  });
});

describe('migreer', () => {
  it('lege database: schema, startsets, hoogste user_version, géén back-up (V-12)', async () => {
    t = await maakTestDatabase({ migreren: false });
    const backup = vi.fn(() => Promise.resolve());
    const uitkomst = await migreer(t.db, { backup });
    expect(uitkomst).toEqual({ van: 0, naar: SCHEMA_VERSIE, backupGemaakt: false });
    expect(backup).not.toHaveBeenCalled();
    expect(t.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSIE);
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
        'keuzeopties',
        'idx_keuzeopties_lijst',
        'werkzaamheden',
        'werkzaamheid_soortwerk',
        'werkzaamheid_opties',
        'materialen',
        'werkzaamheid_materiaal',
        'idx_een_standaardmateriaal',
        'idx_keuzeopties_standaardkeuze',
      ]),
    );
  });

  it('startset gelijk aan shared/prijsStartset.ts (FE-074, V-13); na 006 alleen de vaste posten los', async () => {
    t = await maakTestDatabase();
    // Zonder de posten van werkzaamheden, opties en materialen (OFM-043, sleutel met `:`). Migratie 006
    // (OFM-048) ruimt de ongebruikte oude posten zonder prijs op; de vaste posten blijven met hun id.
    const rijen = t.db
      .prepare("SELECT * FROM prijsposten WHERE sleutel NOT LIKE '%:%' ORDER BY volgorde")
      .all();
    const vast = new Set<string>(VASTE_POSTEN);
    expect(rijen).toEqual(
      PRIJS_STARTSET.map((p, i) => ({
        id: `start-${p.sleutel}`,
        sleutel: p.sleutel,
        omschrijving: p.omschrijving,
        eenheid: p.eenheid,
        prijs_cent: null,
        btw_tarief: p.btwTarief,
        volgorde: (i + 1) * 10,
      })).filter((p) => vast.has(p.sleutel)),
    );
    expect(rijen).toHaveLength(3);
    expect(PRIJS_STARTSET).toHaveLength(22);
  });

  it('keuzelijsten-startset gelijk aan shared/keuzelijsten.ts (OFM-034)', async () => {
    t = await maakTestDatabase();
    const rijen = t.db
      .prepare(
        'SELECT id, lijst, sleutel, label, volgorde, verborgen, standaard, standaardkeuze FROM keuzeopties ORDER BY lijst, volgorde',
      )
      .all();
    const verwacht = KEUZE_LIJSTEN.flatMap((lijst) =>
      KEUZE_STARTSET[lijst].map((o, i) => ({
        id: `start-${lijst}-${o.sleutel}`,
        lijst,
        sleutel: o.sleutel,
        label: o.label,
        volgorde: (i + 1) * 10,
        verborgen: 0,
        standaard: 1,
        // OFM-049: migratie 007 zet de standaardkeuzes van de startset.
        standaardkeuze: STANDAARDKEUZE_STARTSET[lijst] === o.sleutel ? 1 : 0,
      })),
    ).sort((a, b) => (a.lijst < b.lijst ? -1 : a.lijst > b.lijst ? 1 : a.volgorde - b.volgorde));
    expect(rijen).toEqual(verwacht);
  });

  it('002 op een database van versie 1: back-up, garantie als sleutel, startset (OFM-034)', async () => {
    t = await maakTestDatabase({ migreren: false });
    const alle = laadMigraties(
      import.meta.glob<string>('./migraties/*.sql', { query: '?raw', import: 'default', eager: true }),
    );
    await migreer(t.db, { migraties: alle.filter((mig) => mig.nr === 1), backup: () => Promise.resolve() });
    const tot2 = alle.filter((mig) => mig.nr <= 2);
    const invoer = (garantie: unknown) => JSON.stringify({ garantieJaren: garantie, isolatie: 'geen' });
    const zet = t.db.prepare(
      `INSERT INTO offertes (id, offertedatum, geldig_tot, klant_json, invoer_json, aangemaakt_op, bijgewerkt_op)
       VALUES (?, '2026-09-01', '2026-10-01', '{}', ?, 'x', 'x')`,
    );
    zet.run('tien', invoer(10));
    zet.run('twintig', invoer(20));
    const backup = vi.fn(() => Promise.resolve());
    expect(await migreer(t.db, { migraties: tot2, backup })).toEqual({
      van: 1,
      naar: 2,
      backupGemaakt: true,
    });
    expect(backup).toHaveBeenCalledWith('voor-migratie');
    const garantie = (id: string) =>
      (
        JSON.parse(
          (t!.db.prepare('SELECT invoer_json FROM offertes WHERE id = ?').get(id) as { invoer_json: string })
            .invoer_json,
        ) as { garantieJaren: unknown }
      ).garantieJaren;
    expect(garantie('tien')).toBe('10');
    expect(garantie('twintig')).toBe('20');
    // 40 startopties; migratie 005 (OFM-045) haalt de 19 van bedekking, isolatie, extra's en afwerking weg.
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM keuzeopties').get()).toEqual({ n: 21 });
  });

  it('003: naam wordt achternaam, voornaam leeg, voor elke offerte (OFM-038)', async () => {
    t = await maakTestDatabase({ migreren: false });
    const alle = laadMigraties(
      import.meta.glob<string>('./migraties/*.sql', { query: '?raw', import: 'default', eager: true }),
    );
    await migreer(t.db, { migraties: alle.filter((mig) => mig.nr <= 2), backup: () => Promise.resolve() });
    const zet = t.db.prepare(
      `INSERT INTO offertes (id, status, offertedatum, geldig_tot, klant_json, invoer_json, aangemaakt_op, bijgewerkt_op)
       VALUES (?, ?, '2026-09-01', '2026-10-01', ?, '{}', 'x', 'x')`,
    );
    zet.run('concept', 'concept', JSON.stringify({ aanhef: 'dhr', naam: 'Piet Jansen', bedrijfsnaam: '' }));
    zet.run('klaar', 'klaar', JSON.stringify({ aanhef: 'fam', naam: 'de Vries', bedrijfsnaam: '' }));
    zet.run('al-nieuw', 'concept', JSON.stringify({ aanhef: 'dhr', voornaam: 'Jan', achternaam: 'Bos' }));
    zet.run('kapot', 'concept', 'geen json');
    await migreer(t.db, { migraties: alle.filter((mig) => mig.nr === 3), backup: () => Promise.resolve() });
    const klant = (id: string) =>
      (t!.db.prepare('SELECT klant_json FROM offertes WHERE id = ?').get(id) as { klant_json: string })
        .klant_json;
    expect(JSON.parse(klant('concept'))).toEqual({
      aanhef: 'dhr',
      voornaam: '',
      achternaam: 'Piet Jansen',
      bedrijfsnaam: '',
    });
    expect(JSON.parse(klant('klaar'))).toMatchObject({ voornaam: '', achternaam: 'de Vries' });
    expect(JSON.parse(klant('klaar'))).not.toHaveProperty('naam');
    expect(JSON.parse(klant('al-nieuw'))).toEqual({ aanhef: 'dhr', voornaam: 'Jan', achternaam: 'Bos' });
    expect(klant('kapot')).toBe('geen json');
  });

  it('008: versies blijven byte-gelijk, bron wizard mag, invoer_gewijzigd 0, cascade werkt (OFM-047)', async () => {
    t = await maakTestDatabase({ migreren: false });
    const alle = laadMigraties(
      import.meta.glob<string>('./migraties/*.sql', { query: '?raw', import: 'default', eager: true }),
    );
    await migreer(t.db, { migraties: alle.filter((mig) => mig.nr < 8), backup: () => Promise.resolve() });
    t.db
      .prepare(
        `INSERT INTO offertes (id, status, offertedatum, geldig_tot, klant_json, invoer_json, inhoud_json, aangemaakt_op, bijgewerkt_op)
         VALUES ('o', 'klaar', '2026-09-01', '2026-10-01', '{}', '{}', '{"titel":"x"}', 'x', 'x')`,
      )
      .run();
    const versie = t.db.prepare(
      'INSERT INTO offerte_versies (id, offerte_id, versie_nr, bron, inhoud_json, aangemaakt_op) VALUES (?, ?, ?, ?, ?, ?)',
    );
    versie.run('v1', 'o', 1, 'agent', '{"titel":"x"}', 't1');
    versie.run('v2', 'o', 2, 'handmatig', '{"titel":"y"}', 't2');
    expect(() => versie.run('v3', 'o', 3, 'wizard', '{}', 't3')).toThrow(/CHECK/);
    const voor = t.db.prepare('SELECT * FROM offerte_versies ORDER BY versie_nr').all();

    await migreer(t.db, { migraties: alle.filter((mig) => mig.nr === 8), backup: () => Promise.resolve() });
    expect(t.db.prepare('SELECT * FROM offerte_versies ORDER BY versie_nr').all()).toEqual(voor);
    versie.run('v3', 'o', 3, 'wizard', '{}', 't3');
    expect(() => versie.run('v4', 'o', 4, 'onbekend', '{}', 't4')).toThrow(/CHECK/);
    expect(() => versie.run('v5', 'o', 3, 'wizard', '{}', 't5')).toThrow(/UNIQUE/);
    expect(t.db.prepare("SELECT invoer_gewijzigd FROM offertes WHERE id = 'o'").get()).toEqual({
      invoer_gewijzigd: 0,
    });
    expect(t.db.pragma('foreign_key_check')).toEqual([]);
    t.db.prepare("DELETE FROM offertes WHERE id = 'o'").run();
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM offerte_versies').get()).toEqual({ n: 0 });
  });

  it('007: standaardkeuze = de oude vaste waarden (hoogte 1, garantie 10), eigen opties niet (OFM-049)', async () => {
    t = await maakTestDatabase({ migreren: false });
    const alle = laadMigraties(
      import.meta.glob<string>('./migraties/*.sql', { query: '?raw', import: 'default', eager: true }),
    );
    // Alles vóór 007 (ook een eventuele 006 van een ander ticket); daarna alleen 007.
    await migreer(t.db, { migraties: alle.filter((mig) => mig.nr < 7), backup: () => Promise.resolve() });
    t.db
      .prepare(
        "INSERT INTO keuzeopties (id, lijst, sleutel, label, volgorde) VALUES ('eigen', 'hoogte', 'kelder', 'Kelder', 99)",
      )
      .run();
    t.db.prepare("UPDATE keuzeopties SET label = 'Laagbouw' WHERE lijst = 'hoogte' AND sleutel = '1'").run();
    await migreer(t.db, { migraties: alle.filter((mig) => mig.nr === 7), backup: () => Promise.resolve() });
    const standaard = t.db
      .prepare('SELECT lijst, sleutel, label FROM keuzeopties WHERE standaardkeuze = 1 ORDER BY lijst')
      .all();
    expect(standaard).toEqual([
      { lijst: 'garantie', sleutel: '10', label: '10 jaar' },
      { lijst: 'hoogte', sleutel: '1', label: 'Laagbouw' },
    ]);
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM keuzeopties WHERE standaardkeuze = 0').get()).toEqual({
      n: 20,
    });
  });

  it('009: lijst nieuweBedekking, zinnen, vinkjes; koppelingen blijven; bedekking afgeleid (OFM-050)', async () => {
    t = await maakTestDatabase({ migreren: false });
    const alle = laadMigraties(
      import.meta.glob<string>('./migraties/*.sql', { query: '?raw', import: 'default', eager: true }),
    );
    await migreer(t.db, { migraties: alle.filter((mig) => mig.nr < 9), backup: () => Promise.resolve() });
    const koppelingen = t.db.prepare('SELECT COUNT(*) AS n FROM werkzaamheid_soortwerk').get() as {
      n: number;
    };
    expect(koppelingen.n).toBeGreaterThan(0);
    // Eigen soort werk met een koppeling, een hernoemde startoptie en drie oude offertes.
    t.db
      .prepare(
        "INSERT INTO keuzeopties (id, lijst, sleutel, label, volgorde) VALUES ('eigen', 'soortWerk', 'dakkapel', 'Dakkapel', 99)",
      )
      .run();
    t.db
      .prepare(
        "INSERT INTO werkzaamheid_soortwerk (werkzaamheid_id, soort_werk) VALUES ('start-werk-slopen', 'dakkapel')",
      )
      .run();
    t.db
      .prepare(
        "UPDATE keuzeopties SET label = 'Houten vloer' WHERE lijst = 'ondergrond' AND sleutel = 'hout'",
      )
      .run();
    const offerte = t.db.prepare(
      `INSERT INTO offertes (id, offertedatum, geldig_tot, klant_json, invoer_json, aangemaakt_op, bijgewerkt_op)
       VALUES (?, '2026-09-01', '2026-10-01', '{}', ?, 'x', 'x')`,
    );
    const werk = (sleutel: string, materialen: string[]) => ({
      sleutel,
      materialen: materialen.map((m) => ({ sleutel: m })),
    });
    offerte.run(
      'epdm',
      JSON.stringify({ werkzaamheden: [werk('isoleren', ['pir_80']), werk('nieuwe_bedekking', ['epdm'])] }),
    );
    offerte.run('herstel', JSON.stringify({ werkzaamheden: [werk('plaatselijk_herstel', ['bitumen'])] }));
    offerte.run('leeg', JSON.stringify({ werkzaamheden: [] }));

    await migreer(t.db, { migraties: alle.filter((mig) => mig.nr === 9), backup: () => Promise.resolve() });

    expect(t.db.prepare('SELECT COUNT(*) AS n FROM werkzaamheid_soortwerk').get()).toEqual({
      n: koppelingen.n + 1,
    });
    expect(
      t.db
        .prepare("SELECT sleutel, label FROM keuzeopties WHERE lijst = 'nieuweBedekking' ORDER BY volgorde")
        .all(),
    ).toEqual(KEUZE_STARTSET.nieuweBedekking);
    expect(
      t.db
        .prepare("SELECT label, zin FROM keuzeopties WHERE lijst = 'ondergrond' AND sleutel = 'hout'")
        .get(),
    ).toEqual({ label: 'Houten vloer', zin: 'Het dak heeft een houten dakbeschot.' });
    expect(
      t.db.prepare("SELECT zin FROM keuzeopties WHERE lijst = 'hoogte' AND sleutel = '2'").get(),
    ).toEqual({ zin: 'Het dak ligt op de tweede bouwlaag.' });
    expect(
      t.db
        .prepare(
          "SELECT sleutel FROM keuzeopties WHERE lijst = 'soortWerk' AND vraagt_bedekking = 1 ORDER BY volgorde",
        )
        .all(),
    ).toEqual([{ sleutel: 'nieuw_dak' }, { sleutel: 'dak_vervangen' }]);
    expect(t.db.prepare("SELECT zin FROM keuzeopties WHERE id = 'eigen'").get()).toEqual({ zin: '' });
    const bedekking = (id: string) =>
      (
        JSON.parse(
          (t!.db.prepare('SELECT invoer_json FROM offertes WHERE id = ?').get(id) as { invoer_json: string })
            .invoer_json,
        ) as { nieuweBedekking: unknown }
      ).nieuweBedekking;
    expect(bedekking('epdm')).toBe('epdm');
    expect(bedekking('herstel')).toBeNull();
    expect(bedekking('leeg')).toBeNull();
    // De oude lijsten van de stap Extra's passen niet meer in de CHECK.
    expect(() =>
      t!.db
        .prepare(
          "INSERT INTO keuzeopties (id, lijst, sleutel, label, volgorde) VALUES ('x', 'isolatie', 'x', 'X', 1)",
        )
        .run(),
    ).toThrow(/CHECK/);
    // Nog steeds hoogstens één standaardkeuze per lijst, en de koppeling volgt een verwijderde soort werk.
    t.db.prepare("DELETE FROM keuzeopties WHERE id = 'eigen'").run();
    expect(
      t.db.prepare("SELECT COUNT(*) AS n FROM werkzaamheid_soortwerk WHERE soort_werk = 'dakkapel'").get(),
    ).toEqual({
      n: 0,
    });
    expect(() =>
      t!.db.prepare("UPDATE keuzeopties SET standaardkeuze = 1 WHERE lijst = 'hoogte'").run(),
    ).toThrow(/UNIQUE/);
  });

  it('niets te doen: geen back-up, versie blijft', async () => {
    t = await maakTestDatabase();
    const backup = vi.fn(() => Promise.resolve());
    expect(await migreer(t.db, { backup })).toEqual({
      van: SCHEMA_VERSIE,
      naar: SCHEMA_VERSIE,
      backupGemaakt: false,
    });
    expect(backup).not.toHaveBeenCalled();
  });

  it('database met data + een nieuwe migratie: data blijft, versie omhoog, back-up voor-migratie', async () => {
    t = await maakTestDatabase();
    t.db.prepare("INSERT INTO instellingen (sleutel, waarde_json) VALUES ('opmaak', '{}')").run();
    const posten = t.db.prepare('SELECT COUNT(*) AS n FROM prijsposten').get();
    const backupMap = join(t.map, 'Back-ups');
    mkdirSync(backupMap);
    const migraties = laadMigraties({
      './migraties/001_basis.sql': 'SELECT 1;',
      './migraties/002_keuzelijsten.sql': 'SELECT 1;',
      './migraties/998_test.sql': 'ALTER TABLE offertes ADD COLUMN test_kolom TEXT;',
    });
    const uitkomst = await migreer(t.db, {
      migraties,
      backup: (reden) => maakBackup(reden, { db: t!.db, backupMap }),
    });
    expect(uitkomst).toEqual({ van: SCHEMA_VERSIE, naar: 998, backupGemaakt: true });
    expect(t.db.pragma('user_version', { simple: true })).toBe(998);
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM instellingen').get()).toEqual({ n: 1 });
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM prijsposten').get()).toEqual(posten);
    const bestanden = readdirSync(backupMap);
    expect(bestanden).toHaveLength(1);
    expect(bestanden[0]).toMatch(/-voor-migratie\.sqlite$/);
  });

  it('een mislukte migratie wordt teruggedraaid', async () => {
    t = await maakTestDatabase();
    const migraties = laadMigraties({
      './migraties/999_kapot.sql': 'CREATE TABLE tijdelijk (a TEXT); DIT IS GEEN SQL;',
    });
    await expect(migreer(t.db, { migraties, backup: () => Promise.resolve() })).rejects.toThrow();
    expect(t.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSIE);
    expect(tabellen(t.db)).not.toContain('tijdelijk');
  });

  it('weigert een ongeldige migratienaam', () => {
    expect(() => laadMigraties({ './migraties/basis.sql': '' })).toThrow('Ongeldige migratienaam');
  });

  it('opent een bestaande database opnieuw met behoud van data', async () => {
    t = await maakTestDatabase();
    t.db.close();
    const opnieuw = openDatabase(t.pad);
    expect(opnieuw.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSIE);
    opnieuw.close();
    expect(existsSync(t.pad)).toBe(true);
  });
});
