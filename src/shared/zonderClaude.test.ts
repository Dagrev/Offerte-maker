import { describe, expect, it } from 'vitest';
import { KEUZE_STARTSET, type Keuzes } from './keuzelijsten';
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
  planRegels(i, KEUZE_STARTSET).map((p) => ('sleutel' in p ? p.sleutel : `eigen:${p.eigen}`));
/** Alleen sleutel en aantal (label en eenheid zijn de terugval voor zelf toegevoegde opties). */
const kaal = (i: KlusInvoer, keuzes: Keuzes = KEUZE_STARTSET) =>
  planRegels(i, keuzes).map((p) => ('sleutel' in p ? { sleutel: p.sleutel, aantal: p.aantal } : p));
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
      garantieJaren: '20',
    });
    expect(kaal(i)).toEqual([
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
    expect(sleutels(invoer({ afwerking: 'sedum', garantieJaren: '10', hwaAantal: 0, daktrimM1: 0 }))).toEqual(
      ['sedum', 'voorrijkosten'],
    );
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
      invoer: invoer({ isolatie: 'geen', afwerking: 'geen' }),
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

  it('zonder prijs, verwijderde startpost en eigen regel: schatting, prijs 0, btw 21, controlepunt', () => {
    const inhoud = maakInhoudZonderClaude({
      invoer: invoer({
        slopenEnAfvoeren: true,
        isolatie: 'anders',
        isolatieAndersMm: 140,
        afwerking: 'geen',
      }),
      keuzes: KEUZE_STARTSET,
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

describe('zelf toegevoegde keuzes (OFM-034)', () => {
  const keuzes: Keuzes = {
    ...KEUZE_STARTSET,
    soortWerk: [{ sleutel: 'nieuw_dak', label: 'Compleet nieuw dak' }],
    bedekking: [...KEUZE_STARTSET.bedekking, { sleutel: 'leien', label: 'Leien' }],
    isolatie: [...KEUZE_STARTSET.isolatie, { sleutel: '160_mm', label: '160 mm' }],
    extras: [{ sleutel: 'dakkapel', label: 'Dakkapel aansluiten' }, ...KEUZE_STARTSET.extras],
    afwerking: [...KEUZE_STARTSET.afwerking, { sleutel: 'tegels', label: 'Tegels' }],
    garantie: [...KEUZE_STARTSET.garantie, { sleutel: '15_jaar', label: '15 jaar' }],
  };

  it("posten op de nieuwe sleutel; extra's in de volgorde van de lijst; nieuwe garantie zonder post", () => {
    const i = invoer({
      bedekking: 'leien',
      isolatie: '160_mm',
      hwaAantal: 2,
      extraAantallen: { dakkapel: 1 },
      afwerking: 'tegels',
      garantieJaren: '15_jaar',
    });
    expect(kaal(i, keuzes)).toEqual([
      { sleutel: 'dampremmer', aantal: 34.75 },
      { sleutel: '160_mm', aantal: 34.75 },
      { sleutel: 'leien', aantal: 34.75 },
      { sleutel: 'dakkapel', aantal: 1 },
      { sleutel: 'hwa', aantal: 2 },
      { sleutel: 'tegels', aantal: 34.75 },
      { sleutel: 'voorrijkosten', aantal: 1 },
    ]);
  });

  it('zonder post: het label als omschrijving, met de eenheid van de lijst', () => {
    const inhoud = maakInhoudZonderClaude({
      invoer: invoer({ bedekking: 'leien', isolatie: '160_mm', extraAantallen: { dakkapel: 2 } }),
      keuzes,
      postOpSleutel: posten(),
      teksten: TEKSTEN,
      maakId,
    });
    expect(inhoud.regels.map((r) => [r.omschrijving, r.eenheid])).toEqual([
      ['Dampremmende laag', 'm²'],
      ['Isolatie 160 mm', 'm²'],
      ['Leien', 'm²'],
      ['Dakkapel aansluiten', 'stuk'],
      ['Voorrijkosten', 'post'],
    ]);
  });

  it('titel met het hernoemde label', () => {
    expect(titelZonderClaude({ soortWerk: 'nieuw_dak', soortDak: 'plat' }, keuzes)).toBe(
      'Offerte compleet nieuw dak plat dak',
    );
  });

  it('extra die niet meer in de lijst staat valt niet weg (label = sleutel)', () => {
    const inhoud = maakInhoudZonderClaude({
      invoer: invoer({ extraAantallen: { weg: 3 } }),
      keuzes: KEUZE_STARTSET,
      postOpSleutel: posten(),
      teksten: TEKSTEN,
      maakId,
    });
    expect(inhoud.regels[0]).toMatchObject({ omschrijving: 'weg', aantalHonderdsten: 300, eenheid: 'stuk' });
  });
});
