import { describe, expect, it } from 'vitest';
import { formatNummer, jaarVan, versieletter, weergaveNummer } from './nummering';

describe('formatNummer', () => {
  it('is datum plus volgnummer, aangevuld tot drie cijfers, daarboven gewoon doorlopen (OFM-033)', () => {
    expect(formatNummer('2026-09-26', 1)).toBe('2026-09-26-001');
    expect(formatNummer('2026-09-26', 42)).toBe('2026-09-26-042');
    expect(formatNummer('2026-12-31', 999)).toBe('2026-12-31-999');
    expect(formatNummer('2026-01-02', 1000)).toBe('2026-01-02-1000');
  });

  it('weigert iets anders dan een datum', () => {
    expect(() => formatNummer('2026', 1)).toThrow(RangeError);
    expect(() => formatNummer('26-09-2026', 1)).toThrow(RangeError);
  });
});

describe('jaarVan', () => {
  it('haalt het jaar uit een datum', () => {
    expect(jaarVan('2027-01-03')).toBe(2027);
  });
});

describe('versieletter', () => {
  it('geeft geen letter voor de eerste PDF, dan b, c, …', () => {
    expect(versieletter(0)).toBe('');
    expect(versieletter(1)).toBe('b');
    expect(versieletter(2)).toBe('c');
    expect(versieletter(25)).toBe('z');
  });

  it('weigert ongeldige aantallen', () => {
    expect(() => versieletter(-1)).toThrow(RangeError);
    expect(() => versieletter(1.5)).toThrow(RangeError);
    expect(() => versieletter(26)).toThrow(RangeError);
  });
});

describe('weergaveNummer', () => {
  it('is nummer plus versieletter van de laatste PDF', () => {
    expect(weergaveNummer('2026-001', '')).toBe('2026-001');
    expect(weergaveNummer('2026-001', 'b')).toBe('2026-001b');
    expect(weergaveNummer('2026-001', null)).toBe('2026-001');
    expect(weergaveNummer('2026-09-26-001', 'b')).toBe('2026-09-26-001b');
    expect(weergaveNummer(null, null)).toBeNull();
  });
});
