import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFout } from '@shared/fouten';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { DaksysteemRegel, WerkzaamhedenBewaar, WerkzaamhedenSet } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

// OFM-051: standaardmaterialen per daksysteem (migratie 010, `werkzaamheden:*`).

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../testhaken', () => ({ vandaag: () => '2026-09-25', testhaak: () => false }));

const { bewaarWerkzaamheden, haalWerkzaamheden, herstelWerkzaamheden } = await import('./repo/werkzaamheden');
const { bewaarKeuzelijst, lijstKeuzeopties } = await import('./repo/keuzeopties');
const { laadMigraties, migreer, SCHEMA_VERSIE } = await import('./migraties');

let t: TestDatabase;
beforeEach(async () => {
  t = await maakTestDatabase();
});
afterEach(() => t.opruimen());

/** De set zoals de tab hem terugstuurt; `daksystemen` weglaten kan met `undefined`. */
function alsInvoer(set: WerkzaamhedenSet, daksystemen?: DaksysteemRegel[]): WerkzaamhedenBewaar {
  return {
    werkzaamheden: set.werkzaamheden.map((w) => ({
      id: w.id,
      label: w.label,
      eenheid: w.eenheid,
      prijsCent: w.prijsCent,
      verborgen: w.verborgen,
      soortenWerk: w.soortenWerk,
      opties: w.opties.map(({ id, label, eenheid, prijsCent, verborgen }) => ({
        id,
        label,
        eenheid,
        prijsCent,
        verborgen,
      })),
      materialen: w.materialen,
    })),
    materialen: set.materialen.map(({ id, label, eenheid, prijsCent, verborgen }) => ({
      id,
      label,
      eenheid,
      prijsCent,
      verborgen,
    })),
    ...(daksystemen ? { daksystemen } : {}),
  };
}

function fout(fn: () => unknown): AppFout {
  try {
    fn();
  } catch (e) {
    return e as AppFout;
  }
  throw new Error('geen fout');
}

const ISO = 'start-werk-isoleren';
const PIR100 = 'start-mat-pir_100';
const EPS = 'start-mat-eps';
const regel = (deel: Partial<DaksysteemRegel> = {}): DaksysteemRegel => ({
  werkzaamheidId: ISO,
  ondergrond: 'hout',
  bedekking: null,
  materiaalId: PIR100,
  ...deel,
});

describe('migratie 010 (OFM-051)', () => {
  it('lege tabel na een nieuwe database; haal geeft daksystemen []', () => {
    expect(SCHEMA_VERSIE).toBeGreaterThanOrEqual(10);
    expect(haalWerkzaamheden().daksystemen).toEqual([]);
  });

  it('010 op een database van versie 9: tabel erbij, niets anders verandert', async () => {
    t.opruimen();
    t = await maakTestDatabase({ migreren: false });
    const alle = laadMigraties(
      import.meta.glob<string>('./migraties/*.sql', { query: '?raw', import: 'default', eager: true }),
    );
    await migreer(t.db, { migraties: alle.filter((m) => m.nr < 10), backup: () => Promise.resolve() });
    const uit = await migreer(t.db, { migraties: alle, backup: () => Promise.resolve() });
    expect(uit).toMatchObject({ van: 9, naar: SCHEMA_VERSIE });
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM daksysteem_materiaal').get()).toEqual({ n: 0 });
  });

  it('CHECK en unieke index: niet alle × alle, en één regel per combinatie (ook met NULL)', () => {
    const invoegen = t.db.prepare(
      'INSERT INTO daksysteem_materiaal (werkzaamheid_id, ondergrond, bedekking, materiaal_id) VALUES (?, ?, ?, ?)',
    );
    expect(() => invoegen.run(ISO, null, null, PIR100)).toThrow(/CHECK/);
    invoegen.run(ISO, null, 'epdm', PIR100);
    expect(() => invoegen.run(ISO, null, 'epdm', EPS)).toThrow(/UNIQUE/);
    // Niet kiesbaar bij de werkzaamheid (FK op werkzaamheid_materiaal) en onbekende ondergrond (FK).
    expect(() => invoegen.run(ISO, 'hout', null, 'start-mat-bitumen')).toThrow(/FOREIGN KEY/);
    expect(() => invoegen.run(ISO, 'zand', null, PIR100)).toThrow(/FOREIGN KEY/);
  });
});

