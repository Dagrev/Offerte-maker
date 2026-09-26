import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

// OFM-048: migratie 006 (`prijzenSamenvoegen.ts`): uurprijs-posten en de oude losse prijsposten.

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { laadMigraties, migreer, SCHEMA_VERSIE } = await import('./migraties');
const { blijftAlsMateriaal, voegPrijzenSamen } = await import('./prijzenSamenvoegen');

const alle = laadMigraties(
  import.meta.glob<string>('./migraties/*.sql', { query: '?raw', import: 'default', eager: true }),
);

let t: TestDatabase;
beforeEach(async () => {
  // Een database van vóór OFM-048 (schemaversie 5), met de volledige oude prijslijst.
  t = await maakTestDatabase({ migreren: false });
  await migreer(t.db, { migraties: alle.filter((m) => m.nr <= 5), backup: () => Promise.resolve() });
});
afterEach(() => t.opruimen());

interface Post {
  id: string;
  sleutel: string | null;
  omschrijving: string;
  eenheid: string;
  prijs_cent: number | null;
  btw_tarief: number;
}
const post = (id: string) =>
  t.db.prepare('SELECT * FROM prijsposten WHERE id = ?').get(id) as Post | undefined;
const materiaal = (sleutel: string) =>
  t.db.prepare('SELECT * FROM materialen WHERE sleutel = ?').get(sleutel) as
    { id: string; label: string; eenheid: string; verborgen: number; standaard: number } | undefined;

function offerte(id: string, prijspostIds: string[], verwijderd = false): void {
  const regels = prijspostIds.map((p, i) => ({ id: `r${i}`, omschrijving: 'x', prijspostId: p }));
  t.db
    .prepare(
      `INSERT INTO offertes (id, offertedatum, geldig_tot, klant_json, invoer_json, inhoud_json, aangemaakt_op, bijgewerkt_op, verwijderd_op)
       VALUES (?, '2026-09-01', '2026-10-01', '{}', '{}', ?, 'x', 'x', ?)`,
    )
    .run(id, JSON.stringify({ regels }), verwijderd ? '2026-09-02' : null);
}

