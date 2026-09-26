import { describe, expect, it } from 'vitest';
import { klantSchema, klusInvoerSchema } from './schemas';
import {
  kopieerInvoer,
  legeKlant,
  legeKlusInvoer,
  nieuwDakvlak,
  normaliseerKlant,
  zoektekstVan,
} from './nieuweOfferte';
import { controleerKlant, klantCompleet } from './wizardControle';

describe('fabrieken (§5, §6.2)', () => {
  it("lege klant en lege KlusInvoer volgen het ontwerp en passen op de schema's", () => {
    expect(legeKlant()).toEqual({
      aanhef: 'dhr',
      naam: '',
      bedrijfsnaam: '',
      adres: { straatHuisnummer: '', postcode: '', plaats: '' },
      telefoon: '',
      email: '',
      heeftWerkadres: false,
      werkadres: { straatHuisnummer: '', postcode: '', plaats: '' },
    });
    const invoer = legeKlusInvoer();
    expect(klusInvoerSchema.parse(invoer)).toEqual(invoer);
    expect(klantSchema.parse(legeKlant())).toEqual(legeKlant());
    expect(invoer).toMatchObject({
      soortWerk: null,
      soortDak: null,
      bedekking: null,
      huidigeBedekking: null,
      ondergrond: null,
      isolatie: 'geen',
      afwerking: 'geen',
      hoogte: '1',
      garantieJaren: '10',
      extraAantallen: {},
      daktrimM1: 0,
      hwaAantal: 0,
      slopenEnAfvoeren: false,
      steigerNodig: false,
      overig: '',
    });
    expect(invoer.dakvlakken).toHaveLength(1);
    expect(invoer.dakvlakken[0]).toMatchObject({ naam: 'Dakvlak 1', modus: 'lxb', lengteM: null, m2: null });
    expect(legeKlusInvoer().dakvlakken[0]?.id).not.toBe(invoer.dakvlakken[0]?.id);
  });

  it('nieuwDakvlak en kopieerInvoer', () => {
    expect(nieuwDakvlak(3, 'x')).toEqual({
      id: 'x',
      naam: 'Dakvlak 3',
      modus: 'lxb',
      lengteM: null,
      breedteM: null,
      m2: null,
    });
    const bron = {
      ...legeKlusInvoer(),
      dakvlakken: [nieuwDakvlak(1, 'a'), { ...nieuwDakvlak(2, 'b'), m2: 4 }],
    };
    const kopie = kopieerInvoer(bron);
    expect(kopie.dakvlakken.map((v) => v.id)).not.toContain('a');
    expect(kopie.dakvlakken.map(({ id, ...rest }) => (void id, rest))).toEqual(
      bron.dakvlakken.map(({ id, ...rest }) => (void id, rest)),
    );
  });

  it('normaliseerKlant maakt het werkadres leeg zonder werkadres', () => {
    const werk = { straatHuisnummer: 'a', postcode: 'b', plaats: 'c' };
    expect(normaliseerKlant({ ...legeKlant(), werkadres: werk }).werkadres.plaats).toBe('');
    expect(normaliseerKlant({ ...legeKlant(), heeftWerkadres: true, werkadres: werk }).werkadres).toBe(werk);
  });

  it('zoektekstVan (§8.2)', () => {
    const k = { naam: 'P. Jansen', bedrijfsnaam: 'Bouw BV', adres: { plaats: 'Eindhoven' } };
    expect(zoektekstVan(k, '2026-007')).toBe('p. jansen bouw bv eindhoven 2026-007');
    expect(zoektekstVan(k, null)).toBe('p. jansen bouw bv eindhoven ');
  });
});

describe('controleerKlant (FE-024, V-16)', () => {
  const geldig = {
    ...legeKlant(),
    naam: 'Jansen',
    adres: { straatHuisnummer: 'Kerkstraat 1', postcode: '5611 AB', plaats: 'Eindhoven' },
    email: 'a@b.nl',
  };

  it('geldige klant: geen fouten', () => {
    expect(controleerKlant(geldig)).toEqual({ fouten: {}, ongeldig: {} });
    expect(klantCompleet(geldig)).toBe(true);
    expect(controleerKlant({ ...geldig, email: '', adres: { ...geldig.adres, postcode: '5611ab' } })).toEqual(
      { fouten: {}, ongeldig: {} },
    );
  });

  it('lege naam en plaats blokkeren', () => {
    const c = controleerKlant({ ...geldig, naam: ' ', adres: { ...geldig.adres, plaats: '' } });
    expect(c.fouten).toEqual({ naam: 'leeg', plaats: 'leeg' });
    expect(klantCompleet({ ...geldig, naam: '' })).toBe(false);
  });

  it('postcode 12345 en een raar e-mailadres zijn ongeldig en blokkeren (OFM-030)', () => {
    const k = { ...geldig, email: 'jan@nl', adres: { ...geldig.adres, postcode: '12345' } };
    expect(controleerKlant(k)).toEqual({
      fouten: {},
      ongeldig: { 'adres.postcode': 'postcode', email: 'email' },
    });
    expect(klantCompleet(k)).toBe(false);
    expect(controleerKlant({ ...geldig, adres: { ...geldig.adres, postcode: '0611 AB' } }).ongeldig).toEqual({
      'adres.postcode': 'postcode',
    });
  });

  it('werkadrespostcode alleen gecontroleerd bij een werkadres', () => {
    const werkadres = { straatHuisnummer: '', postcode: '99', plaats: '' };
    expect(controleerKlant({ ...geldig, werkadres }).ongeldig).toEqual({});
    expect(controleerKlant({ ...geldig, heeftWerkadres: true, werkadres }).ongeldig).toEqual({
      'werkadres.postcode': 'postcode',
    });
  });
});
