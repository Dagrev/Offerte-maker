import { describe, expect, it } from 'vitest';
import {
  formatAantal,
  formatDatum,
  formatDatumLang,
  formatEuro,
  formatEuroHeel,
  formatM2,
  leesDatum,
  schrijfDatum,
} from './formatteer';

describe('formatEuro', () => {
  it('geeft € met gewone spatie, punt voor duizendtallen en komma voor centen', () => {
    expect(formatEuro(123456)).toBe('€ 1.234,56');
    expect(formatEuro(0)).toBe('€ 0,00');
    expect(formatEuro(5)).toBe('€ 0,05');
    expect(formatEuro(247944)).toBe('€ 2.479,44');
  });

  it('bevat geen harde spatie', () => {
    expect(formatEuro(123456)).not.toMatch(/[  ]/);
    expect(formatEuroHeel(123456)).not.toMatch(/[  ]/);
  });
});

describe('formatEuroHeel', () => {
  it('geeft hele euro’s, half van nul af (V-14, V-27)', () => {
    expect(formatEuroHeel(481200)).toBe('€ 4.812');
    expect(formatEuroHeel(481250)).toBe('€ 4.813');
    expect(formatEuroHeel(481249)).toBe('€ 4.812');
    expect(formatEuroHeel(0)).toBe('€ 0');
  });
});

describe('formatAantal en formatM2', () => {
  it('formatAantal laat overbodige nullen weg', () => {
    expect(formatAantal(3480)).toBe('34,8');
    expect(formatAantal(100)).toBe('1');
    expect(formatAantal(3485)).toBe('34,85');
    expect(formatAantal(0)).toBe('0');
  });

  it('formatM2 geeft altijd twee decimalen', () => {
    expect(formatM2(3480)).toBe('34,80');
    expect(formatM2(100)).toBe('1,00');
    expect(formatM2(3485)).toBe('34,85');
  });
});

describe('datums', () => {
  it('formatDatum en formatDatumLang', () => {
    expect(formatDatum('2026-09-25')).toBe('25-09-2026');
    expect(formatDatum('2026-01-01')).toBe('01-01-2026');
    expect(formatDatumLang('2026-09-25')).toBe('25 september 2026');
    expect(formatDatumLang('2026-03-01')).toBe('1 maart 2026');
  });

  it('leest en schrijft lokale kalenderdatums zonder verschuiving', () => {
    const d = leesDatum('2026-01-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 0, 1, 0]);
    expect(schrijfDatum(d)).toBe('2026-01-01');
    expect(schrijfDatum(leesDatum('2026-12-31'))).toBe('2026-12-31');
  });
});
