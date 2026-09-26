import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFout } from '@shared/fouten';
import { legeKlusInvoer } from '@shared/nieuweOfferte';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { GebruikteWerkzaamheden } from '@shared/werkzaamheden';
import type { GekozenWerkzaamheid, WerkzaamhedenBewaar, WerkzaamhedenSet } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

// OFM-043: werkzaamheden, opties en materialen (migratie 004, startset, repository en kanalen).

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../testhaken', () => ({ vandaag: () => '2026-09-25', testhaak: () => false }));

// "In gebruik" kan pas na OFM-044 voorkomen; hier wordt het nagebootst.
const gebruik = vi.hoisted(() => ({ waarde: null as GebruikteWerkzaamheden | null }));
vi.mock('@shared/werkzaamheden', async (origineel) => {
  const echt = await origineel<typeof import('@shared/werkzaamheden')>();
  return {
    ...echt,
    gebruikteWerkzaamheden: (invoer: Parameters<typeof echt.gebruikteWerkzaamheden>[0]) =>
      gebruik.waarde ?? echt.gebruikteWerkzaamheden(invoer),
  };
});

const { bewaarWerkzaamheden, haalWerkzaamheden, herstelWerkzaamheden } = await import('./repo/werkzaamheden');
const { bewaarKeuzelijst, lijstKeuzeopties } = await import('./repo/keuzeopties');
const { bewaarInvoer, maakOfferte } = await import('./repo/offertesInvoer');
const { bewaarPrijspost, haalPrijspostOpSleutel, lijstPrijsposten, prijslijstVoorAgent, verwijderPrijspost } =
  await import('./repo/prijsposten');
const { laadMigraties, migreer } = await import('./migraties');
const { werkzaamhedenHandlers } = await import('../ipc/werkzaamheden');
const { maakIpcHandler } = await import('../ipc/registreer');

let t: TestDatabase;
beforeEach(async () => {
  t = await maakTestDatabase();
  gebruik.waarde = null;
});
afterEach(() => t.opruimen());

