import { describe, expect, it } from 'vitest';
import { controleerStraatHuisnummer } from '@shared/validatie';
import {
  adresFouten,
  splitsAdres,
  voegSamen,
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
