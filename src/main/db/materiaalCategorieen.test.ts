import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFout } from '@shared/fouten';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { WerkzaamhedenBewaar, WerkzaamhedenSet } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

// OFM-057: categorieën van materialen (migratie 012, `werkzaamheden:*`, Herstel startset).

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../testhaken', () => ({ vandaag: () => '2026-09-25', testhaak: () => false }));

const { bewaarWerkzaamheden, haalWerkzaamheden, herstelWerkzaamheden } = await import('./repo/werkzaamheden');
const { laadMigraties, migreer, SCHEMA_VERSIE } = await import('./migraties');
const { hernummerCategorieen } = await import('./materiaalCategorieen');

let t: TestDatabase;
beforeEach(async () => {
  t = await maakTestDatabase();
});
afterEach(() => t.opruimen());

/** De set zoals de tab hem terugstuurt, met categorieën. */
function alsInvoer(set: WerkzaamhedenSet, metCategorieen = true): WerkzaamhedenBewaar {
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
    materialen: set.materialen.map(({ id, label, eenheid, prijsCent, verborgen, categorieId }) => ({
      id,
      label,
      eenheid,
      prijsCent,
      verborgen,
      ...(metCategorieen ? { categorieId } : {}),
    })),
    ...(metCategorieen ? { categorieen: set.categorieen.map(({ id, naam }) => ({ id, naam })) } : {}),
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

const categorie = (set: WerkzaamhedenSet, sleutel: string) =>
  set.materialen.find((m) => m.sleutel === sleutel)?.categorieId;
const namen = (set: WerkzaamhedenSet) => set.categorieen.map((c) => c.naam);
const START = ['Dakbedekking', 'Isolatie', 'Kappen', 'Afwerkmateriaal', 'Schroeven en toebehoren', 'Overig'];

describe('migratie 012', () => {
  it('nieuwe database: startcategorieën en de categorie van de startmaterialen', () => {
    const set = haalWerkzaamheden();
    expect(namen(set)).toEqual(START);
    expect(set.categorieen.every((c) => c.standaard)).toBe(true);
    expect(set.categorieen.map((c) => c.id)).toContain('cat:overig');
    expect(categorie(set, 'bitumen')).toBe('cat:dakbedekking');
    expect(categorie(set, 'pir_80')).toBe('cat:isolatie');
    expect(categorie(set, 'daktrim_aluminium')).toBe('cat:afwerkmateriaal');
    expect(t.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSIE);
  });

  it('012 op versie 11: houtschroeven en betonpluggen naar Schroeven en toebehoren, eigen materialen naar Overig', async () => {
    t.opruimen();
    t = await maakTestDatabase({ migreren: false });
    const alle = laadMigraties(
      import.meta.glob<string>('./migraties/*.sql', { query: '?raw', import: 'default', eager: true }),
    );
    await migreer(t.db, { migraties: alle.filter((m) => m.nr < 12), backup: () => Promise.resolve() });
    const materiaal = t.db.prepare(
      'INSERT INTO materialen (id, sleutel, label, eenheid, volgorde, verborgen, standaard) VALUES (?, ?, ?, ?, 999, 0, 0)',
    );
    materiaal.run('m-hout', 'houtschroeven', 'Houtschroeven', 'stuk');
    materiaal.run('m-beton', 'betonpluggen', 'Betonpluggen', 'stuk');
    materiaal.run('m-zink', 'zink', 'Zink', 'm²');
    expect(await migreer(t.db, { migraties: alle, backup: () => Promise.resolve() })).toMatchObject({
      van: 11,
      naar: 12,
    });
    const set = haalWerkzaamheden();
    expect(namen(set)).toEqual(START);
    expect(categorie(set, 'houtschroeven')).toBe('cat:schroeven');
    expect(categorie(set, 'betonpluggen')).toBe('cat:schroeven');
    expect(categorie(set, 'zink')).toBeNull();
    expect(categorie(set, 'epdm')).toBe('cat:dakbedekking');
  });
});

describe('werkzaamheden:bewaar met categorieën', () => {
  it('toevoegen, hernoemen, volgorde en een materiaal erin; Overig blijft laatste en houdt zijn naam', () => {
    const invoer = alsInvoer(haalWerkzaamheden());
    const overig = invoer.categorieen!.pop()!;
    invoer.categorieen = [
      { id: 'cat-lood', naam: ' Lood en zink ' },
      ...invoer.categorieen!.map((c) => (c.id === 'cat:kappen' ? { ...c, naam: 'Dakkapellen' } : c)),
      { ...overig, naam: 'Anders' },
    ];
    invoer.materialen.push({
      id: 'm-lood',
      label: 'Lood',
      eenheid: 'm²',
      prijsCent: null,
      verborgen: false,
      categorieId: 'cat-lood',
    });
    const uit = bewaarWerkzaamheden(invoer);
    expect(namen(uit)).toEqual([
      'Lood en zink',
      'Dakbedekking',
      'Isolatie',
      'Dakkapellen',
      'Afwerkmateriaal',
      'Schroeven en toebehoren',
      'Overig',
    ]);
    expect(uit.categorieen[0]).toEqual({ id: 'cat-lood', naam: 'Lood en zink', standaard: false });
    expect(categorie(uit, 'lood')).toBe('cat-lood');

    // Overig weglaten verwijdert hem niet; Overig ergens middenin staat daarna weer onderaan.
    const zonder = alsInvoer(uit);
    zonder.categorieen = [zonder.categorieen!.at(-1)!, ...zonder.categorieen!.slice(0, -1)];
    expect(bewaarWerkzaamheden(zonder).categorieen.at(-1)?.id).toBe('cat:overig');
    const weg = alsInvoer(haalWerkzaamheden());
    weg.categorieen = weg.categorieen!.filter((c) => c.id !== 'cat:overig');
    expect(namen(bewaarWerkzaamheden(weg)).at(-1)).toBe('Overig');
  });

  it('verwijderen zet de materialen op Overig; cat:overig of null als categorie = Overig', () => {
    const invoer = alsInvoer(haalWerkzaamheden());
    invoer.categorieen = invoer.categorieen!.filter((c) => c.id !== 'cat:isolatie');
    invoer.materialen = invoer.materialen.map((m) =>
      m.id === 'start-mat-bitumen' ? { ...m, categorieId: 'cat:overig' } : m,
    );
    const uit = bewaarWerkzaamheden(invoer);
    expect(uit.categorieen.map((c) => c.id)).not.toContain('cat:isolatie');
    expect(categorie(uit, 'pir_80')).toBeNull();
    expect(categorie(uit, 'bitumen')).toBeNull();
  });

  it('weglaten van categorieën en categorieId laat alles staan', () => {
    const invoer = alsInvoer(haalWerkzaamheden(), false);
    invoer.materialen.push({
      id: 'm-nieuw',
      label: 'Nieuw',
      eenheid: 'stuk',
      prijsCent: null,
      verborgen: false,
    });
    const uit = bewaarWerkzaamheden(invoer);
    expect(namen(uit)).toEqual(START);
    expect(categorie(uit, 'pir_80')).toBe('cat:isolatie');
    expect(categorie(uit, 'nieuw')).toBeNull();
  });

  it('VALIDATIE bij een lege of dubbele naam, een dubbele id en een onbekende categorie', () => {
    const basis = () => alsInvoer(haalWerkzaamheden());
    const leeg = basis();
    leeg.categorieen![0]!.naam = '  ';
    expect(fout(() => bewaarWerkzaamheden(leeg))).toMatchObject({
      code: 'VALIDATIE',
      melding: VALIDATIE_MELDINGEN.categorieLeeg,
    });
    const dubbel = basis();
    dubbel.categorieen![1]!.naam = 'dakbedekking';
    expect(fout(() => bewaarWerkzaamheden(dubbel)).melding).toBe(VALIDATIE_MELDINGEN.categorieDubbel);
    const alsOverig = basis();
    alsOverig.categorieen![0]!.naam = 'OVERIG';
    expect(fout(() => bewaarWerkzaamheden(alsOverig)).melding).toBe(VALIDATIE_MELDINGEN.categorieDubbel);
    const dubbeleId = basis();
    dubbeleId.categorieen!.push({ ...dubbeleId.categorieen![0]!, naam: 'Ander' });
    expect(fout(() => bewaarWerkzaamheden(dubbeleId)).melding).toBe(VALIDATIE_MELDINGEN.werkDubbel);
    const onbekend = basis();
    onbekend.materialen[0]!.categorieId = 'cat-bestaat-niet';
    expect(fout(() => bewaarWerkzaamheden(onbekend)).melding).toBe(
      VALIDATIE_MELDINGEN.werkOnbekendeKoppeling,
    );
    // Zonder categorieën in de invoer telt de database.
    const zonderLijst = alsInvoer(haalWerkzaamheden(), false);
    const eerste = zonderLijst.materialen[0]!;
    eerste.categorieId = 'cat:kappen';
    const bewaard = bewaarWerkzaamheden(zonderLijst);
    expect(bewaard.materialen.find((m) => m.id === eerste.id)?.categorieId).toBe('cat:kappen');
    const zonderLijstOnbekend = alsInvoer(haalWerkzaamheden(), false);
    zonderLijstOnbekend.materialen[0]!.categorieId = 'cat-weg';
    expect(fout(() => bewaarWerkzaamheden(zonderLijstOnbekend)).code).toBe('VALIDATIE');
  });
});

describe('Herstel startset', () => {
  it('zet startcategorieën terug (naam, volgorde, ook verwijderde) en de startmaterialen; eigen blijven', () => {
    const invoer = alsInvoer(haalWerkzaamheden());
    const overig = invoer.categorieen!.pop()!;
    invoer.categorieen = [
      ...invoer
        .categorieen!.filter((c) => c.id !== 'cat:kappen')
        .map((c) => (c.id === 'cat:isolatie' ? { ...c, naam: 'Isoleren' } : c)),
      { id: 'cat-eigen', naam: 'Eigen' },
      overig,
    ].reverse();
    invoer.materialen = invoer.materialen.map((m) =>
      m.id === 'start-mat-pir_80' ? { ...m, categorieId: 'cat-eigen' } : m,
    );
    bewaarWerkzaamheden(invoer);
    herstelWerkzaamheden();
    const set = haalWerkzaamheden();
    expect(namen(set)).toEqual([...START.slice(0, -1), 'Eigen', 'Overig']);
    expect(categorie(set, 'pir_80')).toBe('cat:isolatie');
    // Nummeren zonder voorkeur: Overig blijft laatste.
    hernummerCategorieen(t.db);
    expect(namen(haalWerkzaamheden()).at(-1)).toBe('Overig');
  });
});
