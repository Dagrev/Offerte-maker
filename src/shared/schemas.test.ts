import { describe, expect, it } from 'vitest';
import {
  STANDAARD_EMAILTEKST,
  backupBestandSchema,
  dakvlakSchema,
  instellingSchemas,
  invoerSchemas,
  klantSchema,
  klusInvoerSchema,
  offerteregelSchema,
  prijspostSchema,
  standaardInstelling,
} from './schemas';
import type { KlusInvoer } from './types';

const legeKlusInvoer: KlusInvoer = {
  soortWerk: null,
  soortDak: null,
  dakvlakken: [{ id: 'd1', naam: 'Dakvlak 1', modus: 'lxb', lengteM: null, breedteM: null, m2: null }],
  bedekking: null,
  bedekkingAnders: '',
  huidigeBedekking: null,
  ondergrond: null,
  slopenEnAfvoeren: false,
  isolatie: 'geen',
  isolatieAndersMm: null,
  daktrimM1: 0,
  dakgootM1: 0,
  hwaAantal: 0,
  noodoverloopAantal: 0,
  doorvoerAantal: 0,
  lichtkoepelAantal: 0,
  afwerking: 'geen',
  hoogte: '1',
  steigerNodig: false,
  garantieJaren: '10',
  extraAantallen: {},
  werkzaamheden: [],
  gewensteUitvoering: '',
  overig: '',
};

describe('domeinschema’s', () => {
  it('accepteert een lege KlusInvoer (§5) en een lege Klant (FE-025)', () => {
    expect(klusInvoerSchema.safeParse(legeKlusInvoer).success).toBe(true);
    const leeg = { straatHuisnummer: '', postcode: '', plaats: '' };
    const klant = {
      aanhef: 'dhr',
      voornaam: '',
      achternaam: '',
      bedrijfsnaam: '',
      adres: leeg,
      telefoon: '',
      email: '',
      heeftWerkadres: false,
      werkadres: leeg,
    };
    expect(klantSchema.safeParse(klant).success).toBe(true);
  });

  it('weigert negatieve maten en aantallen (FE-024)', () => {
    expect(dakvlakSchema.safeParse({ ...legeKlusInvoer.dakvlakken[0], lengteM: -1 }).success).toBe(false);
    expect(dakvlakSchema.safeParse({ ...legeKlusInvoer.dakvlakken[0], m2: -0.5 }).success).toBe(false);
    expect(klusInvoerSchema.safeParse({ ...legeKlusInvoer, hwaAantal: -1 }).success).toBe(false);
    expect(klusInvoerSchema.safeParse({ ...legeKlusInvoer, hwaAantal: 1.5 }).success).toBe(false);
    expect(klusInvoerSchema.safeParse({ ...legeKlusInvoer, daktrimM1: -2 }).success).toBe(false);
    expect(klusInvoerSchema.safeParse({ ...legeKlusInvoer, garantieJaren: 15 }).success).toBe(false);
  });

  it('eist integers voor aantalHonderdsten en prijsCent (§7)', () => {
    const regel = {
      id: 'r1',
      omschrijving: 'EPDM',
      aantalHonderdsten: 3480,
      eenheid: 'm²',
      prijsCent: 4500,
      btwTarief: 21,
      prijsbron: 'prijslijst',
      prijspostId: null,
    };
    expect(offerteregelSchema.safeParse(regel).success).toBe(true);
    expect(offerteregelSchema.safeParse({ ...regel, aantalHonderdsten: 34.8 }).success).toBe(false);
    expect(offerteregelSchema.safeParse({ ...regel, prijsCent: 45.5 }).success).toBe(false);
    expect(offerteregelSchema.safeParse({ ...regel, btwTarief: 19 }).success).toBe(false);
  });

  it('prijspost: lege id = nieuw, omschrijving verplicht', () => {
    const post = {
      id: '',
      sleutel: null,
      omschrijving: 'Dakgoot',
      eenheid: 'm¹',
      prijsCent: null,
      btwTarief: 21,
      volgorde: 10,
    };
    expect(prijspostSchema.safeParse(post).success).toBe(true);
    expect(prijspostSchema.safeParse({ ...post, omschrijving: '  ' }).success).toBe(false);
  });
});

