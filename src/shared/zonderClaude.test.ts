import { describe, expect, it } from 'vitest';
import { KEUZE_STARTSET, type Keuzes } from './keuzelijsten';
import { CATALOGUS, gekozen } from '../../test/helpers/werkCatalogus';
import { legeKlusInvoer } from './nieuweOfferte';
import { PRIJS_STARTSET } from './prijsStartset';
import type { KlusInvoer, Prijspost } from './types';
import { maakInhoudZonderClaude, planRegels, titelZonderClaude, vulPrijsIn } from './zonderClaude';

// OFM-025: elke voorwaarde uit de tabel in §9.5 en elke titelvariant uit V-09 (§15.4).

/** Startset als prijsposten; `prijzen` geeft per sleutel een prijs in centen. */
function posten(prijzen: Record<string, number> = {}, weg: string[] = []): (s: string) => Prijspost | null {
  return (sleutel) => {
    const start = PRIJS_STARTSET.find((p) => p.sleutel === sleutel);
    if (!start || weg.includes(sleutel)) return null;
    return {
      id: `start-${sleutel}`,
      sleutel,
      omschrijving: start.omschrijving,
      eenheid: start.eenheid,
      prijsCent: prijzen[sleutel] ?? null,
      btwTarief: start.btwTarief,
      volgorde: 0,
    };
  };
}

function invoer(deel: Partial<KlusInvoer> = {}): KlusInvoer {
  return {
    ...legeKlusInvoer(),
    dakvlakken: [
      { id: 'v1', naam: 'Dakvlak 1', modus: 'lxb', lengteM: 5, breedteM: 4.5, m2: null },
      { id: 'v2', naam: 'Dakvlak 2', modus: 'm2', lengteM: null, breedteM: null, m2: 12.25 },
    ],
    ...deel,
  };
}

const TEKSTEN = { inleiding: 'Inleiding', afsluiting: 'Afsluiting' };
let n = 0;
const maakId = () => `r${++n}`;

describe('planRegels (§9.5, na de werkzaamheden)', () => {
  it('lege invoer: alleen voorrijkosten', () => {
    expect(planRegels(invoer())).toEqual([{ sleutel: 'voorrijkosten', aantal: 1 }]);
  });

  it('steiger en verzekerde garantie, in de volgorde van de tabel', () => {
    expect(planRegels(invoer({ steigerNodig: true, garantieJaren: '20' }))).toEqual([
      { sleutel: 'steiger', aantal: 1 },
      { sleutel: 'verzekerde_garantie', aantal: 1 },
      { sleutel: 'voorrijkosten', aantal: 1 },
    ]);
  });

  it('garantie 10 of een zelf toegevoegde garantie geeft geen post', () => {
    expect(planRegels(invoer({ garantieJaren: '15_jaar' }))).toEqual([
      { sleutel: 'voorrijkosten', aantal: 1 },
    ]);
  });
});

describe('titelZonderClaude (V-09)', () => {
  it.each([
    [null, null, 'Offerte'],
    ['dak_vervangen', null, 'Offerte dak vervangen'],
    [null, 'plat', 'Offerte plat dak'],
    ['dak_vervangen', 'plat', 'Offerte dak vervangen plat dak'],
    ['nieuw_dak', 'hellend', 'Offerte nieuw dak hellend dak'],
  ] as const)('%s + %s → %s', (soortWerk, soortDak, titel) => {
    expect(titelZonderClaude({ soortWerk, soortDak }, KEUZE_STARTSET)).toBe(titel);
  });
});