describe('werkzaamheden:bewaar met daksystemen', () => {
  it('bewaart de regels en geeft ze terug; weglaten laat ze staan', () => {
    const set = haalWerkzaamheden();
    const regels = [regel(), regel({ ondergrond: 'beton', bedekking: 'epdm', materiaalId: EPS })];
    expect(bewaarWerkzaamheden(alsInvoer(set, regels)).daksystemen).toEqual(regels);
    // Een bewaaractie zonder daksystemen (bijv. "Ook opslaan in instellingen") houdt ze.
    const na = bewaarWerkzaamheden(alsInvoer(haalWerkzaamheden()));
    expect(na.daksystemen).toEqual(regels);
    // Een lege lijst wist ze.
    expect(bewaarWerkzaamheden(alsInvoer(na, [])).daksystemen).toEqual([]);
  });

  it('een regel met een niet-kiesbaar materiaal of een onbekende keuze vervalt', () => {
    const set = haalWerkzaamheden();
    const uit = bewaarWerkzaamheden(
      alsInvoer(set, [
        regel(),
        regel({ ondergrond: null, bedekking: 'epdm', materiaalId: 'start-mat-bitumen' }),
        regel({ ondergrond: 'zand' }),
        regel({ ondergrond: null, bedekking: 'riet' }),
      ]),
    );
    expect(uit.daksystemen).toEqual([regel()]);
  });

  it('materiaal niet meer kiesbaar of verwijderd: de regel verdwijnt mee', () => {
    const set = bewaarWerkzaamheden(
      alsInvoer(haalWerkzaamheden(), [regel(), regel({ ondergrond: 'beton', materiaalId: EPS })]),
    );
    // PIR 100 niet meer kiesbaar bij Isoleren; de regel met EPS blijft.
    const zonderPir = {
      ...set,
      werkzaamheden: set.werkzaamheden.map((w) =>
        w.id === ISO ? { ...w, materialen: w.materialen.filter((m) => m.materiaalId !== PIR100) } : w,
      ),
    };
    const na = bewaarWerkzaamheden(alsInvoer(zonderPir));
    expect(na.daksystemen).toEqual([regel({ ondergrond: 'beton', materiaalId: EPS })]);
    // Het materiaal EPS helemaal verwijderen.
    const zonderEps = {
      ...na,
      werkzaamheden: na.werkzaamheden.map((w) => ({
        ...w,
        materialen: w.materialen.filter((m) => m.materiaalId !== EPS),
      })),
      materialen: na.materialen.filter((m) => m.id !== EPS),
    };
    expect(bewaarWerkzaamheden(alsInvoer(zonderEps, na.daksystemen)).daksystemen).toEqual([]);
  });

  it('VALIDATIE bij alle × alle en bij een dubbele combinatie', () => {
    const set = haalWerkzaamheden();
    expect(
      fout(() => bewaarWerkzaamheden(alsInvoer(set, [regel({ ondergrond: null, bedekking: null })]))),
    ).toMatchObject({ code: 'VALIDATIE', melding: VALIDATIE_MELDINGEN.werkOnbekendeKoppeling });
    expect(
      fout(() => bewaarWerkzaamheden(alsInvoer(set, [regel(), regel({ materiaalId: EPS })]))),
    ).toMatchObject({ code: 'VALIDATIE', melding: VALIDATIE_MELDINGEN.werkDubbel });
    expect(haalWerkzaamheden().daksystemen).toEqual([]);
  });

  it('een werkzaamheid verwijderen neemt zijn regels mee', () => {
    const set = haalWerkzaamheden();
    const nieuwId = 'eigen-werk';
    const metEigen = bewaarWerkzaamheden({
      ...alsInvoer(set),
      werkzaamheden: [
        ...alsInvoer(set).werkzaamheden,
        {
          id: nieuwId,
          label: 'Bevestigen',
          eenheid: 'm²',
          prijsCent: null,
          verborgen: false,
          soortenWerk: [],
          opties: [],
          materialen: [
            { materiaalId: PIR100, standaard: true },
            { materiaalId: EPS, standaard: false },
          ],
        },
      ],
      daksystemen: [regel({ werkzaamheidId: nieuwId, materiaalId: EPS })],
    });
    expect(metEigen.daksystemen).toHaveLength(1);
    const zonder = { ...metEigen, werkzaamheden: metEigen.werkzaamheden.filter((w) => w.id !== nieuwId) };
    expect(bewaarWerkzaamheden(alsInvoer(zonder, metEigen.daksystemen)).daksystemen).toEqual([]);
  });
});

describe('keuzeopties en herstel', () => {
  it('een verwijderde ondergrond of bedekking neemt de regels erop mee (FK)', () => {
    bewaarWerkzaamheden(
      alsInvoer(haalWerkzaamheden(), [
        regel(),
        regel({ ondergrond: 'beton' }),
        regel({ ondergrond: null, bedekking: 'pvc', materiaalId: EPS }),
      ]),
    );
    const zonder = (lijst: 'ondergrond' | 'nieuweBedekking', sleutel: string) =>
      bewaarKeuzelijst(
        lijst,
        lijstKeuzeopties()
          [lijst].filter((o) => o.sleutel !== sleutel)
          .map(({ id, label, verborgen, standaardkeuze }) => ({ id, label, verborgen, standaardkeuze })),
      );
    zonder('ondergrond', 'hout');
    expect(haalWerkzaamheden().daksystemen.map((r) => r.ondergrond ?? r.bedekking)).toEqual(['beton', 'pvc']);
    zonder('nieuweBedekking', 'pvc');
    expect(haalWerkzaamheden().daksystemen).toEqual([regel({ ondergrond: 'beton' })]);
  });

  it('Herstel startset zet de afwijkingen op de startset (leeg)', () => {
    bewaarWerkzaamheden(alsInvoer(haalWerkzaamheden(), [regel()]));
    herstelWerkzaamheden();
    expect(haalWerkzaamheden().daksystemen).toEqual([]);
  });
});
