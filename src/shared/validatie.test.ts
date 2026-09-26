import { describe, expect, it } from 'vitest';
import { legeKlant } from './nieuweOfferte';
import { standaardInstelling } from './schemas';
import { BEDRIJF_VELDNAMEN, KLANT_VELDNAMEN, VALIDATIE_FOUTEN, validatieMelding } from './teksten/validatie';
import type { Klant } from './types';
import {
  bewaarbaarBedrijf,
  bewaarbareKlant,
  controleerBedrijfVelden,
  controleerEmail,
  controleerHuisnummer,
  controleerKlantVelden,
  controleerPostcode,
  controleerStraatHuisnummer,
  controleerTelefoon,
  ongeldigeBedrijfVelden,
  ongeldigeKlantVelden,
  ontleedHuisnummer,
  splitsStraatHuisnummer,
  telefoonWeergave,
} from './validatie';

// OFM-030: gedeelde validatiemodule (100 % branches, zie vitest.config.ts).

const ok = (waarde: string) => ({ geldig: true, waarde });
const fout = (soort: string) => ({ geldig: false, fout: soort });

describe('controleerPostcode', () => {
  it.each([
    ['1234 AB', '1234 AB'],
    ['1234AB', '1234 AB'],
    [' 1234ab ', '1234 AB'],
    ['5611  xy', '5611 XY'],
    ['9999 ZZ', '9999 ZZ'],
  ])('%j is geldig → %j', (invoer, uit) => expect(controleerPostcode(invoer)).toEqual(ok(uit)));

  it.each([
    '0123 AB',
    '123 AB',
    '12345',
    '1234 A',
    '1234 ABC',
    '1234-AB',
    'AB 1234',
    '1234 SA',
    '1234 sd',
    '1234SS',
  ])('%j is ongeldig', (invoer) => expect(controleerPostcode(invoer)).toEqual(fout('postcode')));

  it('leeg is geen fout', () => {
    expect(controleerPostcode('')).toEqual(ok(''));
    expect(controleerPostcode('   ')).toEqual(ok(''));
  });
});

describe('huisnummer', () => {
  it.each([
    ['12', '12', { nummer: 12, toevoeging: '' }],
    ['12a', '12A', { nummer: 12, toevoeging: 'A' }],
    ['12 A', '12A', { nummer: 12, toevoeging: 'A' }],
    ['12-2', '12-2', { nummer: 12, toevoeging: '2' }],
    ['12 / 3', '12-3', { nummer: 12, toevoeging: '3' }],
    ['12 bis', '12-BIS', { nummer: 12, toevoeging: 'BIS' }],
    ['99999', '99999', { nummer: 99999, toevoeging: '' }],
  ])('%j → %j', (invoer, uit, ontleed) => {
    expect(controleerHuisnummer(invoer)).toEqual(ok(uit));
    expect(ontleedHuisnummer(invoer)).toEqual(ontleed);
  });

  it.each(['0', '012', 'a12', '123456', '12 abcde', '12--2', 'twaalf'])('%j is ongeldig', (invoer) => {
    expect(controleerHuisnummer(invoer)).toEqual(fout('huisnummer'));
    expect(ontleedHuisnummer(invoer)).toBeNull();
  });

  it('leeg is geen fout', () => expect(controleerHuisnummer(' ')).toEqual(ok('')));
});

describe('straat en huisnummer', () => {
  it.each([
    ['Dorpsstraat 12', 'Dorpsstraat', 12, ''],
    ['  Dorpsstraat   12 a ', 'Dorpsstraat', 12, 'A'],
    ['Kerkstraat 12 bis', 'Kerkstraat', 12, 'BIS'],
    ['2e Helmersstraat 7-3', '2e Helmersstraat', 7, '3'],
    ['Laan 1940-1945 3', 'Laan 1940-1945', 3, ''],
    ['Postbus 123', 'Postbus', 123, ''],
  ])('%j → straat %j, nummer %j %j', (invoer, straat, nummer, toevoeging) => {
    expect(splitsStraatHuisnummer(invoer)).toEqual({ straat, huisnummer: { nummer, toevoeging } });
  });

  it('normaliseert alleen de witruimte', () => {
    expect(controleerStraatHuisnummer('  Kerkstraat   12 bis ')).toEqual(ok('Kerkstraat 12 bis'));
    expect(controleerStraatHuisnummer('')).toEqual(ok(''));
  });

  it.each(['Dorpsstraat', '12', '12 13', 'Dorpsstraat twaalf', 'Dorpsstraat 0'])(
    '%j is ongeldig',
    (invoer) => {
      expect(splitsStraatHuisnummer(invoer)).toBeNull();
      expect(controleerStraatHuisnummer(invoer)).toEqual(fout('straatHuisnummer'));
    },
  );
});

