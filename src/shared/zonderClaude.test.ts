import { describe, expect, it } from 'vitest';
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

const sleutels = (i: KlusInvoer) =>
  planRegels(i).map((p) => ('sleutel' in p ? p.sleutel : `eigen:${p.eigen}`));
const TEKSTEN = { inleiding: 'Inleiding', afsluiting: 'Afsluiting' };
let n = 0;
const maakId = () => `r${++n}`;

describe('planRegels (§9.5)', () => {
  it('lege invoer: alleen voorrijkosten', () => {
    expect(sleutels(invoer({ isolatie: 'geen', afwerking: 'geen' }))).toEqual(['voorrijkosten']);
  });

  it('alle voorwaarden in de volgorde van de tabel, met de juiste aantallen', () => {
    const i = invoer({
      slopenEnAfvoeren: true,
      isolatie: '100',
      bedekking: 'epdm_15',
      daktrimM1: 18.5,
      dakgootM1: 7,
      hwaAantal: 2,
      noodoverloopAantal: 1,
      doorvoerAantal: 3,
      lichtkoepelAantal: 1,
      afwerking: 'grind',
      steigerNodig: true,
      garantieJaren: 20,
    });
    expect(planRegels(i)).toEqual([
      { sleutel: 'sloop', aantal: 34.75 },
      { sleutel: 'dampremmer', aantal: 34.75 },
      { sleutel: 'isolatie_100', aantal: 34.75 },
      { sleutel: 'epdm_15', aantal: 34.75 },
      { sleutel: 'daktrim', aantal: 18.5 },
      { sleutel: 'dakgoot_epdm', aantal: 7 },
      { sleutel: 'hwa', aantal: 2 },
      { sleutel: 'noodoverloop', aantal: 1 },
      { sleutel: 'doorvoer', aantal: 3 },
      { sleutel: 'lichtkoepel', aantal: 1 },
      { sleutel: 'grind', aantal: 34.75 },
      { sleutel: 'steiger', aantal: 1 },
      { sleutel: 'verzekerde_garantie', aantal: 1 },
      { sleutel: 'voorrijkosten', aantal: 1 },
    ]);
  });

  it.each([
    ['80', 'isolatie_80'],
    ['100', 'isolatie_100'],
    ['120', 'isolatie_120'],
  ] as const)('isolatie %s: dampremmer + %s', (isolatie, post) => {
    expect(sleutels(invoer({ isolatie }))).toEqual(['dampremmer', post, 'voorrijkosten']);
  });

  it('isolatie anders: dampremmer + eigen regel "Isolatie <n> mm" (zonder dikte "Isolatie")', () => {
    expect(sleutels(invoer({ isolatie: 'anders', isolatieAndersMm: 140 }))).toEqual([
      'dampremmer',
      'eigen:Isolatie 140 mm',
      'voorrijkosten',
    ]);
    expect(sleutels(invoer({ isolatie: 'anders', isolatieAndersMm: null }))).toContain('eigen:Isolatie');
  });

  it.each(['epdm_11', 'epdm_15', 'resitrix', 'bitumen'] as const)('bedekking %s: eigen post', (bedekking) => {
    expect(sleutels(invoer({ bedekking }))).toEqual([bedekking, 'voorrijkosten']);
  });

  it('bedekking anders: eigen regel met de ingevulde tekst (leeg → "Dakbedekking")', () => {
    expect(sleutels(invoer({ bedekking: 'anders', bedekkingAnders: ' Zink ' }))).toEqual([
      'eigen:Zink',
      'voorrijkosten',
    ]);
    expect(sleutels(invoer({ bedekking: 'anders', bedekkingAnders: '' }))).toEqual([
      'eigen:Dakbedekking',
      'voorrijkosten',
    ]);
  });

  it('afwerking sedum; garantie 10 geeft geen garantiepost; nul-aantallen vallen weg', () => {
    expect(sleutels(invoer({ afwerking: 'sedum', garantieJaren: 10, hwaAantal: 0, daktrimM1: 0 }))).toEqual([
      'sedum',
      'voorrijkosten',
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
    expect(titelZonderClaude({ soortWerk, soortDak })).toBe(titel);
  });
});

describe('maakInhoudZonderClaude (V-09, V-27)', () => {
  it('post mét prijs: prijslijst, prijs/eenheid/btw van de post, geen controlepunt', () => {
    const inhoud = maakInhoudZonderClaude({
      invoer: invoer({ isolatie: 'geen', afwerking: 'geen' }),
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

  it('zonder prijs, verwijderde startpost en eigen regel: schatting, prijs 0, btw 21, controlepunt', () => {
    const inhoud = maakInhoudZonderClaude({
      invoer: invoer({
        slopenEnAfvoeren: true,
        isolatie: 'anders',
        isolatieAndersMm: 140,
        afwerking: 'geen',
      }),
      postOpSleutel: posten({ voorrijkosten: 4500 }, ['sloop']),
      teksten: TEKSTEN,
      maakId,
    });
    const [sloop, damp, isolatie, voorrij] = inhoud.regels;
    expect(sloop).toMatchObject({
      omschrijving: 'Slopen en afvoeren oude dakbedekking',
      eenheid: 'm²',
      aantalHonderdsten: 3475,
      prijsCent: 0,
      btwTarief: 21,
      prijsbron: 'schatting',
      prijspostId: null,
    });
    expect(damp).toMatchObject({ prijsbron: 'schatting', prijsCent: 0, prijspostId: 'start-dampremmer' });
    expect(isolatie).toMatchObject({
      omschrijving: 'Isolatie 140 mm',
      eenheid: 'm²',
      prijsbron: 'schatting',
      prijspostId: null,
    });
    expect(voorrij).toMatchObject({ prijsbron: 'prijslijst' });
    expect(inhoud.controlepunten).toEqual([
      vulPrijsIn('Slopen en afvoeren oude dakbedekking'),
      vulPrijsIn('Dampremmende laag'),
      'Vul de prijs in voor: Isolatie 140 mm',
    ]);
  });

  it('teksten volgens §9.5', () => {
    const basis = { postOpSleutel: posten(), teksten: TEKSTEN, maakId };
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
      postOpSleutel: posten(),
      teksten: TEKSTEN,
    });
    expect(new Set(inhoud.regels.map((r) => r.id)).size).toBe(inhoud.regels.length);
  });
});
