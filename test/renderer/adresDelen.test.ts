import { describe, expect, it } from 'vitest';
import { controleerStraatHuisnummer } from '@shared/validatie';
import {
  adresFouten,
  splitsAdres,
  terugZoekSleutel,
  vergelijkVorm,
  voegSamen,
  wijktAf,
  zoekSleutel,
} from '../../src/renderer/src/componenten/adresDelen';

// OFM-031: straat en huisnummer los op het scherm, één veld in het datamodel.

describe('splitsAdres en voegSamen', () => {
  it.each([
    ['Dorpsstraat 12', 'Dorpsstraat', '12'],
    ['  Dorpsstraat   12 a ', 'Dorpsstraat', '12 a'],
    ['2e Helmersstraat 7-3', '2e Helmersstraat', '7-3'],
    ['Laan 1940-1945 3', 'Laan 1940-1945', '3'],
    ['Hoek', 'Hoek', ''],
    ['', '', ''],
  ])('%j → %j + %j', (veld, straat, huisnummer) => {
    expect(splitsAdres(veld)).toEqual({ straat, huisnummer });
  });

  it('voegSamen laat lege delen weg; splitsen en samenvoegen is stabiel', () => {
    expect(voegSamen({ straat: ' Dorpsstraat ', huisnummer: '12A' })).toBe('Dorpsstraat 12A');
    expect(voegSamen({ straat: '', huisnummer: '12' })).toBe('12');
    expect(voegSamen({ straat: 'Hoek', huisnummer: '' })).toBe('Hoek');
    for (const v of ['Dorpsstraat 12', 'Kerkstraat 12 bis', 'Hoek'])
      expect(voegSamen(splitsAdres(v))).toBe(v);
  });
});

describe('adresFouten', () => {
  it('geen fouten bij een geldig of leeg adres', () => {
    expect(adresFouten('5611 AB', { straat: 'Dorpsstraat', huisnummer: '12' })).toEqual({});
    expect(adresFouten('', { straat: '', huisnummer: '' })).toEqual({});
    // Oude schrijfwijze: nummer in het straatveld telt ook.
    expect(adresFouten('', { straat: 'Dorpsstraat 5', huisnummer: '' })).toEqual({});
  });

  it('per los veld, in lijn met controleerStraatHuisnummer', () => {
    expect(adresFouten('12345', { straat: '', huisnummer: '' })).toEqual({ postcode: 'postcode' });
    expect(adresFouten('', { straat: 'Hoek', huisnummer: '' })).toEqual({ huisnummer: 'huisnummerLeeg' });
    expect(adresFouten('', { straat: 'Hoek', huisnummer: 'twaalf' })).toEqual({ huisnummer: 'huisnummer' });
    expect(adresFouten('', { straat: '', huisnummer: '12' })).toEqual({ straat: 'straatLeeg' });
    expect(adresFouten('', { straat: '123', huisnummer: '12' })).toEqual({ straat: 'straatLeeg' });
    for (const [straat, huisnummer] of [
      ['Hoek', ''],
      ['', '12'],
      ['Dorp', '12a'],
      ['Dorp', 'x'],
    ] as const) {
      const leeg = Object.keys(adresFouten('', { straat, huisnummer })).length === 0;
      expect(leeg).toBe(controleerStraatHuisnummer(voegSamen({ straat, huisnummer })).geldig);
    }
  });
});

describe('zoekSleutel', () => {
  it('alleen met een geldige postcode en huisnummer', () => {
    expect(zoekSleutel('5611ab', '12 a')).toBe('5611 AB|12A');
    expect(zoekSleutel('5611 AB', '12')).toBe('5611 AB|12');
    expect(zoekSleutel('', '12')).toBeNull();
    expect(zoekSleutel('1234 SA', '12')).toBeNull();
    expect(zoekSleutel('5611 AB', '')).toBeNull();
  });
});

describe('OFM-040: andersom opzoeken en controleren', () => {
  it('vergelijkVorm: kleine letters, witruimte samengevoegd', () => {
    expect(vergelijkVorm('  Lange   LAAN ')).toBe('lange laan');
  });

  it('terugZoekSleutel alleen bij lege postcode, straat en plaats met letters en een geldig huisnummer', () => {
    const d = (straat: string, huisnummer: string) => ({ straat, huisnummer });
    expect(terugZoekSleutel('', d(' Dorps  Straat', '12a'), 'Eindhoven ')).toBe('dorps straat|12A|eindhoven');
    expect(terugZoekSleutel('5611 AB', d('Dorpsstraat', '12'), 'Eindhoven')).toBeNull();
    expect(terugZoekSleutel(' ', d('Dorpsstraat', 'x'), 'Eindhoven')).toBeNull();
    expect(terugZoekSleutel('', d('', '12'), 'Eindhoven')).toBeNull();
    expect(terugZoekSleutel('', d('Dorpsstraat', '12'), '')).toBeNull();
  });

  it('wijktAf: alleen bij dezelfde postcode + huisnummer, ingevulde velden en een echt verschil', () => {
    const t = { sleutel: '5611 AB|12', straat: 'Dorpsstraat', plaats: 'Eindhoven' };
    expect(wijktAf(t, '5611 AB|12', 'dorpsstraat ', 'EINDHOVEN')).toBe(false);
    expect(wijktAf(t, '5611 AB|12', 'Kerkstraat', 'Eindhoven')).toBe(true);
    expect(wijktAf(t, '5611 AB|12', 'Dorpsstraat', 'Best')).toBe(true);
    expect(wijktAf(t, '5611 AB|12', '', 'Best')).toBe(false);
    expect(wijktAf(t, '5611 AB|12', 'Kerkstraat', ' ')).toBe(false);
    expect(wijktAf(t, '5611 AB|14', 'Kerkstraat', 'Eindhoven')).toBe(false);
    expect(wijktAf(null, '5611 AB|12', 'Kerkstraat', 'Eindhoven')).toBe(false);
  });
});