describe('controleerEmail', () => {
  it.each([
    ['Jan@Voorbeeld.NL', 'jan@voorbeeld.nl'],
    [' info@dak-werken.nl ', 'info@dak-werken.nl'],
    ['a.b+c@sub.domein.com', 'a.b+c@sub.domein.com'],
    ['jan@bücher.de', 'jan@bücher.de'],
  ])('%j → %j', (invoer, uit) => expect(controleerEmail(invoer)).toEqual(ok(uit)));

  it.each([
    'jan',
    'jan@nl',
    'jan@@voorbeeld.nl',
    'jan@voor@beeld.nl',
    '@voorbeeld.nl',
    'jan @voorbeeld.nl',
    'jan@voorbeeld..nl',
    'jan@-voorbeeld.nl',
    'jan@voorbeeld.n',
    'jan@voorbeeld.12',
    'jan@.nl',
  ])('%j is ongeldig', (invoer) => expect(controleerEmail(invoer)).toEqual(fout('email')));

  it('leeg is geen fout', () => expect(controleerEmail('')).toEqual(ok('')));
});

describe('controleerTelefoon', () => {
  it.each([
    ['0612345678', '+31612345678'],
    ['06-12345678', '+31612345678'],
    ['06 1234 5678', '+31612345678'],
    ['(040) 123 45 67', '+31401234567'],
    ['010.123.45.67', '+31101234567'],
    ['+31 6 12345678', '+31612345678'],
    ['+31 (0)6 12345678', '+31612345678'],
    ['+31 06 12345678', '+31612345678'],
    ['0031 6 12345678', '+31612345678'],
    ['+32 470 12 34 56', '+32470123456'],
    ['0032 470 123456', '+32470123456'],
    ['+49 30 123456', '+4930123456'],
    ['+1 212 555 0100', '+12125550100'],
  ])('%j → %j', (invoer, uit) => expect(controleerTelefoon(invoer)).toEqual(ok(uit)));

  it.each([
    '061234567', // 9 cijfers
    '06123456789', // 11 cijfers
    '0012345',
    '+31 6 1234567',
    '+31 0 12345678',
    '+32 1234', // te kort
    '+1234567890123456', // 16 cijfers
    '+0 12345678',
    '6 12345678',
    '06+12345678',
    '++31612345678',
    '06 1234 567a',
    'bel mij',
  ])('%j is ongeldig', (invoer) => expect(controleerTelefoon(invoer)).toEqual(fout('telefoon')));

  it('leeg is geen fout', () => expect(controleerTelefoon(' ')).toEqual(ok('')));

  it('weergave', () => {
    expect(telefoonWeergave('+31612345678')).toBe('+31 6 12345678');
    expect(telefoonWeergave('+31401234567')).toBe('+31 401234567');
    expect(telefoonWeergave('+32470123456')).toBe('+32470123456');
    expect(telefoonWeergave('06-1234')).toBe('06-1234');
  });
});

const klant: Klant = {
  ...legeKlant(),
  naam: 'Jansen',
  adres: { straatHuisnummer: 'Dorpsstraat  12', postcode: '5611ab', plaats: 'Eindhoven' },
  telefoon: '06-12345678',
  email: 'Jan@Voorbeeld.nl',
};