/** De set zoals de tab hem terugstuurt. */
function alsInvoer(set: WerkzaamhedenSet): WerkzaamhedenBewaar {
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

const werk = (set: WerkzaamhedenSet, sleutel: string) => set.werkzaamheden.find((w) => w.sleutel === sleutel);
const materiaal = (set: WerkzaamhedenSet, sleutel: string) =>
  set.materialen.find((m) => m.sleutel === sleutel);

describe('startset na migratie 004', () => {
  it('werkzaamheden, opties, materialen en koppelingen volgens shared/werkzaamheden.ts', () => {
    const set = haalWerkzaamheden();
    expect(set.werkzaamheden.map((w) => w.sleutel)).toEqual([
      'slopen',
      'isoleren',
      'nieuwe_bedekking',
      'dakrand_afwerking',
      'hemelwaterafvoer',
      'lekkage_opsporen',
      'plaatselijk_herstel',
      'dakgoot_vervangen',
    ]);
    expect(set.materialen).toHaveLength(9);
    expect(werk(set, 'slopen')).toMatchObject({
      label: 'Slopen',
      eenheid: 'm²',
      prijsCent: null,
      standaard: true,
      inGebruik: false,
      soortenWerk: ['dak_vervangen'],
      opties: [{ sleutel: 'afvalcontainer', label: 'Afvalcontainer', eenheid: 'stuk', prijsCent: null }],
    });
    const isoleren = werk(set, 'isoleren');
    expect(isoleren?.soortenWerk).toEqual(['nieuw_dak', 'dak_vervangen', 'isolatie']);
    expect(
      isoleren?.materialen.map((m) => set.materialen.find((x) => x.id === m.materiaalId)?.sleutel),
    ).toEqual(['pir_60', 'pir_80', 'pir_100', 'eps']);
    expect(isoleren?.materialen.filter((m) => m.standaard)).toEqual([
      { materiaalId: 'start-mat-pir_80', standaard: true },
    ]);
    const reparatie = set.soortenWerk.find((s) => s.sleutel === 'reparatie');
    expect(reparatie?.werkzaamheden).toEqual([
      'start-werk-lekkage_opsporen',
      'start-werk-plaatselijk_herstel',
      'start-werk-dakgoot_vervangen',
    ]);
    expect(set.soortenWerk.map((s) => s.label)).toContain('Dak vervangen');
  });

  it('elke werkzaamheid, optie en materiaal heeft een prijspost zonder prijs (V-13)', () => {
    expect(haalPrijspostOpSleutel('werk:slopen')).toMatchObject({
      id: 'start-werk:slopen',
      omschrijving: 'Slopen',
      eenheid: 'm²',
      prijsCent: null,
      btwTarief: 21,
    });
    expect(haalPrijspostOpSleutel('optie:slopen:afvalcontainer')?.omschrijving).toBe(
      'Afvalcontainer (Slopen)',
    );
    expect(haalPrijspostOpSleutel('mat:daktrim_aluminium')?.eenheid).toBe('m¹');
    expect(lijstPrijsposten().filter((p) => p.sleutel?.includes(':'))).toHaveLength(8 + 1 + 9);
    // Sinds OFM-044 gaan ze ook naar de agent.
    expect(prijslijstVoorAgent()).toHaveLength(22 + 8 + 1 + 9);
  });

  it('op een database van versie 2 zonder een gekoppelde soort werk: die koppeling wordt overgeslagen', async () => {
    t.opruimen();
    t = await maakTestDatabase({ migreren: false });
    const alle = laadMigraties(
      import.meta.glob<string>('./migraties/*.sql', { query: '?raw', import: 'default', eager: true }),
    );
    await migreer(t.db, { migraties: alle.filter((m) => m.nr <= 2), backup: () => Promise.resolve() });
    t.db.prepare("DELETE FROM keuzeopties WHERE lijst = 'soortWerk' AND sleutel = 'isolatie'").run();
    const backup = vi.fn(() => Promise.resolve());
    expect(await migreer(t.db, { backup })).toMatchObject({ van: 2, backupGemaakt: true });
    expect(backup).toHaveBeenCalledWith('voor-migratie');
    expect(werk(haalWerkzaamheden(), 'isoleren')?.soortenWerk).toEqual(['nieuw_dak', 'dak_vervangen']);
  });
});

describe('werkzaamheden:bewaar', () => {
  it('toevoegen met koppelingen en prijzen; sleutels uit het label, uniek', () => {
    const set = haalWerkzaamheden();
    const invoer = alsInvoer(set);
    invoer.materialen.push({
      id: 'm-nieuw',
      label: 'Leien',
      eenheid: 'm²',
      prijsCent: 4550,
      verborgen: false,
    });
    invoer.werkzaamheden.push({
      id: 'w-nieuw',
      label: '  Slopen ',
      eenheid: 'post',
      prijsCent: 12000,
      verborgen: false,
      soortenWerk: ['onderhoud', 'onderhoud', 'reparatie'],
      opties: [
        { id: 'o-nieuw', label: 'Afvalcontainer', eenheid: 'stuk', prijsCent: 35000, verborgen: false },
      ],
      materialen: [
        { materiaalId: 'm-nieuw', standaard: true },
        { materiaalId: 'start-mat-bitumen', standaard: false },
      ],
    });
    const uit = bewaarWerkzaamheden(invoer);
    const nieuw = uit.werkzaamheden.at(-1);
    expect(nieuw).toMatchObject({
      id: 'w-nieuw',
      sleutel: 'slopen_2',
      label: 'Slopen',
      eenheid: 'post',
      prijsCent: 12000,
      standaard: false,
      soortenWerk: ['reparatie', 'onderhoud'],
      opties: [{ id: 'o-nieuw', sleutel: 'afvalcontainer_2', prijsCent: 35000 }],
    });
    // Materialen in de volgorde van de materialenlijst.
    expect(nieuw?.materialen).toEqual([
      { materiaalId: 'start-mat-bitumen', standaard: false },
      { materiaalId: 'm-nieuw', standaard: true },
    ]);
    expect(materiaal(uit, 'leien')).toMatchObject({ id: 'm-nieuw', prijsCent: 4550, standaard: false });
    expect(haalPrijspostOpSleutel('werk:slopen_2')).toMatchObject({
      omschrijving: 'Slopen',
      eenheid: 'post',
    });
    expect(haalPrijspostOpSleutel('optie:slopen_2:afvalcontainer_2')?.prijsCent).toBe(35000);
    expect(haalPrijspostOpSleutel('mat:leien')?.prijsCent).toBe(4550);
    expect(uit.soortenWerk.find((s) => s.sleutel === 'onderhoud')?.werkzaamheden).toContain('w-nieuw');
    expect(uit).toEqual(haalWerkzaamheden());
  });

  it('hernoemen, eenheid, prijs, verbergen en volgorde; prijsposten volgen', () => {
    const invoer = alsInvoer(haalWerkzaamheden());
    const [eerste, tweede, ...rest] = invoer.werkzaamheden;
    const slopen = { ...eerste!, label: 'Slopen en afvoeren', eenheid: 'post' as const, prijsCent: 900 };
    slopen.opties = slopen.opties.map((o) => ({ ...o, prijsCent: 25000, verborgen: true }));
    invoer.werkzaamheden = [{ ...tweede!, verborgen: true }, slopen, ...rest];
    invoer.materialen = invoer.materialen.map((m) => (m.label === 'EPS' ? { ...m, label: 'EPS 100 mm' } : m));
    const uit = bewaarWerkzaamheden(invoer);
    expect(uit.werkzaamheden.slice(0, 2).map((w) => [w.sleutel, w.verborgen])).toEqual([
      ['isoleren', true],
      ['slopen', false],
    ]);
    expect(werk(uit, 'slopen')).toMatchObject({
      label: 'Slopen en afvoeren',
      eenheid: 'post',
      prijsCent: 900,
    });
    expect(werk(uit, 'slopen')?.opties[0]).toMatchObject({ verborgen: true, prijsCent: 25000 });
    expect(haalPrijspostOpSleutel('werk:slopen')).toMatchObject({
      omschrijving: 'Slopen en afvoeren',
      eenheid: 'post',
    });
    expect(haalPrijspostOpSleutel('optie:slopen:afvalcontainer')?.omschrijving).toBe(
      'Afvalcontainer (Slopen en afvoeren)',
    );
    expect(materiaal(uit, 'eps')?.label).toBe('EPS 100 mm');
    expect(haalPrijspostOpSleutel('mat:eps')?.omschrijving).toBe('EPS 100 mm');
  });

  it('verwijderen: item, koppelingen en prijsposten weg', () => {
    const invoer = alsInvoer(haalWerkzaamheden());
    invoer.werkzaamheden = invoer.werkzaamheden
      .filter((w) => w.id !== 'start-werk-dakgoot_vervangen')
      .map((w) => ({
        ...w,
        opties: [],
        materialen: w.materialen.filter((m) => m.materiaalId !== 'start-mat-eps'),
      }));
    invoer.materialen = invoer.materialen.filter((m) => m.id !== 'start-mat-eps');
    const uit = bewaarWerkzaamheden(invoer);
    expect(werk(uit, 'dakgoot_vervangen')).toBeUndefined();
    expect(materiaal(uit, 'eps')).toBeUndefined();
    expect(werk(uit, 'slopen')?.opties).toEqual([]);
    expect(haalPrijspostOpSleutel('werk:dakgoot_vervangen')).toBeNull();
    expect(haalPrijspostOpSleutel('mat:eps')).toBeNull();
    expect(haalPrijspostOpSleutel('optie:slopen:afvalcontainer')).toBeNull();
    const koppelingen = t.db
      .prepare(
        "SELECT COUNT(*) AS n FROM werkzaamheid_soortwerk WHERE werkzaamheid_id = 'start-werk-dakgoot_vervangen'",
      )
      .get();
    expect(koppelingen).toEqual({ n: 0 });
  });

  it('een item dat in een offerte staat kan niet verwijderd worden (wel verborgen)', () => {
    const id = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
    bewaarInvoer({ id, invoer: legeKlusInvoer() }, 30);
    gebruik.waarde = { werkzaamheden: ['slopen'], opties: ['afvalcontainer'], materialen: ['eps'] };
    const set = haalWerkzaamheden();
    expect(werk(set, 'slopen')?.inGebruik).toBe(true);
    expect(werk(set, 'slopen')?.opties[0]?.inGebruik).toBe(true);
    expect(materiaal(set, 'eps')?.inGebruik).toBe(true);
    expect(werk(set, 'isoleren')?.inGebruik).toBe(false);

    const invoer = alsInvoer(set);
    const zonder = (deel: Partial<WerkzaamhedenBewaar>) => () => bewaarWerkzaamheden({ ...invoer, ...deel });
    const melding = VALIDATIE_MELDINGEN.werkInGebruik;
    expect(fout(zonder({ werkzaamheden: invoer.werkzaamheden.slice(1) })).melding).toBe(melding);
    expect(
      fout(
        zonder({ werkzaamheden: invoer.werkzaamheden.map((w, i) => (i === 0 ? { ...w, opties: [] } : w)) }),
      ).melding,
    ).toBe(melding);
    expect(
      fout(
        zonder({
          materialen: invoer.materialen.filter((m) => m.id !== 'start-mat-eps'),
          werkzaamheden: invoer.werkzaamheden.map((w) => ({
            ...w,
            materialen: w.materialen.filter((m) => m.materiaalId !== 'start-mat-eps'),
          })),
        }),
      ).melding,
    ).toBe(melding);
    // Verbergen mag wel; er is niets veranderd door de geweigerde pogingen.
    const verborgen = bewaarWerkzaamheden({
      ...invoer,
      werkzaamheden: invoer.werkzaamheden.map((w, i) => (i === 0 ? { ...w, verborgen: true } : w)),
    });
    expect(werk(verborgen, 'slopen')).toMatchObject({
      verborgen: true,
      opties: [{ sleutel: 'afvalcontainer' }],
    });
    // Een offerte in de prullenbak telt niet: dat regelt de query (verwijderd_op IS NULL).
    t.db.prepare("UPDATE offertes SET verwijderd_op = 'x'").run();
    expect(werk(haalWerkzaamheden(), 'slopen')?.inGebruik).toBe(false);
  });

  it('VALIDATIE bij lege naam, dubbele id, onbekende koppeling of twee standaardmaterialen', () => {
    const invoer = alsInvoer(haalWerkzaamheden());
    const [eerste, ...rest] = invoer.werkzaamheden;
    const met = (w: Partial<(typeof invoer.werkzaamheden)[number]>) => () =>
      bewaarWerkzaamheden({ ...invoer, werkzaamheden: [{ ...eerste!, ...w }, ...rest] });
    const m = VALIDATIE_MELDINGEN;
    expect(fout(met({ label: '   ' })).melding).toBe(m.werkLeegLabel);
    expect(
      fout(() => bewaarWerkzaamheden({ ...invoer, materialen: [{ ...invoer.materialen[0]!, label: '' }] }))
        .melding,
    ).toBe(m.werkLeegLabel);
    expect(fout(() => bewaarWerkzaamheden({ ...invoer, werkzaamheden: [eerste!, eerste!] })).melding).toBe(
      m.werkDubbel,
    );
    expect(
      fout(() =>
        bewaarWerkzaamheden({ ...invoer, materialen: [...invoer.materialen, invoer.materialen[0]!] }),
      ).melding,
    ).toBe(m.werkDubbel);
    expect(fout(met({ opties: [...eerste!.opties, ...eerste!.opties] })).melding).toBe(m.werkDubbel);
    expect(
      fout(
        met({
          materialen: [
            { materiaalId: 'start-mat-eps', standaard: false },
            { materiaalId: 'start-mat-eps', standaard: false },
          ],
        }),
      ).melding,
    ).toBe(m.werkDubbel);
    expect(fout(met({ soortenWerk: ['bestaat_niet'] })).melding).toBe(m.werkOnbekendeKoppeling);
    expect(fout(met({ materialen: [{ materiaalId: 'bestaat-niet', standaard: false }] })).melding).toBe(
      m.werkOnbekendeKoppeling,
    );
    // Een optie van een andere werkzaamheid kan niet verhuizen.
    const tweede = rest[0]!;
    expect(
      fout(() =>
        bewaarWerkzaamheden({
          ...invoer,
          werkzaamheden: [
            { ...eerste!, opties: [] },
            { ...tweede, opties: eerste!.opties },
            ...rest.slice(1),
          ],
        }),
      ).melding,
    ).toBe(m.werkOnbekendeKoppeling);
    expect(
      fout(
        met({
          materialen: [
            { materiaalId: 'start-mat-eps', standaard: true },
            { materiaalId: 'start-mat-pvc', standaard: true },
          ],
        }),
      ).melding,
    ).toBe(m.werkEenStandaard);
    expect(fout(met({ label: '' })).code).toBe('VALIDATIE');
  });

  it('een verwijderde soort werk neemt zijn koppelingen mee (FK)', () => {
    const lijst = lijstKeuzeopties().soortWerk;
    bewaarKeuzelijst(
      'soortWerk',
      lijst
        .filter((o) => o.sleutel !== 'reparatie')
        .map(({ id, label, verborgen, standaardkeuze }) => ({ id, label, verborgen, standaardkeuze })),
    );
    const set = haalWerkzaamheden();
    expect(set.soortenWerk.map((s) => s.sleutel)).not.toContain('reparatie');
    expect(werk(set, 'lekkage_opsporen')?.soortenWerk).toEqual(['onderhoud']);
  });
});

describe('werkzaamheden:herstel', () => {
  it('startitems terug met naam, volgorde, koppelingen en standaardmateriaal; eigen items en prijzen blijven', () => {
    const invoer = alsInvoer(haalWerkzaamheden());
    const [slopen, isoleren, ...rest] = invoer.werkzaamheden;
    const uit = bewaarWerkzaamheden({
      materialen: [
        { id: 'm-eigen', label: 'Eigen plaat', eenheid: 'm²', prijsCent: null, verborgen: false },
        ...invoer.materialen.filter((m) => m.id !== 'start-mat-pvc').map((m) => ({ ...m, verborgen: true })),
      ],
      werkzaamheden: [
        {
          id: 'w-eigen',
          label: 'Eigen werk',
          eenheid: 'uur',
          prijsCent: 5000,
          verborgen: false,
          soortenWerk: ['reparatie'],
          opties: [],
          materialen: [],
        },
        {
          ...isoleren!,
          label: 'Isolatie aanbrengen',
          prijsCent: 2500,
          soortenWerk: ['onderhoud'],
          materialen: [
            { materiaalId: 'm-eigen', standaard: true },
            { materiaalId: 'start-mat-pir_80', standaard: false },
          ],
        },
        { ...slopen!, opties: [] },
        ...rest
          .filter((w) => w.id !== 'start-werk-dakgoot_vervangen')
          .map((w) => ({
            ...w,
            materialen: w.materialen.filter((m) => m.materiaalId !== 'start-mat-pvc'),
          })),
      ],
    });
    expect(werk(uit, 'dakgoot_vervangen')).toBeUndefined();

    herstelWerkzaamheden();
    const set = haalWerkzaamheden();
    expect(set.werkzaamheden.map((w) => w.sleutel)).toEqual([
      'slopen',
      'isoleren',
      'nieuwe_bedekking',
      'dakrand_afwerking',
      'hemelwaterafvoer',
      'lekkage_opsporen',
      'plaatselijk_herstel',
      'dakgoot_vervangen',
      'eigen_werk',
    ]);
    expect(werk(set, 'isoleren')).toMatchObject({
      label: 'Isoleren',
      prijsCent: 2500,
      soortenWerk: ['nieuw_dak', 'dak_vervangen', 'isolatie', 'onderhoud'],
    });
    const standaard = werk(set, 'isoleren')?.materialen.filter((m) => m.standaard);
    expect(standaard).toEqual([{ materiaalId: 'start-mat-pir_80', standaard: true }]);
    expect(werk(set, 'isoleren')?.materialen).toContainEqual({ materiaalId: 'm-eigen', standaard: false });
    expect(werk(set, 'slopen')?.opties.map((o) => o.sleutel)).toEqual(['afvalcontainer']);
    expect(werk(set, 'nieuwe_bedekking')?.materialen.map((m) => m.materiaalId)).toContain('start-mat-pvc');
    expect(set.materialen.at(-1)).toMatchObject({ sleutel: 'eigen_plaat', standaard: false });
    expect(set.materialen.slice(0, 9).every((m) => !m.verborgen && m.standaard)).toBe(true);
    expect(werk(set, 'eigen_werk')?.prijsCent).toBe(5000);
    expect(haalPrijspostOpSleutel('werk:dakgoot_vervangen')?.prijsCent).toBeNull();
  });
});

describe('prijsposten van werkzaamheden (tab Prijzen)', () => {
  it('prijs en btw aanpasbaar; naam en eenheid blijven die van het item; verwijderen kan niet', () => {
    const post = haalPrijspostOpSleutel('werk:slopen')!;
    bewaarPrijspost({ ...post, omschrijving: 'Anders', eenheid: 'dag', prijsCent: 1500, btwTarief: 9 });
    expect(haalPrijspostOpSleutel('werk:slopen')).toMatchObject({
      omschrijving: 'Slopen',
      eenheid: 'm²',
      prijsCent: 1500,
      btwTarief: 9,
    });
    expect(werk(haalWerkzaamheden(), 'slopen')?.prijsCent).toBe(1500);
    expect(fout(() => verwijderPrijspost(post.id)).melding).toBe(VALIDATIE_MELDINGEN.werkPrijspostVast);
    // Gewone posten blijven gewoon te hernoemen en te verwijderen.
    const sloop = haalPrijspostOpSleutel('sloop')!;
    bewaarPrijspost({ ...sloop, omschrijving: 'Sloopwerk' });
    expect(haalPrijspostOpSleutel('sloop')?.omschrijving).toBe('Sloopwerk');
    verwijderPrijspost(sloop.id);
    expect(haalPrijspostOpSleutel('sloop')).toBeNull();
    verwijderPrijspost('bestaat-niet');
  });
});

describe('offerte:bewaarInvoer met werkzaamheden (OFM-044)', () => {
  const gw = (deel: Partial<GekozenWerkzaamheid> = {}): GekozenWerkzaamheid => ({
    id: 'g1',
    sleutel: 'slopen',
    eenmalig: null,
    aantal: 20,
    prijsCent: 1500,
    notitie: '',
    materialen: [],
    opties: [],
    ...deel,
  });
  const bewaar = (id: string, werkzaamheden: GekozenWerkzaamheid[]) =>
    bewaarInvoer({ id, invoer: { ...legeKlusInvoer(), werkzaamheden } }, 30);

  it('bekende sleutels en eenmalige items mogen; onbekend geeft VALIDATIE; wat er al stond blijft mogen', () => {
    const id = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
    const goed = gw({
      opties: [{ sleutel: 'afvalcontainer', prijsCent: null }],
      materialen: [
        { id: 'm1', sleutel: 'pir_80', eenmalig: null, aantal: 1, prijsCent: null },
        { id: 'm2', sleutel: null, eenmalig: { label: '', eenheid: 'm¹' }, aantal: 1, prijsCent: null },
      ],
    });
    const eenmalig = gw({ id: 'g2', sleutel: null, eenmalig: { label: '', eenheid: 'post' } });
    bewaar(id, [goed, eenmalig]);
    const melding = VALIDATIE_MELDINGEN.onbekendeKeuze;
    expect(fout(() => bewaar(id, [gw({ sleutel: 'bestaat_niet' })])).melding).toBe(melding);
    expect(
      fout(() =>
        bewaar(id, [
          gw({ materialen: [{ id: 'm', sleutel: 'weg', eenmalig: null, aantal: 1, prijsCent: null }] }),
        ]),
      ).melding,
    ).toBe(melding);
    // Een optie hoort bij zijn eigen werkzaamheid.
    expect(
      fout(() =>
        bewaar(id, [gw({ sleutel: 'isoleren', opties: [{ sleutel: 'afvalcontainer', prijsCent: null }] })]),
      ).melding,
    ).toBe(melding);

    // In gebruik: niet te verwijderen. Daarna verwijderd (na verbergen kan dat niet) → de oude waarde blijft geldig.
    expect(werk(haalWerkzaamheden(), 'slopen')?.inGebruik).toBe(true);
    const set = haalWerkzaamheden();
    const zonderSlopen = alsInvoer(set);
    zonderSlopen.werkzaamheden = zonderSlopen.werkzaamheden.filter((w) => w.id !== 'start-werk-slopen');
    expect(fout(() => bewaarWerkzaamheden(zonderSlopen)).melding).toBe(VALIDATIE_MELDINGEN.werkInGebruik);
    t.db.prepare("DELETE FROM werkzaamheden WHERE sleutel = 'slopen'").run();
    bewaar(id, [goed]);
  });
});

describe('kanalen werkzaamheden:*', () => {
  const event = {} as Parameters<ReturnType<typeof maakIpcHandler>>[0];

  it('haal, bewaar en herstel via maakIpcHandler', async () => {
    const haal = await maakIpcHandler('werkzaamheden:haal', werkzaamhedenHandlers['werkzaamheden:haal'])(
      event,
      undefined,
    );
    expect(haal.ok).toBe(true);
    const set = (haal as { data: WerkzaamhedenSet }).data;
    const bewaar = maakIpcHandler('werkzaamheden:bewaar', werkzaamhedenHandlers['werkzaamheden:bewaar']);
    const invoer = alsInvoer(set);
    expect(await bewaar(event, invoer)).toEqual({ ok: true, data: set });
    expect(
      await bewaar(event, { ...invoer, werkzaamheden: [{ ...invoer.werkzaamheden[0]!, label: '' }] }),
    ).toEqual({ ok: false, fout: { code: 'VALIDATIE', melding: VALIDATIE_MELDINGEN.werkLeegLabel } });
    expect(await bewaar(event, { werkzaamheden: [{ id: 'x' }], materialen: [] })).toMatchObject({
      ok: false,
      fout: { code: 'VALIDATIE' },
    });
    const herstel = maakIpcHandler('werkzaamheden:herstel', werkzaamhedenHandlers['werkzaamheden:herstel']);
    expect(await herstel(event, undefined)).toEqual({ ok: true, data: null });
  });
});
