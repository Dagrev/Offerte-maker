import { describe, expect, it } from 'vitest';
import { leesGetal, schoonGetalInvoer, toonGetal } from '../../src/renderer/src/componenten/getalNotatie';

describe('schoonGetalInvoer', () => {
  it('laat cijfers en één komma door, met maximaal het aantal decimalen', () => {
    expect(schoonGetalInvoer('12,345', 2)).toBe('12,34');
    expect(schoonGetalInvoer('1,2,3', 2)).toBe('1,23');
    expect(schoonGetalInvoer('abc7', 2)).toBe('7');
  });

  it('maakt van een punt een komma en laat een minteken weg (geen negatieve waarden)', () => {
    expect(schoonGetalInvoer('-3.5', 2)).toBe('3,5');
  });

  it('staat bij 0 decimalen geen komma toe', () => {
    expect(schoonGetalInvoer('4,5', 0)).toBe('45');
  });
});

describe('leesGetal en toonGetal', () => {
  it('leest een getal met komma', () => {
    expect(leesGetal('12,5')).toBe(12.5);
    expect(leesGetal('7,')).toBe(7);
    expect(leesGetal('')).toBeNull();
    expect(leesGetal(',')).toBeNull();
    expect(leesGetal('-1')).toBeNull();
  });

  it('toont met komma en rondt af op het aantal decimalen', () => {
    expect(toonGetal(12.5, 2)).toBe('12,5');
    expect(toonGetal(1.005, 1)).toBe('1');
    expect(toonGetal(3.456, 2)).toBe('3,46');
    expect(toonGetal(null, 2)).toBe('');
  });
});
