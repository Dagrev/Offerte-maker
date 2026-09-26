import { describe, expect, it } from 'vitest';
import { bedragWerkzaamheidCent, berekenTotalen } from './calc/bedragen';
import { heeftOudeVelden, OUDE_VELDEN, zetOmNaarWerkzaamheden, type OmzetBron } from './omzetting';
import { PRIJS_STARTSET } from './prijsStartset';
import { klusInvoerSchema } from './schemas';
import type { GekozenWerkzaamheid, Offerteregel } from './types';
import { MATERIALEN_STARTSET, WERKZAAMHEDEN_STARTSET } from './werkzaamheden';

// OFM-045: omzetting van de oude stap Extra's naar werkzaamheden (A-30, TDO §9.7).

const PRIJZEN: Record<string, number> = {
  sloop: 1200,
  dampremmer: 450,
  isolatie_80: 2800,
  epdm_15: 4550,
  daktrim: 3500,
  hwa: 8500,
  grind: 900,
};

const prijsposten: OmzetBron['prijsposten'] = [
  ...PRIJS_STARTSET.map((p) => ({
    id: `start-${p.sleutel}`,
    sleutel: p.sleutel,
    omschrijving: p.omschrijving,
    eenheid: p.eenheid,
    prijsCent: PRIJZEN[p.sleutel] ?? null,
  })),
  { id: 'eigen', sleutel: null, omschrijving: 'Eigen post', eenheid: 'post', prijsCent: 100 },
];

const catalogus: OmzetBron['catalogus'] = {
  werkzaamheden: WERKZAAMHEDEN_STARTSET,
  materialen: MATERIALEN_STARTSET,
};

const labels: OmzetBron['labels'] = {
  bedekking: [
    { sleutel: 'epdm_15', label: 'EPDM 1,5 mm' },
    { sleutel: 'bitumen', label: 'Bitumen' },
  ],
  isolatie: [{ sleutel: '80', label: '80 mm (Rc 3,5)' }],
  extras: [
    { sleutel: 'daktrim', label: 'Daktrim en dakranden' },
    { sleutel: 'hwa', label: 'Hemelwaterafvoeren' },
    { sleutel: 'dakkapel', label: 'Dakkapel aansluiten' },
    { sleutel: 'leeg', label: 'Zonder aantal' },
  ],
  afwerking: [{ sleutel: 'grind', label: 'Grind' }],
};

const vlak = (m2: number) => ({
  id: 'v1',
  naam: 'Dak',
  modus: 'm2' as const,
  lengteM: null,
  breedteM: null,
  m2,
});

const basis = {
  soortWerk: 'dak_vervangen',
  soortDak: 'plat',
  dakvlakken: [vlak(50)],
  huidigeBedekking: null,
  ondergrond: null,
  hoogte: '1',
  steigerNodig: true,
  garantieJaren: '10',
  gewensteUitvoering: '',
  overig: '',
};

let n = 0;
const maakId = () => `id${++n}`;

function regel(sleutel: string, aantal: number, prijsCent: number, id = sleutel): Offerteregel {
  const post = prijsposten.find((p) => p.sleutel === sleutel);
  return {
    id,
    omschrijving: post?.omschrijving ?? sleutel,
    aantalHonderdsten: Math.round(aantal * 100),
    eenheid: post?.eenheid ?? 'm²',
    prijsCent,
    btwTarief: 21,
    prijsbron: 'prijslijst',
    prijspostId: post?.id ?? null,
  };
}

const bron = (deel: Partial<OmzetBron> = {}): OmzetBron => ({
  catalogus,
  labels,
  prijsposten,
  regels: [],
  maakId,
  ...deel,
});

describe('heeftOudeVelden', () => {
  it('ja zodra één oud veld aanwezig is (ook met een lege waarde), anders nee', () => {
    expect(heeftOudeVelden(basis)).toBe(false);
    for (const veld of OUDE_VELDEN) expect(heeftOudeVelden({ ...basis, [veld]: null })).toBe(true);
  });
});

