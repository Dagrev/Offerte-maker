import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFout } from '@shared/fouten';
import { KEUZE_STARTSET } from '@shared/keuzelijsten';
import { legeKlusInvoer } from '@shared/nieuweOfferte';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { KeuzeLijst, KlusInvoer } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

// OFM-034: instelbare keuzelijsten (repository, kanalen en de controle bij offerte:bewaarInvoer).

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../testhaken', () => ({ vandaag: () => '2026-09-25', testhaak: () => false }));

const { bewaarKeuzelijst, controleerKeuzes, haalKeuzes, herstelKeuzelijst, lijstKeuzeopties } =
  await import('./repo/keuzeopties');
const { bewaarInvoer, maakOfferte } = await import('./repo/offertesInvoer');
const { verwijderOfferte } = await import('./repo/offertesBeheer');
const { lijstPrijsposten } = await import('./repo/prijsposten');
const { keuzelijstenHandlers } = await import('../ipc/keuzelijsten');
const { maakIpcHandler } = await import('../ipc/registreer');

let t: TestDatabase;
beforeEach(async () => {
  t = await maakTestDatabase();
});
afterEach(() => t.opruimen());

const opties = (lijst: KeuzeLijst) => lijstKeuzeopties()[lijst];
const alsInvoer = (lijst: KeuzeLijst) =>
  opties(lijst).map(({ id, label, verborgen }) => ({ id, label, verborgen }));

function offerteMet(deel: Partial<KlusInvoer>): string {
  const id = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
  bewaarInvoer({ id, invoer: { ...legeKlusInvoer(), ...deel } }, 30);
  return id;
}

function fout(fn: () => unknown): AppFout {
  try {
    fn();
  } catch (e) {
    return e as AppFout;
  }
  throw new Error('geen fout');
}

describe('keuzelijsten:haal', () => {
  it('per lijst de startset in volgorde, met vast en inGebruik', () => {
    const lijsten = lijstKeuzeopties();
    expect(lijsten.soortWerk.map((o) => o.label)).toEqual(KEUZE_STARTSET.soortWerk.map((o) => o.label));
    expect(lijsten.isolatie.find((o) => o.sleutel === 'geen')).toMatchObject({ vast: true, standaard: true });
    expect(lijsten.garantie.find((o) => o.sleutel === '20')).toMatchObject({ vast: false, inGebruik: false });
    offerteMet({ soortWerk: 'reparatie', hwaAantal: 2, extraAantallen: {} });
    const na = lijstKeuzeopties();
    expect(na.soortWerk.find((o) => o.sleutel === 'reparatie')?.inGebruik).toBe(true);
    expect(na.extras.find((o) => o.sleutel === 'hwa')?.inGebruik).toBe(true);
    expect(na.extras.find((o) => o.sleutel === 'doorvoer')?.inGebruik).toBe(false);
    expect(haalKeuzes().soortDak).toEqual(KEUZE_STARTSET.soortDak);
  });

  it('een offerte in de prullenbak telt niet als in gebruik', () => {
    const id = offerteMet({ soortWerk: 'reparatie' });
    verwijderOfferte(id);
    expect(opties('soortWerk').find((o) => o.sleutel === 'reparatie')?.inGebruik).toBe(false);
  });
});