describe('instellingen (§4.3)', () => {
  it('heeft de standaardwaarden uit §4.3', () => {
    expect(standaardInstelling('bedrijf')).toEqual({
      naam: '',
      contactpersoon: '',
      adres: '',
      postcode: '',
      plaats: '',
      telefoon: '',
      email: '',
      website: '',
      kvk: '',
      btwNummer: '',
      iban: '',
      logoBestandId: null,
    });
    expect(standaardInstelling('opmaak')).toEqual({
      layout: 'klassiek',
      accentkleur: '#1F4E79',
      lettertype: 'inter',
    });
    expect(standaardInstelling('claude')).toEqual({
      pad: null,
      model: 'opus',
      effort: 'medium',
      apiSleutelVersleuteld: null,
    });
    expect(standaardInstelling('app')).toEqual({
      welkomVoltooid: false,
      laatsteBackupDatum: null,
      laatsteClaudeFout: null,
    });
  });

  it('teksten hebben de startwaarden uit §9.4 letterlijk', () => {
    expect(standaardInstelling('teksten')).toEqual({
      inleiding:
        'Naar aanleiding van uw aanvraag doen wij u hierbij graag een offerte toekomen voor de onderstaande werkzaamheden.',
      garantie10:
        'Op de uitgevoerde werkzaamheden geven wij 10 jaar schriftelijke garantie op waterdichtheid, zonder verplicht onderhoudscontract.',
      garantie20: 'Op de uitgevoerde werkzaamheden geven wij 20 jaar verzekerde garantie op waterdichtheid.',
      betalingsvoorwaarden: 'Betaling binnen 14 dagen na oplevering en ontvangst van de factuur.',
      afsluiting:
        'Wij vertrouwen erop u hiermee een passende aanbieding te hebben gedaan. Heeft u vragen, neem dan gerust contact met ons op.',
      voetnoot: '',
      emailTekst: STANDAARD_EMAILTEKST,
      geldigheidDagen: 30,
    });
  });

  it('vult ontbrekende velden aan en weigert ongeldige waarden', () => {
    expect(instellingSchemas.opmaak.parse({ layout: 'modern' }).accentkleur).toBe('#1F4E79');
    expect(instellingSchemas.opmaak.safeParse({ accentkleur: 'rood' }).success).toBe(false);
    expect(instellingSchemas.claude.safeParse({ pad: 'C:\\claude.cmd' }).success).toBe(false);
    expect(
      instellingSchemas.app.parse({ laatsteClaudeFout: { code: 'GEEN_INTERNET', tijdstip: 't' } })
        .laatsteClaudeFout?.code,
    ).toBe('GEEN_INTERNET');
    expect(
      instellingSchemas.app.safeParse({ laatsteClaudeFout: { code: 'BESTAAT_NIET', tijdstip: 't' } }).success,
    ).toBe(false);
  });
});

