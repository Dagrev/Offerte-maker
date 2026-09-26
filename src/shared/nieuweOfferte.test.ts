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
import { ongeldigeKlantVelden } from './validatie';

describe('fabrieken (§5, §6.2)', () => {
  it("lege klant en lege KlusInvoer volgen het ontwerp en passen op de schema's", () => {
    expect(legeKlant()).toEqual({
      aanhef: 'dhr',
      voornaam: '',
      tussenvoegsel: '',
      achternaam: '',
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
      huidigeBedekking: null,
      ondergrond: null,
      hoogte: '1',
      garantieJaren: '10',
      werkzaamheden: [],
      steigerNodig: false,
      overig: '',
    });
    // OFM-044: de velden van de oude stap Extra's bestaan niet meer in een nieuwe offerte.
    expect(invoer).not.toHaveProperty('bedekking');
    expect(invoer).not.toHaveProperty('extraAantallen');
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
    const k = {
      voornaam: 'Piet',
      tussenvoegsel: '',
      achternaam: 'Jansen',
      bedrijfsnaam: 'Bouw BV',
      adres: { plaats: 'Eindhoven' },
    };
    expect(zoektekstVan(k, '2026-007')).toBe('piet jansen bouw bv eindhoven 2026-007');
    expect(zoektekstVan(k, null)).toBe('piet jansen bouw bv eindhoven ');
    // OFM-038: "piet jansen" (beide namen samen) vindt de klant ook.
    expect(zoektekstVan(k, null)).toContain('piet jansen');
    // OFM-046: met tussenvoegsel vinden "van der berg" en "piet van der berg" de klant.
    const berg = { ...k, tussenvoegsel: 'van der', achternaam: 'Berg' };
    expect(zoektekstVan(berg, null)).toBe('piet van der berg bouw bv eindhoven ');
  });
});

describe('ongeldigeKlantVelden (OFM-030; lege velden meldt sinds OFM-038 `shared/verplicht.ts`)', () => {
  const geldig = {
    ...legeKlant(),
    achternaam: 'Jansen',
    adres: { straatHuisnummer: 'Kerkstraat 1', postcode: '5611 AB', plaats: 'Eindhoven' },
    email: 'a@b.nl',
  };

  it('geldige klant: geen fouten', () => {
    expect(ongeldigeKlantVelden(geldig)).toEqual({});
    expect(
      ongeldigeKlantVelden({ ...geldig, email: '', adres: { ...geldig.adres, postcode: '5611ab' } }),
    ).toEqual({});
  });

  it('postcode 12345 en een raar e-mailadres zijn ongeldig (OFM-030)', () => {
    const k = { ...geldig, email: 'jan@nl', adres: { ...geldig.adres, postcode: '12345' } };
    expect(ongeldigeKlantVelden(k)).toEqual({ 'adres.postcode': 'postcode', email: 'email' });
    expect(ongeldigeKlantVelden({ ...geldig, adres: { ...geldig.adres, postcode: '0611 AB' } })).toEqual({
      'adres.postcode': 'postcode',
    });
  });

  it('werkadrespostcode alleen gecontroleerd bij een werkadres', () => {
    const werkadres = { straatHuisnummer: '', postcode: '99', plaats: '' };
    expect(ongeldigeKlantVelden({ ...geldig, werkadres })).toEqual({});
    expect(ongeldigeKlantVelden({ ...geldig, heeftWerkadres: true, werkadres })).toEqual({
      'werkadres.postcode': 'postcode',
    });
  });
});