describe('keuzelijsten:bewaar', () => {
  it('toevoegen: sleutel uit het label, prijspost zonder prijs; hernoemen, verbergen en volgorde', () => {
    const uit = bewaarKeuzelijst('bedekking', [
      { id: '', label: 'Leien  (natuur)', verborgen: false },
      ...alsInvoer('bedekking').map((o) => (o.label === 'Resitrix' ? { ...o, label: 'Resitrix SK' } : o)),
    ]);
    expect(uit[0]).toMatchObject({ sleutel: 'leien_natuur', label: 'Leien  (natuur)', standaard: false });
    expect(uit.map((o) => o.label)).toContain('Resitrix SK');
    const post = lijstPrijsposten().find((p) => p.sleutel === 'leien_natuur');
    expect(post).toMatchObject({
      omschrijving: 'Leien  (natuur)',
      eenheid: 'm²',
      prijsCent: null,
      btwTarief: 21,
    });

    const verborgen = bewaarKeuzelijst(
      'bedekking',
      uit.map((o) => ({ id: o.id, label: o.label, verborgen: o.sleutel === 'bitumen' })),
    );
    expect(verborgen.find((o) => o.sleutel === 'bitumen')?.verborgen).toBe(true);
    expect(verborgen.map((o) => o.sleutel).slice(0, 2)).toEqual(['leien_natuur', 'epdm_11']);
  });

  it('sleutels zijn uniek over alle lijsten en prijsposten; extra = post per stuk; isolatie met "Isolatie"', () => {
    const extras = bewaarKeuzelijst('extras', [
      ...alsInvoer('extras'),
      { id: '', label: 'Steiger', verborgen: false },
    ]);
    expect(extras.at(-1)?.sleutel).toBe('steiger_2');
    expect(lijstPrijsposten().find((p) => p.sleutel === 'steiger_2')).toMatchObject({ eenheid: 'stuk' });
    const iso = bewaarKeuzelijst('isolatie', [
      ...alsInvoer('isolatie'),
      { id: '', label: '160 mm', verborgen: false },
    ]);
    expect(iso.at(-1)?.sleutel).toBe('160_mm');
    expect(lijstPrijsposten().find((p) => p.sleutel === '160_mm')?.omschrijving).toBe('Isolatie 160 mm');
    const werk = bewaarKeuzelijst('soortWerk', [
      ...alsInvoer('soortWerk'),
      { id: '', label: 'Anders', verborgen: false },
    ]);
    expect(werk.at(-1)?.sleutel).toBe('anders_2');
    // Soort werk heeft geen prijzen: geen nieuwe post.
    expect(lijstPrijsposten().some((p) => p.sleutel === 'anders_2')).toBe(false);
  });

  it('verwijderen mag alleen als de optie niet in een (niet-verwijderde) offerte staat', () => {
    offerteMet({ ondergrond: 'staal' });
    const zonder = (sleutel: string) =>
      opties('ondergrond')
        .filter((o) => o.sleutel !== sleutel)
        .map(({ id, label, verborgen }) => ({ id, label, verborgen }));
    const f = fout(() => bewaarKeuzelijst('ondergrond', zonder('staal')));
    expect(f).toBeInstanceOf(AppFout);
    expect(f.melding).toBe(VALIDATIE_MELDINGEN.keuzeInGebruik);
    expect(bewaarKeuzelijst('ondergrond', zonder('beton')).map((o) => o.sleutel)).toEqual([
      'hout',
      'staal',
      'onbekend',
    ]);
  });

  it('de standaardkeuze van een nieuwe offerte kan niet weg of verborgen worden, wel hernoemd', () => {
    const lijst = alsInvoer('garantie');
    expect(fout(() => bewaarKeuzelijst('garantie', lijst.slice(1))).melding).toBe(
      VALIDATIE_MELDINGEN.keuzeVast,
    );
    expect(
      fout(() =>
        bewaarKeuzelijst(
          'garantie',
          lijst.map((o, i) => ({ ...o, verborgen: i === 0 })),
        ),
      ).melding,
    ).toBe(VALIDATIE_MELDINGEN.keuzeVast);
    const hernoemd = bewaarKeuzelijst(
      'garantie',
      lijst.map((o, i) => (i === 0 ? { ...o, label: '10 jaar schriftelijk' } : o)),
    );
    expect(hernoemd[0]?.label).toBe('10 jaar schriftelijk');
  });

  it('weigert onbekende of dubbele id’s', () => {
    const lijst = alsInvoer('hoogte');
    expect(
      fout(() => bewaarKeuzelijst('hoogte', [...lijst, { id: 'bestaat-niet', label: 'x', verborgen: false }]))
        .code,
    ).toBe('VALIDATIE');
    expect(fout(() => bewaarKeuzelijst('hoogte', [...lijst, lijst[1]!])).code).toBe('VALIDATIE');
    // Een id van een andere lijst telt ook als onbekend.
    const ander = alsInvoer('soortDak')[0]!;
    expect(fout(() => bewaarKeuzelijst('hoogte', [...lijst, ander])).code).toBe('VALIDATIE');
  });

  it('hernoemen werkt de korte omschrijving van bestaande offertes bij', () => {
    const id = offerteMet({ soortWerk: 'reparatie', bedekking: 'epdm_11' });
    const kort = () =>
      (t.db.prepare('SELECT omschrijving_kort AS k FROM offertes WHERE id = ?').get(id) as { k: string }).k;
    expect(kort()).toBe('Reparatie · EPDM 1,1 mm');
    bewaarKeuzelijst(
      'soortWerk',
      alsInvoer('soortWerk').map((o) => (o.label === 'Reparatie' ? { ...o, label: 'Lekkage verhelpen' } : o)),
    );
    expect(kort()).toBe('Lekkage verhelpen · EPDM 1,1 mm');
  });

  it('via IPC: schema en foutvertaling', async () => {
    const bewaar = maakIpcHandler('keuzelijsten:bewaar', keuzelijstenHandlers['keuzelijsten:bewaar']);
    const evt = {} as Parameters<typeof bewaar>[0];
    expect(await bewaar(evt, { lijst: 'bestaat', opties: [] })).toMatchObject({ ok: false });
    expect(
      await bewaar(evt, { lijst: 'soortDak', opties: [{ id: '', label: '  ', verborgen: false }] }),
    ).toMatchObject({
      ok: false,
      fout: { code: 'VALIDATIE' },
    });
    const ok = await bewaar(evt, {
      lijst: 'soortDak',
      opties: [...alsInvoer('soortDak'), { id: '', label: 'Rond dak', verborgen: false }],
    });
    expect(ok).toMatchObject({ ok: true });
    const haal = maakIpcHandler('keuzelijsten:haal', keuzelijstenHandlers['keuzelijsten:haal']);
    expect(await haal(evt, undefined)).toMatchObject({ ok: true });
  });
});