describe('zetOmNaarWerkzaamheden (A-30)', () => {
  const oud = {
    ...basis,
    bedekking: 'epdm_15',
    bedekkingAnders: '',
    slopenEnAfvoeren: true,
    isolatie: '80',
    isolatieAndersMm: null,
    daktrimM1: 12,
    dakgootM1: 0,
    hwaAantal: 2,
    noodoverloopAantal: 0,
    doorvoerAantal: 0,
    lichtkoepelAantal: 0,
    afwerking: 'grind',
    extraAantallen: {},
  };
  // Zoals een oude definitieve offerte: epdm met de hand op € 48,00, hwa met een ander aantal.
  const regels = [
    regel('sloop', 50, 1200),
    regel('dampremmer', 50, 450),
    regel('isolatie_80', 50, 2800),
    regel('epdm_15', 50, 4800),
    regel('daktrim', 12, 3500),
    regel('hwa', 3, 8500),
    regel('grind', 50, 900),
    regel('steiger', 1, 45000),
    regel('voorrijkosten', 1, 7500),
  ];

  it('elke oude keuze wordt één regel in de nieuwe structuur, met aantal en prijs van de offerte', () => {
    n = 0;
    const nieuw = zetOmNaarWerkzaamheden(oud, bron({ regels }));
    for (const veld of OUDE_VELDEN) expect(nieuw).not.toHaveProperty(veld);
    expect(nieuw.soortWerk).toBe('dak_vervangen');
    const kaal = nieuw.werkzaamheden.map((w) => ({
      sleutel: w.sleutel,
      eenmalig: w.eenmalig,
      aantal: w.aantal,
      prijsCent: w.prijsCent,
      materialen: w.materialen.map((m) => [m.sleutel ?? m.eenmalig?.label, m.aantal, m.prijsCent]),
    }));
    expect(kaal).toEqual([
      { sleutel: 'slopen', eenmalig: null, aantal: 50, prijsCent: 1200, materialen: [] },
      {
        sleutel: 'isoleren',
        eenmalig: null,
        aantal: 50,
        prijsCent: 0,
        materialen: [
          ['Dampremmende laag', 50, 450],
          ['Isolatie PIR 80 mm (Rc 3,5)', 50, 2800],
        ],
      },
      {
        sleutel: 'nieuwe_bedekking',
        eenmalig: null,
        aantal: 50,
        prijsCent: 0,
        materialen: [['EPDM dakbedekking 1,5 mm', 50, 4800]],
      },
      {
        sleutel: null,
        eenmalig: { label: 'Aluminium daktrim', eenheid: 'm¹' },
        aantal: 12,
        prijsCent: 3500,
        materialen: [],
      },
      {
        sleutel: null,
        eenmalig: { label: 'Hemelwaterafvoer aansluiten', eenheid: 'stuk' },
        aantal: 3,
        prijsCent: 8500,
        materialen: [],
      },
      {
        sleutel: 'dakrand_afwerking',
        eenmalig: null,
        aantal: 1,
        prijsCent: 0,
        materialen: [['Grindafwerking', 50, 900]],
      },
    ]);
    expect(nieuw.werkzaamheden.every((w) => w.notitie === '' && w.opties.length === 0)).toBe(true);
    expect(klusInvoerSchema.safeParse(nieuw).success).toBe(true);
  });

  it('het totaal blijft gelijk: werkzaamheden + steiger + voorrijkosten = de oude regels', () => {
    const nieuw = zetOmNaarWerkzaamheden(oud, bron({ regels }));
    const werk = nieuw.werkzaamheden.reduce((som, w) => som + bedragWerkzaamheidCent(w), 0);
    const oudZonderRest = berekenTotalen(regels.slice(0, 7)).subtotaalCent;
    expect(werk).toBe(oudZonderRest);
  });

  it('zonder regels (concept zonder inhoud): aantal uit de invoer, prijs uit de prijslijst', () => {
    const nieuw = zetOmNaarWerkzaamheden(oud, bron());
    expect(nieuw.werkzaamheden.map((w) => [w.aantal, w.prijsCent, w.materialen[0]?.prijsCent])).toEqual([
      [50, 1200, undefined],
      [50, 0, 450],
      [50, 0, 4550],
      [12, 3500, undefined],
      [2, 8500, undefined],
      [1, 0, 900],
    ]);
  });

  it('een regel met een negatief bedrag of aantal telt niet als bron', () => {
    const nieuw = zetOmNaarWerkzaamheden(
      { ...basis, slopenEnAfvoeren: true },
      bron({ regels: [regel('sloop', 50, -100, 'a'), { ...regel('sloop', -1, 100, 'b') }] }),
    );
    expect(nieuw.werkzaamheden[0]).toMatchObject({ aantal: 50, prijsCent: 1200 });
  });

  it('twee regels van dezelfde post: de eerste passende regel wint', () => {
    const nieuw = zetOmNaarWerkzaamheden(
      { ...basis, hwaAantal: 2 },
      bron({ regels: [regel('hwa', 2, 8000, 'h1'), regel('hwa', 2, 9000, 'h2')] }),
    );
    expect(nieuw.werkzaamheden.map((w) => w.prijsCent)).toEqual([8000]);
  });
});