describe('invoerschema’s (§6.2)', () => {
  it('overzicht:zoek: 1–100 tekens', () => {
    const s = invoerSchemas['overzicht:zoek'];
    expect(s.safeParse({ tekst: '' }).success).toBe(false);
    expect(s.safeParse({ tekst: 'a' }).success).toBe(true);
    expect(s.safeParse({ tekst: 'a'.repeat(100) }).success).toBe(true);
    expect(s.safeParse({ tekst: 'a'.repeat(101) }).success).toBe(false);
  });

  it('offerte:bewaarInvoer: delen optioneel, wizardStap 1–4', () => {
    const s = invoerSchemas['offerte:bewaarInvoer'];
    expect(s.safeParse({ id: 'o1' }).success).toBe(true);
    expect(s.safeParse({ id: 'o1', invoer: legeKlusInvoer, wizardStap: 4 }).success).toBe(true);
    expect(s.safeParse({ id: 'o1', wizardStap: 5 }).success).toBe(false);
    expect(s.safeParse({ id: 'o1', wizardStap: 0 }).success).toBe(false);
    expect(s.safeParse({ id: 'o1', offertedatum: '25-09-2026' }).success).toBe(false);
  });

  it('offerte:pasAanMetClaude: instructie 1–2000', () => {
    const s = invoerSchemas['offerte:pasAanMetClaude'];
    expect(s.safeParse({ id: 'o1', instructie: '' }).success).toBe(false);
    expect(s.safeParse({ id: 'o1', instructie: 'x'.repeat(2000) }).success).toBe(true);
    expect(s.safeParse({ id: 'o1', instructie: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('voorbeelden:maakOnleesbaar: fragment 2–200', () => {
    const s = invoerSchemas['voorbeelden:maakOnleesbaar'];
    expect(s.safeParse({ id: 'v1', fragment: 'a' }).success).toBe(false);
    expect(s.safeParse({ id: 'v1', fragment: 'ab' }).success).toBe(true);
    expect(s.safeParse({ id: 'v1', fragment: 'a'.repeat(201) }).success).toBe(false);
  });

  it('offerte:stop accepteert template_teksten (V-08)', () => {
    expect(invoerSchemas['offerte:stop'].safeParse({ id: 'template_teksten' }).success).toBe(true);
    expect(invoerSchemas['offerte:stop'].safeParse({ id: '' }).success).toBe(false);
  });

  it('app:openMap: alleen log of offertes', () => {
    expect(invoerSchemas['app:openMap'].safeParse({ welke: 'log' }).success).toBe(true);
    expect(invoerSchemas['app:openMap'].safeParse({ welke: 'C:\\' }).success).toBe(false);
  });

  it('instellingen:bewaar: eigen schema per sleutel, claude zonder sleutelveld', () => {
    const s = invoerSchemas['instellingen:bewaar'];
    expect(
      s.safeParse({
        sleutel: 'opmaak',
        waarde: { layout: 'modern', accentkleur: '#2E7D32', lettertype: 'inter' },
      }).success,
    ).toBe(true);
    expect(s.safeParse({ sleutel: 'opmaak', waarde: { layout: 'modern' } }).success).toBe(false);
    const claude = s.parse({
      sleutel: 'claude',
      waarde: { pad: null, model: 'opus', effort: 'high', apiSleutelVersleuteld: 'geheim' },
    });
    expect(claude.waarde).not.toHaveProperty('apiSleutelVersleuteld');
    expect(s.safeParse({ sleutel: 'app', waarde: { welkomVoltooid: true } }).success).toBe(false);
    const bedrijf = s.parse({
      sleutel: 'bedrijf',
      waarde: {
        ...standaardInstelling('bedrijf'),
        naam: 'Dakwerk BV',
        logoBestandId: 'x',
      },
    });
    expect(bedrijf.waarde).not.toHaveProperty('logoBestandId');
  });

  it('backup:zetTerug: alleen een bestandsnaam volgens V-19', () => {
    expect(backupBestandSchema.safeParse('offerte-maker-2026-09-25-213000-handmatig.sqlite').success).toBe(
      true,
    );
    expect(backupBestandSchema.safeParse('offerte-maker-2026-09-25-213000-anders.sqlite').success).toBe(
      false,
    );
    expect(
      invoerSchemas['backup:zetTerug'].safeParse({
        bestand: '..\\offerte-maker-2026-09-25-213000-handmatig.sqlite',
      }).success,
    ).toBe(false);
  });

  it('kanalen zonder invoer accepteren alleen undefined', () => {
    expect(invoerSchemas['app:info'].safeParse(undefined).success).toBe(true);
    expect(invoerSchemas['app:info'].safeParse({}).success).toBe(false);
  });
});