describe('keuzelijsten:herstel', () => {
  it('standaardopties terug met oorspronkelijk label, zichtbaar en in volgorde; eigen opties blijven erachter', async () => {
    const lijst = alsInvoer('afwerking');
    bewaarKeuzelijst('afwerking', [
      { id: '', label: 'Tegels', verborgen: false },
      ...lijst
        .filter((o) => o.label !== 'Sedum')
        .map((o) => (o.label === 'Grind' ? { ...o, label: 'Grind (wit)', verborgen: true } : o)),
    ]);
    const herstel = maakIpcHandler('keuzelijsten:herstel', keuzelijstenHandlers['keuzelijsten:herstel']);
    expect(await herstel({} as never, { lijst: 'afwerking' })).toEqual({ ok: true, data: null });
    expect(opties('afwerking').map((o) => [o.label, o.verborgen, o.standaard])).toEqual([
      ['Geen', false, true],
      ['Grind', false, true],
      ['Sedum', false, true],
      ['Tegels', false, false],
    ]);
    herstelKeuzelijst('soortWerk');
    expect(opties('soortWerk').map((o) => o.label)).toEqual(KEUZE_STARTSET.soortWerk.map((o) => o.label));
  });
});

describe('controle bij offerte:bewaarInvoer', () => {
  it('onbekende sleutel → VALIDATIE; een nieuwe optie en de eigen oude waarde mogen', () => {
    const id = offerteMet({ soortWerk: 'reparatie' });
    expect(
      fout(() => bewaarInvoer({ id, invoer: { ...legeKlusInvoer(), bedekking: 'leien' } }, 30)).melding,
    ).toBe(VALIDATIE_MELDINGEN.onbekendeKeuze);
    bewaarKeuzelijst('bedekking', [...alsInvoer('bedekking'), { id: '', label: 'Leien', verborgen: false }]);
    bewaarInvoer({ id, invoer: { ...legeKlusInvoer(), soortWerk: 'reparatie', bedekking: 'leien' } }, 30);

    // Verwijderde optie die al in de offerte stond: bewaren blijft werken.
    const vorige: KlusInvoer = { ...legeKlusInvoer(), soortWerk: 'weg' };
    expect(() => controleerKeuzes({ ...legeKlusInvoer(), soortWerk: 'weg' }, vorige)).not.toThrow();
    expect(() => controleerKeuzes({ ...legeKlusInvoer(), soortWerk: 'weg' }, null)).toThrow(AppFout);
  });

  it("extra's: nieuwe sleutel moet in de lijst staan; nooit een standaard-extra in extraAantallen", () => {
    expect(() => controleerKeuzes({ ...legeKlusInvoer(), extraAantallen: { dakkapel: 1 } }, null)).toThrow(
      AppFout,
    );
    expect(() =>
      controleerKeuzes({ ...legeKlusInvoer(), extraAantallen: { dakkapel: 0 } }, null),
    ).not.toThrow();
    expect(() => controleerKeuzes({ ...legeKlusInvoer(), extraAantallen: { hwa: 2 } }, null)).toThrow(
      AppFout,
    );
    bewaarKeuzelijst('extras', [...alsInvoer('extras'), { id: '', label: 'Dakkapel', verborgen: false }]);
    expect(() =>
      controleerKeuzes({ ...legeKlusInvoer(), extraAantallen: { dakkapel: 1 } }, null),
    ).not.toThrow();
  });
});
