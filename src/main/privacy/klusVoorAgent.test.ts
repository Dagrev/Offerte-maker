import { describe, expect, it } from 'vitest';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';
import { bouwKlusVoorAgent, gebruikersTekst } from './klusVoorAgent';

const klant = maakKlant({
  aanhef: 'mevr',
  naam: 'de Vries',
  adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
  telefoon: '06-12345678',
  email: 'devries@mail.nl',
});

describe('bouwKlusVoorAgent (§10.5, V-26)', () => {
  it('zet alle codes om in labels en voegt totaalM2, offertedatum en klant toe', () => {
    const klus = bouwKlusVoorAgent({
      invoer: maakInvoer({
        soortWerk: 'nieuw_dak',
        soortDak: 'hellend',
        dakvlakken: [
          { id: 'a', naam: 'Voorkant', modus: 'lxb', lengteM: 5, breedteM: 4.5, m2: null },
          { id: 'b', naam: 'Achterkant', modus: 'm2', lengteM: null, breedteM: null, m2: 12.3 },
        ],
        bedekking: 'bitumen',
        huidigeBedekking: 'grind_op_bitumen',
        ondergrond: 'beton',
        slopenEnAfvoeren: true,
        isolatie: '80',
        daktrimM1: 12,
        dakgootM1: 8,
        hwaAantal: 2,
        noodoverloopAantal: 1,
        doorvoerAantal: 3,
        lichtkoepelAantal: 1,
        afwerking: 'grind',
        hoogte: '3plus',
        steigerNodig: true,
        garantieJaren: 20,
        gewensteUitvoering: 'Na de bouwvak',
        overig: 'Geen bijzonderheden',
      }),
      klant,
      offertedatum: '2026-09-25',
    });
    expect(klus).toEqual({
      soortWerk: 'Nieuw dak',
      soortDak: 'hellend dak',
      dakvlakken: [
        { naam: 'Voorkant', m2: 22.5 },
        { naam: 'Achterkant', m2: 12.3 },
      ],
      bedekking: 'Bitumen',
      bedekkingAnders: '',
      huidigeBedekking: 'Grind op bitumen',
      ondergrond: 'Beton',
      slopenEnAfvoeren: true,
      isolatie: '80 mm (Rc 3,5)',
      isolatieAndersMm: null,
      daktrimM1: 12,
      dakgootM1: 8,
      hwaAantal: 2,
      noodoverloopAantal: 1,
      doorvoerAantal: 3,
      lichtkoepelAantal: 1,
      afwerking: 'Grind',
      hoogte: '3 of meer bouwlagen',
      steigerNodig: true,
      garantieJaren: 20,
      gewensteUitvoering: 'Na de bouwvak',
      overig: 'Geen bijzonderheden',
      totaalM2: 34.8,
      offertedatum: '2026-09-25',
      klant: { naam: '[KLANT_NAAM]', isBedrijf: false, bedrijf: null, heeftWerkadres: false },
    });
  });

  it('lege keuzes blijven null; anders-waarden worden de ingevulde tekst', () => {
    const klus = bouwKlusVoorAgent({
      invoer: maakInvoer({
        soortWerk: null,
        soortDak: null,
        bedekking: 'anders',
        bedekkingAnders: 'Zink van de Vries',
        huidigeBedekking: null,
        ondergrond: null,
        isolatie: 'anders',
        isolatieAndersMm: 140,
      }),
      klant,
      offertedatum: '2026-09-25',
    });
    expect(klus).toMatchObject({
      soortWerk: null,
      soortDak: null,
      bedekking: 'Zink van [KLANT_NAAM]',
      bedekkingAnders: 'Zink van [KLANT_NAAM]',
      huidigeBedekking: null,
      ondergrond: null,
      isolatie: '140 mm',
      isolatieAndersMm: 140,
    });
  });

  it('filtert vrije tekst en dakvlaknamen; zonder filter blijft de tekst ongewijzigd', () => {
    const bron = {
      invoer: maakInvoer({
        dakvlakken: [
          { id: 'a', naam: 'Schuur Vries', modus: 'm2' as const, lengteM: null, breedteM: null, m2: 10 },
        ],
        gewensteUitvoering: 'Mevrouw de Vries: 06-12345678',
        overig: 'Mail devries@mail.nl, Dorpsstraat 12',
      }),
      klant,
      offertedatum: '2026-09-25',
    };
    const klus = bouwKlusVoorAgent(bron);
    expect(gebruikersTekst(klus)).toEqual([
      'Mevrouw [KLANT_NAAM]: [VERWIJDERD]',
      'Mail [VERWIJDERD], [KLANT_ADRES]',
      '',
      'Schuur [KLANT_NAAM]',
    ]);
    const ongefilterd = bouwKlusVoorAgent(bron, { filteren: false });
    expect(ongefilterd.overig).toBe('Mail devries@mail.nl, Dorpsstraat 12');
    expect(ongefilterd.dakvlakken[0]?.naam).toBe('Schuur Vries');
  });

  it('klantobject: alleen plaatshouders en vlaggen', () => {
    const bedrijf = maakKlant({
      aanhef: 'bedrijf',
      naam: 'Hendriks',
      bedrijfsnaam: 'Hendriks BV',
      heeftWerkadres: true,
      werkadres: { straatHuisnummer: 'Industrieweg 5', postcode: '', plaats: 'Eindhoven' },
    });
    const klus = bouwKlusVoorAgent({ invoer: maakInvoer(), klant: bedrijf, offertedatum: '2026-09-25' });
    expect(klus.klant).toEqual({
      naam: '[KLANT_NAAM]',
      isBedrijf: true,
      bedrijf: '[KLANT_BEDRIJF]',
      heeftWerkadres: true,
    });
    const json = JSON.stringify(klus);
    for (const w of ['Hendriks', 'Industrieweg', 'Eindhoven', 'aanhef']) expect(json).not.toContain(w);
  });
});