describe('controleerKlantVelden', () => {
  it('normaliseert geldige velden', () => {
    expect(controleerKlantVelden(klant)).toEqual({
      waarde: {
        ...klant,
        adres: { ...klant.adres, straatHuisnummer: 'Dorpsstraat 12', postcode: '5611 AB' },
        telefoon: '+31612345678',
        email: 'jan@voorbeeld.nl',
      },
      fouten: [],
    });
  });

  it('meldt ongeldige velden; het werkadres alleen met heeftWerkadres', () => {
    const k: Klant = {
      ...klant,
      telefoon: '123',
      werkadres: { straatHuisnummer: 'Hoek', postcode: '12', plaats: '' },
    };
    expect(controleerKlantVelden(k).fouten).toEqual([{ veld: 'telefoon', fout: 'telefoon' }]);
    const werk = { straatHuisnummer: 'Hoekweg  3', postcode: '5611xy', plaats: 'Eindhoven' };
    expect(
      controleerKlantVelden({ ...klant, heeftWerkadres: true, werkadres: werk }).waarde.werkadres,
    ).toEqual({
      ...werk,
      straatHuisnummer: 'Hoekweg 3',
      postcode: '5611 XY',
    });
    expect(ongeldigeKlantVelden({ ...k, heeftWerkadres: true })).toEqual({
      'werkadres.straatHuisnummer': 'straatHuisnummer',
      'werkadres.postcode': 'postcode',
      telefoon: 'telefoon',
    });
  });

  it('een ongeldige waarde die al zo opgeslagen stond is geen fout (oude offerte)', () => {
    const oud: Klant = { ...klant, adres: { ...klant.adres, postcode: '12345' } };
    expect(controleerKlantVelden(oud, oud).fouten).toEqual([]);
    expect(controleerKlantVelden(oud, oud).waarde.adres.postcode).toBe('12345');
    expect(
      controleerKlantVelden({ ...oud, adres: { ...oud.adres, postcode: '123456' } }, oud).fouten,
    ).toEqual([{ veld: 'adres.postcode', fout: 'postcode' }]);
  });

  it('bewaarbareKlant: ongeldig veld krijgt de laatst bewaarde waarde, de rest gaat mee', () => {
    const basis: Klant = { ...klant, telefoon: '0612345678' };
    const nieuw: Klant = { ...klant, naam: 'Pietersen', telefoon: '06123', email: 'x@' };
    expect(bewaarbareKlant(nieuw, basis)).toEqual({ ...nieuw, telefoon: '0612345678', email: klant.email });
    // Oude ongeldige waarde die niet is aangeraakt blijft staan.
    const oud: Klant = { ...klant, telefoon: 'onbekend' };
    expect(bewaarbareKlant({ ...oud, naam: 'Anders' }, oud).telefoon).toBe('onbekend');
    // Zonder werkadres wordt het werkadres niet gecontroleerd.
    const werk = { ...klant, werkadres: { straatHuisnummer: 'x', postcode: 'y', plaats: '' } };
    expect(bewaarbareKlant(werk, klant)).toEqual(werk);
  });
});

describe('bedrijfsgegevens', () => {
  const bedrijf = {
    ...standaardInstelling('bedrijf'),
    naam: 'Dakwerken Zuid',
    adres: 'Industrieweg 1',
    postcode: '5600aa',
    telefoon: '040 123 45 67',
    email: 'INFO@dakwerken.nl',
  };

  it('normaliseert en laat de andere velden met rust', () => {
    expect(controleerBedrijfVelden(bedrijf)).toEqual({
      waarde: { ...bedrijf, postcode: '5600 AA', telefoon: '+31401234567', email: 'info@dakwerken.nl' },
      fouten: [],
    });
    expect(controleerBedrijfVelden(standaardInstelling('bedrijf')).fouten).toEqual([]);
  });

  it('meldt ongeldige velden, behalve een ongewijzigde oude waarde', () => {
    const fout = { ...bedrijf, adres: 'Industrieweg', email: 'info' };
    expect(ongeldigeBedrijfVelden(fout)).toEqual({ adres: 'straatHuisnummer', email: 'email' });
    expect(controleerBedrijfVelden(fout, { ...bedrijf, adres: 'Industrieweg' }).fouten).toEqual([
      { veld: 'email', fout: 'email' },
    ]);
    expect(bewaarbaarBedrijf(fout, bedrijf)).toEqual({ ...fout, adres: bedrijf.adres, email: bedrijf.email });
  });
});

describe('meldingen', () => {
  it('één regel per fout, met de veldnaam', () => {
    expect(
      validatieMelding(
        [
          { veld: 'adres.postcode', fout: 'postcode' },
          { veld: 'telefoon', fout: 'telefoon' },
        ],
        KLANT_VELDNAMEN,
      ),
    ).toBe(
      `Postcode van de klant: ${VALIDATIE_FOUTEN.postcode}.\nTelefoon van de klant: ${VALIDATIE_FOUTEN.telefoon}.`,
    );
    expect(validatieMelding([{ veld: 'email', fout: 'email' }], BEDRIJF_VELDNAMEN)).toContain(
      'E-mail van het bedrijf',
    );
    expect(VALIDATIE_FOUTEN.postcode).toBe(
      'Een postcode bestaat uit 4 cijfers en 2 letters, bijvoorbeeld 1234 AB',
    );
  });
});