describe('maakInhoudZonderClaude (V-09, V-27)', () => {
  it('post mét prijs: prijslijst, prijs/eenheid/btw van de post, geen controlepunt', () => {
    const inhoud = maakInhoudZonderClaude({
      invoer: invoer(),
      keuzes: KEUZE_STARTSET,
      postOpSleutel: posten({ voorrijkosten: 4500 }),
      teksten: TEKSTEN,
      maakId,
    });
    expect(inhoud.regels).toEqual([
      {
        id: expect.any(String) as string,
        omschrijving: 'Voorrijkosten',
        aantalHonderdsten: 100,
        eenheid: 'post',
        prijsCent: 4500,
        btwTarief: 21,
        prijsbron: 'prijslijst',
        prijspostId: 'start-voorrijkosten',
      },
    ]);
    expect(inhoud.controlepunten).toEqual([]);
  });

  it('zonder prijs en verwijderde startpost: schatting, prijs 0, btw 21, controlepunt', () => {
    const inhoud = maakInhoudZonderClaude({
      invoer: invoer({ steigerNodig: true, garantieJaren: '20' }),
      keuzes: KEUZE_STARTSET,
      postOpSleutel: posten({ voorrijkosten: 4500 }, ['steiger']),
      teksten: TEKSTEN,
      maakId,
    });
    const [steiger, garantie, voorrij] = inhoud.regels;
    expect(steiger).toMatchObject({
      omschrijving: 'Steiger en valbeveiliging',
      eenheid: 'post',
      aantalHonderdsten: 100,
      prijsCent: 0,
      btwTarief: 21,
      prijsbron: 'schatting',
      prijspostId: null,
    });
    expect(garantie).toMatchObject({
      prijsbron: 'schatting',
      prijsCent: 0,
      prijspostId: 'start-verzekerde_garantie',
    });
    expect(voorrij).toMatchObject({ prijsbron: 'prijslijst' });
    expect(inhoud.controlepunten).toEqual([
      vulPrijsIn('Steiger en valbeveiliging'),
      vulPrijsIn('Verzekerde garantie 20 jaar'),
    ]);
  });

  it('verwijderde startpost: omschrijving en eenheid uit de startset', () => {
    const inhoud = maakInhoudZonderClaude({
      invoer: invoer(),
      keuzes: KEUZE_STARTSET,
      postOpSleutel: posten({}, ['voorrijkosten']),
      teksten: TEKSTEN,
      maakId,
    });
    expect(inhoud.regels[0]).toMatchObject({ omschrijving: 'Voorrijkosten', eenheid: 'post' });
  });

  it('teksten volgens §9.5', () => {
    const basis = { keuzes: KEUZE_STARTSET, postOpSleutel: posten(), teksten: TEKSTEN, maakId };
    const met = maakInhoudZonderClaude({
      ...basis,
      invoer: invoer({
        soortWerk: 'reparatie',
        gewensteUitvoering: ' Voor de winter ',
        overig: 'Let op de kat',
      }),
    });
    expect(met).toMatchObject({
      titel: 'Offerte reparatie',
      inleiding: 'Inleiding',
      afsluiting: 'Afsluiting',
      uitvoering: 'Voor de winter',
      opmerkingen: 'Let op de kat',
    });
    expect(met.werkomschrijving).toEqual(met.regels.map((r) => r.omschrijving));
    expect(maakInhoudZonderClaude({ ...basis, invoer: invoer() }).uitvoering).toBe('In overleg.');
  });

  it('zonder maakId unieke regel-id’s', () => {
    const inhoud = maakInhoudZonderClaude({
      invoer: invoer({ steigerNodig: true }),
      keuzes: KEUZE_STARTSET,
      postOpSleutel: posten(),
      teksten: TEKSTEN,
    });
    expect(new Set(inhoud.regels.map((r) => r.id)).size).toBe(inhoud.regels.length);
  });
});

describe('hernoemde keuzes (OFM-034)', () => {
  it('titel met het hernoemde label', () => {
    const keuzes: Keuzes = {
      ...KEUZE_STARTSET,
      soortWerk: [{ sleutel: 'nieuw_dak', label: 'Compleet nieuw dak' }],
    };
    expect(titelZonderClaude({ soortWerk: 'nieuw_dak', soortDak: 'plat' }, keuzes)).toBe(
      'Offerte compleet nieuw dak plat dak',
    );
  });
});