describe('"anders", eigen keuzes en ontbrekende gegevens', () => {
  it('isolatie en bedekking anders: eigen regels op omschrijving, zonder post', () => {
    const invoer = {
      ...basis,
      isolatie: 'anders',
      isolatieAndersMm: 90,
      bedekking: 'anders',
      bedekkingAnders: '  Kunststof  ',
    };
    const eigen = (omschrijving: string, prijsCent: number): Offerteregel => ({
      ...regel('x', 50, prijsCent),
      omschrijving,
      prijspostId: null,
    });
    const nieuw = zetOmNaarWerkzaamheden(
      invoer,
      bron({ regels: [eigen('Isolatie 90 mm', 1500), eigen(' Kunststof ', 0), eigen('Kunststof', 3000)] }),
    );
    const [isoleren, bedekking] = nieuw.werkzaamheden;
    expect(isoleren?.materialen[1]).toMatchObject({
      sleutel: null,
      eenmalig: { label: 'Isolatie 90 mm', eenheid: 'm²' },
      prijsCent: 1500,
    });
    // " Kunststof " is na trimmen gelijk aan het label: de eerste passende regel wint.
    expect(bedekking?.materialen[0]).toMatchObject({ eenmalig: { label: 'Kunststof' }, prijsCent: 0 });
  });

  it('zonder dikte "Isolatie", lege bedekking "Dakbedekking"; zonder regel geen prijs', () => {
    const nieuw = zetOmNaarWerkzaamheden(
      { ...basis, isolatie: 'anders', isolatieAndersMm: null, bedekking: 'anders' },
      bron(),
    );
    expect(nieuw.werkzaamheden[0]?.materialen[1]).toMatchObject({
      eenmalig: { label: 'Isolatie' },
      prijsCent: null,
    });
    expect(nieuw.werkzaamheden[1]?.materialen[0]).toMatchObject({
      eenmalig: { label: 'Dakbedekking' },
      prijsCent: null,
    });
  });

  it('een materiaal met dezelfde sleutel in de instellingen wordt een verwijzing', () => {
    const nieuw = zetOmNaarWerkzaamheden({ ...basis, bedekking: 'bitumen' }, bron());
    expect(nieuw.werkzaamheden[0]?.materialen[0]).toMatchObject({ sleutel: 'bitumen', eenmalig: null });
  });

  it('zelf toegevoegde isolatie, extra zonder post en onbekende labels', () => {
    const nieuw = zetOmNaarWerkzaamheden(
      {
        ...basis,
        isolatie: '160_mm',
        afwerking: 'tegels',
        doorvoerAantal: 0,
        extraAantallen: { dakkapel: 2, weg: 1, nul: 0 },
      },
      bron({ labels: {} }),
    );
    expect(nieuw.werkzaamheden.map((w) => w.eenmalig?.label ?? w.sleutel)).toEqual([
      'isoleren',
      'dakkapel',
      'weg',
      'dakrand_afwerking',
    ]);
    expect(nieuw.werkzaamheden[0]?.materialen[1]).toMatchObject({
      eenmalig: { label: 'Isolatie 160_mm', eenheid: 'm²' },
      prijsCent: null,
    });
    expect(nieuw.werkzaamheden[1]).toMatchObject({ aantal: 2, eenmalig: { eenheid: 'stuk' } });
    expect(nieuw.werkzaamheden[3]?.materialen[0]).toMatchObject({ eenmalig: { label: 'tegels' } });
  });

  it("extra's volgen de lijst; een extra in de lijst zonder aantal valt weg", () => {
    const nieuw = zetOmNaarWerkzaamheden(
      { ...basis, extraAantallen: { dakkapel: 1 }, daktrimM1: 2.5, dakgootM1: 3 },
      bron(),
    );
    expect(nieuw.werkzaamheden.map((w) => [w.eenmalig?.label, w.aantal, w.eenmalig?.eenheid])).toEqual([
      ['Aluminium daktrim', 2.5, 'm¹'],
      ['Dakkapel aansluiten', 1, 'stuk'],
      ['EPDM dakgoot', 3, 'm¹'],
    ]);
  });

  it('zonder werkzaamheden in de instellingen: eenmalige werkzaamheden met de naam uit de startset', () => {
    const nieuw = zetOmNaarWerkzaamheden(
      { ...basis, slopenEnAfvoeren: true, afwerking: 'grind' },
      bron({ catalogus: { werkzaamheden: [], materialen: [] } }),
    );
    expect(nieuw.werkzaamheden.map((w) => w.eenmalig)).toEqual([
      { label: 'Slopen en afvoeren oude dakbedekking', eenheid: 'm²' },
      { label: 'Dakrand en afwerking', eenheid: 'm¹' },
    ]);
  });

  it('bestaande werkzaamheden blijven vooraan; zonder dakvlakken is het aantal 0; lange namen ingekort', () => {
    const bestaand: GekozenWerkzaamheid = {
      id: 'w0',
      sleutel: 'slopen',
      eenmalig: null,
      aantal: 1,
      prijsCent: null,
      notitie: '',
      materialen: [],
      opties: [],
    };
    const { dakvlakken: _weg, ...zonderVlakken } = basis;
    void _weg;
    const nieuw = zetOmNaarWerkzaamheden(
      { ...zonderVlakken, werkzaamheden: [bestaand], bedekking: 'anders', bedekkingAnders: 'x'.repeat(100) },
      { catalogus, labels, prijsposten, regels: [] },
    );
    expect(nieuw.werkzaamheden[0]).toBe(bestaand);
    expect(nieuw.werkzaamheden[1]?.aantal).toBe(0);
    expect(nieuw.werkzaamheden[1]?.materialen[0]?.eenmalig?.label).toHaveLength(80);
    // Zonder maakId: echte UUID's.
    expect(nieuw.werkzaamheden[1]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('afwerking en isolatie "geen" en geen bedekking: geen werkzaamheden', () => {
    const nieuw = zetOmNaarWerkzaamheden(
      { ...basis, isolatie: 'geen', afwerking: 'geen', bedekking: null },
      bron(),
    );
    expect(nieuw.werkzaamheden).toEqual([]);
  });
});