describe('migratie 006', () => {
  it('SCHEMA_VERSIE is 6 of hoger', () => {
    expect(SCHEMA_VERSIE).toBeGreaterThanOrEqual(6);
  });

  it('elke werkzaamheid krijgt een uurprijs-post zonder prijs, met de btw van de werkzaamheid', () => {
    t.db.prepare("UPDATE prijsposten SET btw_tarief = 9 WHERE sleutel = 'werk:slopen'").run();
    t.db
      .prepare(
        "INSERT INTO werkzaamheden (id, sleutel, label, eenheid, volgorde) VALUES ('w-eigen', 'kapel', 'Kapel', 'post', 999)",
      )
      .run();
    voegPrijzenSamen(t.db);
    expect(post('start-werk:slopen:uur')).toMatchObject({
      sleutel: 'werk:slopen:uur',
      omschrijving: 'Slopen (per uur)',
      eenheid: 'uur',
      prijs_cent: null,
      btw_tarief: 9,
    });
    const eigen = t.db.prepare("SELECT * FROM prijsposten WHERE sleutel = 'werk:kapel:uur'").get() as Post;
    expect(eigen).toMatchObject({ omschrijving: 'Kapel (per uur)', eenheid: 'uur', btw_tarief: 21 });
    const aantal = (sql: string) => (t.db.prepare(sql).get() as { n: number }).n;
    expect(aantal("SELECT COUNT(*) AS n FROM prijsposten WHERE sleutel LIKE 'werk:%:uur'")).toBe(
      aantal('SELECT COUNT(*) AS n FROM werkzaamheden'),
    );
  });

  it('oude posten: gebruikt, met prijs of eigen → materiaal (zelfde post); anders weg; vaste posten blijven', () => {
    offerte('a', ['start-epdm_15', 'start-steiger']);
    // Alleen in een verwijderde offerte: telt niet als gebruikt.
    offerte('b', ['start-resitrix'], true);
    t.db.prepare("UPDATE prijsposten SET prijs_cent = 1250, btw_tarief = 9 WHERE id = 'start-daktrim'").run();
    t.db.prepare("UPDATE prijsposten SET prijs_cent = 5500 WHERE id = 'start-bitumen'").run();
    t.db
      .prepare(
        "INSERT INTO prijsposten (id, sleutel, omschrijving, eenheid, prijs_cent, btw_tarief, volgorde) VALUES ('eigen', NULL, 'Dakluik plaatsen', 'stuk', NULL, 21, 999)",
      )
      .run();
    const materialenVoor = (t.db.prepare('SELECT COUNT(*) AS n FROM materialen').get() as { n: number }).n;

    expect(voegPrijzenSamen(t.db)).toEqual({ materialen: 4, verwijderd: 22 - 3 - 3 });

    // Gebruikt: zelfde id, sleutel mat:<oude sleutel>, omschrijving = naam van het materiaal.
    expect(post('start-epdm_15')).toMatchObject({
      sleutel: 'mat:epdm_15',
      omschrijving: 'EPDM dakbedekking 1,5 mm',
    });
    expect(materiaal('epdm_15')).toMatchObject({
      id: 'oud-start-epdm_15',
      label: 'EPDM dakbedekking 1,5 mm',
      eenheid: 'm²',
      verborgen: 0,
      standaard: 0,
    });
    // Met een prijs: prijs en btw blijven.
    expect(post('start-daktrim')).toMatchObject({ sleutel: 'mat:daktrim', prijs_cent: 1250, btw_tarief: 9 });
    expect(materiaal('daktrim')?.eenheid).toBe('m¹');
    // Botst met het materiaal Bitumen uit de startset: nieuwe sleutel.
    expect(post('start-bitumen')?.sleutel).toBe('mat:bitumen_2');
    expect(materiaal('bitumen_2')?.label).toBe('Bitumineuze dakbedekking (2-laags)');
    expect(materiaal('bitumen')?.label).toBe('Bitumen');
    // Eigen post zonder sleutel: sleutel uit de naam.
    expect(post('eigen')?.sleutel).toBe('mat:dakluik_plaatsen');
    // Ongebruikt en zonder prijs: weg, ook als alleen een verwijderde offerte hem noemt.
    for (const weg of [
      'start-epdm_11',
      'start-resitrix',
      'start-sloop',
      'start-hoogwerker',
      'start-arbeid_uur',
    ]) {
      expect(post(weg)).toBeUndefined();
    }
    // De vaste posten blijven los, ook als een offerte ze gebruikt.
    for (const vast of ['steiger', 'verzekerde_garantie', 'voorrijkosten']) {
      expect(post(`start-${vast}`)?.sleutel).toBe(vast);
    }
    expect((t.db.prepare('SELECT COUNT(*) AS n FROM materialen').get() as { n: number }).n).toBe(
      materialenVoor + 4,
    );
    // Nieuwe materialen achteraan.
    const volgorde = (
      t.db.prepare('SELECT sleutel FROM materialen ORDER BY volgorde').all() as { sleutel: string }[]
    ).map((r) => r.sleutel);
    expect(volgorde.slice(-4)).toEqual(['epdm_15', 'bitumen_2', 'daktrim', 'dakluik_plaatsen']);
  });

  it('een tweede run doet niets meer', () => {
    offerte('a', ['start-epdm_15']);
    voegPrijzenSamen(t.db);
    const voor = t.db.prepare('SELECT * FROM prijsposten ORDER BY id').all();
    expect(voegPrijzenSamen(t.db)).toEqual({ materialen: 0, verwijderd: 0 });
    expect(t.db.prepare('SELECT * FROM prijsposten ORDER BY id').all()).toEqual(voor);
  });

  it('via migreer: van 5 naar de nieuwste versie, in één keer', async () => {
    offerte('a', ['start-isolatie_80']);
    expect(await migreer(t.db, { backup: () => Promise.resolve() })).toMatchObject({
      van: 5,
      naar: SCHEMA_VERSIE,
    });
    expect(post('start-isolatie_80')?.sleutel).toBe('mat:isolatie_80');
    expect(post('start-werk:isoleren:uur')).toBeDefined();
  });

  it('blijftAlsMateriaal', () => {
    expect(blijftAlsMateriaal({ sleutel: 'x', prijs_cent: null }, false)).toBe(false);
    expect(blijftAlsMateriaal({ sleutel: 'x', prijs_cent: null }, true)).toBe(true);
    expect(blijftAlsMateriaal({ sleutel: 'x', prijs_cent: 0 }, false)).toBe(true);
    expect(blijftAlsMateriaal({ sleutel: null, prijs_cent: null }, false)).toBe(true);
  });
});