describe('werkzaamheden (OFM-044)', () => {
  /** Posten van werkzaamheden, materialen en opties; `prijzen` per sleutel. */
  const werkPosten =
    (prijzen: Record<string, number | null>) =>
    (sleutel: string): Prijspost | null =>
      sleutel in prijzen
        ? {
            id: `post-${sleutel}`,
            sleutel,
            omschrijving: sleutel,
            eenheid: 'stuk',
            prijsCent: prijzen[sleutel] ?? null,
            btwTarief: sleutel === 'mat:pir_80' ? 9 : 21,
            volgorde: 0,
          }
        : posten()(sleutel);

  it('per werkzaamheid een regel met materialen en opties als subregels; prijsbron volgt de prijs', () => {
    n = 0;
    const inhoud = maakInhoudZonderClaude({
      invoer: invoer({
        werkzaamheden: [
          gekozen({
            notitie: 'Asbest vooraf laten keuren',
            opties: [{ sleutel: 'afvalcontainer', prijsCent: 30000 }],
            materialen: [
              { id: 'm1', sleutel: 'pir_80', eenmalig: null, aantal: 20, prijsCent: 1800 },
              {
                id: 'm2',
                sleutel: null,
                eenmalig: { label: 'Zink', eenheid: 'm¹' },
                aantal: 4,
                prijsCent: null,
              },
            ],
          }),
        ],
      }),
      keuzes: KEUZE_STARTSET,
      catalogus: CATALOGUS,
      postOpSleutel: werkPosten({
        'werk:slopen': 1200,
        'mat:pir_80': 1500,
        'optie:slopen:afvalcontainer': null,
      }),
      teksten: TEKSTEN,
      maakId,
    });
    expect(inhoud.regels.slice(0, 4)).toEqual([
      {
        id: 'r1',
        omschrijving: 'Slopen',
        aantalHonderdsten: 2000,
        eenheid: 'm²',
        prijsCent: 1200,
        btwTarief: 21,
        prijsbron: 'prijslijst',
        prijspostId: 'post-werk:slopen',
      },
      {
        id: 'r2',
        omschrijving: 'PIR 80 mm',
        aantalHonderdsten: 2000,
        eenheid: 'm²',
        prijsCent: 1800,
        btwTarief: 9,
        prijsbron: 'handmatig',
        prijspostId: 'post-mat:pir_80',
        onderdeelVan: 'r1',
      },
      {
        id: 'r3',
        omschrijving: 'Zink',
        aantalHonderdsten: 400,
        eenheid: 'm¹',
        prijsCent: 0,
        btwTarief: 21,
        prijsbron: 'schatting',
        prijspostId: null,
        onderdeelVan: 'r1',
      },
      {
        id: 'r4',
        omschrijving: 'Afvalcontainer',
        aantalHonderdsten: 100,
        eenheid: 'stuk',
        prijsCent: 30000,
        btwTarief: 21,
        prijsbron: 'handmatig',
        prijspostId: 'post-optie:slopen:afvalcontainer',
        onderdeelVan: 'r1',
      },
    ]);
    expect(inhoud.regels.at(-1)?.omschrijving).toBe('Voorrijkosten');
    expect(inhoud.werkomschrijving).toEqual(['Slopen: Asbest vooraf laten keuren', 'Voorrijkosten']);
    expect(inhoud.controlepunten).toEqual([vulPrijsIn('Zink'), vulPrijsIn('Voorrijkosten')]);
  });

  it('zonder catalogus en post: de sleutel als naam, geen prijs = schatting', () => {
    const inhoud = maakInhoudZonderClaude({
      invoer: invoer({ werkzaamheden: [gekozen({ prijsCent: null })] }),
      keuzes: KEUZE_STARTSET,
      postOpSleutel: posten(),
      teksten: TEKSTEN,
      maakId,
    });
    expect(inhoud.regels[0]).toMatchObject({
      omschrijving: 'slopen',
      prijsbron: 'schatting',
      prijspostId: null,
    });
    expect(inhoud.werkomschrijving[0]).toBe('slopen');
  });
});
