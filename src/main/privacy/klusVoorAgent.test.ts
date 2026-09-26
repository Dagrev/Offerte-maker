import { describe, expect, it } from 'vitest';
import { KEUZE_STARTSET } from '@shared/keuzelijsten';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';
import type { Prijspost } from '@shared/types';
import { CATALOGUS, gekozen } from '../../../test/helpers/werkCatalogus';
import { bouwKlusVoorAgent, gebruikersTekst, vastePrijzen } from './klusVoorAgent';

const klant = maakKlant({
  aanhef: 'mevr',
  voornaam: '',
  achternaam: 'de Vries',
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
        huidigeBedekking: 'grind_op_bitumen',
        ondergrond: 'beton',
        hoogte: '3plus',
        steigerNodig: true,
        garantieJaren: '20',
        gewensteUitvoering: 'Na de bouwvak',
        overig: 'Geen bijzonderheden',
      }),
      klant,
      offertedatum: '2026-09-25',
      keuzes: KEUZE_STARTSET,
    });
    expect(klus).toEqual({
      soortWerk: 'Nieuw dak',
      soortDak: 'hellend dak',
      dakvlakken: [
        { naam: 'Voorkant', m2: 22.5 },
        { naam: 'Achterkant', m2: 12.3 },
      ],
      huidigeBedekking: 'Grind op bitumen',
      ondergrond: 'Beton',
      hoogte: '3 of meer bouwlagen',
      steigerNodig: true,
      garantie: '20 jaar verzekerde garantie',
      gewensteUitvoering: 'Na de bouwvak',
      overig: 'Geen bijzonderheden',
      totaalM2: 34.8,
      offertedatum: '2026-09-25',
      klant: { naam: '[KLANT_NAAM]', isBedrijf: false, bedrijf: null, heeftWerkadres: false },
      werkzaamheden: [
        {
          naam: 'slopen',
          eenheid: 'post',
          aantal: 22.5,
          prijsEuro: null,
          prijspostId: null,
          notitie: '',
          materialen: [],
          opties: [],
        },
      ],
    });
  });

  it('lege keuzes blijven null', () => {
    const klus = bouwKlusVoorAgent({
      invoer: maakInvoer({ soortWerk: null, soortDak: null, huidigeBedekking: null, ondergrond: null }),
      klant,
      offertedatum: '2026-09-25',
      keuzes: KEUZE_STARTSET,
    });
    expect(klus).toMatchObject({ soortWerk: null, soortDak: null, huidigeBedekking: null, ondergrond: null });
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
      keuzes: KEUZE_STARTSET,
    };
    const klus = bouwKlusVoorAgent(bron);
    expect(gebruikersTekst(klus)).toEqual([
      'Mevrouw [KLANT_NAAM]: [VERWIJDERD]',
      'Mail [VERWIJDERD], [KLANT_ADRES]',
      'Schuur [KLANT_NAAM]',
      '',
    ]);
    const ongefilterd = bouwKlusVoorAgent(bron, { filteren: false });
    expect(ongefilterd.overig).toBe('Mail devries@mail.nl, Dorpsstraat 12');
    expect(ongefilterd.dakvlakken[0]?.naam).toBe('Schuur Vries');
  });

  it('OFM-034: labels uit de keuzelijsten', () => {
    const keuzes = {
      ...KEUZE_STARTSET,
      soortWerk: [{ sleutel: 'reparatie', label: 'Lekkage verhelpen' }],
      garantie: [...KEUZE_STARTSET.garantie, { sleutel: '15_jaar', label: '15 jaar' }],
    };
    const klus = bouwKlusVoorAgent({
      invoer: maakInvoer({ soortWerk: 'reparatie', garantieJaren: '15_jaar' }),
      klant,
      offertedatum: '2026-09-25',
      keuzes,
    });
    expect(klus).toMatchObject({ soortWerk: 'Lekkage verhelpen', garantie: '15 jaar' });
    // OFM-045: de velden van de oude stap Extra's bestaan niet meer.
    expect(klus).not.toHaveProperty('bedekking');
    expect(klus).not.toHaveProperty('extras');
  });

  it('klantobject: alleen plaatshouders en vlaggen', () => {
    const bedrijf = maakKlant({
      aanhef: 'bedrijf',
      voornaam: '',
      achternaam: 'Hendriks',
      bedrijfsnaam: 'Hendriks BV',
      heeftWerkadres: true,
      werkadres: { straatHuisnummer: 'Industrieweg 5', postcode: '', plaats: 'Eindhoven' },
    });
    const klus = bouwKlusVoorAgent({
      invoer: maakInvoer(),
      klant: bedrijf,
      offertedatum: '2026-09-25',
      keuzes: KEUZE_STARTSET,
    });
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

describe('werkzaamheden in de klus (OFM-044)', () => {
  const postOpSleutel = (sleutel: string): Prijspost | null =>
    sleutel === 'werk:slopen' || sleutel === 'mat:pir_80'
      ? {
          id: `post-${sleutel}`,
          sleutel,
          omschrijving: sleutel,
          eenheid: 'm²',
          prijsCent: 1,
          btwTarief: 21,
          volgorde: 0,
        }
      : null;
  const invoer = maakInvoer({
    werkzaamheden: [
      gekozen({
        notitie: 'Bel mevrouw de Vries vooraf op 06-12345678',
        opties: [{ sleutel: 'afvalcontainer', prijsCent: 30000 }],
        materialen: [
          { id: 'm1', sleutel: 'pir_80', eenmalig: null, aantal: 20, prijsCent: 1800 },
          {
            id: 'm2',
            sleutel: null,
            eenmalig: { label: 'Zink van de Vries', eenheid: 'm¹' },
            aantal: 4,
            prijsCent: null,
          },
        ],
      }),
      gekozen({
        id: 'g2',
        sleutel: null,
        eenmalig: { label: 'Dakkapel', eenheid: 'post' },
        aantal: 1,
        prijsCent: 25000,
      }),
    ],
  });
  const bron = {
    invoer,
    klant,
    offertedatum: '2026-09-25',
    keuzes: KEUZE_STARTSET,
    catalogus: CATALOGUS,
    postOpSleutel,
  };

  it('namen, aantallen, prijzen en prijspost-id; eenmalige namen en notities door het filter', () => {
    const klus = bouwKlusVoorAgent(bron);
    expect(klus).not.toHaveProperty('bedekking');
    expect(klus.werkzaamheden).toEqual([
      {
        naam: 'Slopen',
        eenheid: 'm²',
        aantal: 20,
        prijsEuro: 12,
        prijspostId: 'post-werk:slopen',
        notitie: 'Bel mevrouw [KLANT_NAAM] vooraf op [VERWIJDERD]',
        materialen: [
          { naam: 'PIR 80 mm', eenheid: 'm²', aantal: 20, prijsEuro: 18, prijspostId: 'post-mat:pir_80' },
          {
            naam: 'Zink van [KLANT_NAAM]',
            eenheid: 'm¹',
            aantal: 4,
            prijsEuro: null,
            prijspostId: 'eenmalig-w1-m2',
          },
        ],
        opties: [{ naam: 'Afvalcontainer', eenheid: 'stuk', aantal: 1, prijsEuro: 300, prijspostId: null }],
      },
      {
        naam: 'Dakkapel',
        eenheid: 'post',
        aantal: 1,
        prijsEuro: 250,
        prijspostId: 'eenmalig-w2',
        notitie: '',
        materialen: [],
        opties: [],
      },
    ]);
    expect(gebruikersTekst(klus)).toEqual([
      klus.gewensteUitvoering,
      klus.overig,
      ...klus.dakvlakken.map((v) => v.naam),
      'Bel mevrouw [KLANT_NAAM] vooraf op [VERWIJDERD]',
      'Zink van [KLANT_NAAM]',
      '',
      'Dakkapel',
    ]);
  });

  it('vastePrijzen: prijspost-id of eenmalig-id → centen, alleen met een prijs', () => {
    expect([...vastePrijzen(bouwKlusVoorAgent(bron))]).toEqual([
      ['post-werk:slopen', 1200],
      ['post-mat:pir_80', 1800],
      ['eenmalig-w2', 25000],
    ]);
  });

  it('zonder catalogus en posten: sleutel als naam en geen prijspost-id', () => {
    const klus = bouwKlusVoorAgent({ ...bron, catalogus: undefined, postOpSleutel: undefined });
    expect(klus.werkzaamheden[0]).toMatchObject({ naam: 'slopen', prijspostId: null });
  });
});
