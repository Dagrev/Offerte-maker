import { describe, expect, it } from 'vitest';
import { formatNummer, versieletter, weergaveNummer } from './nummering';

describe('formatNummer', () => {
  it('vult aan tot drie cijfers, daarboven gewoon doorlopen', () => {
    expect(formatNummer(2026, 1)).toBe('2026-001');
    expect(formatNummer(2026, 42)).toBe('2026-042');
    expect(formatNummer(2026, 999)).toBe('2026-999');
    expect(formatNummer(2026, 1000)).toBe('2026-1000');
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
    expect(weergaveNummer(null, null)).toBeNull();
  });
});
