import { describe, expect, it } from 'vitest';
import {
  leesGetal,
  schoonGetalInvoer,
  tekstVolgtWaarde,
  toonGetal,
} from '../../src/renderer/src/componenten/getalNotatie';

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

describe('schoonGetalInvoer: overschrijven, leegmaken en plakken (OFM-032)', () => {
  it('laat een voorloopnul vallen, zodat typen na de 0 geen "05" geeft', () => {
    expect(schoonGetalInvoer('05', 2)).toBe('5');
    expect(schoonGetalInvoer('007', 0)).toBe('7');
    expect(schoonGetalInvoer('0,5', 2)).toBe('0,5');
    expect(schoonGetalInvoer('0', 2)).toBe('0');
  });

  it('laat een leeggemaakt veld leeg', () => {
    expect(schoonGetalInvoer('', 2)).toBe('');
    expect(leesGetal(schoonGetalInvoer('', 2))).toBeNull();
  });

  it('accepteert komma en punt beide als decimaalteken', () => {
    expect(schoonGetalInvoer('12,5', 2)).toBe('12,5');
    expect(schoonGetalInvoer('12.5', 2)).toBe('12,5');
    expect(schoonGetalInvoer('1234.50', 2)).toBe('1234,50');
    expect(schoonGetalInvoer('1,234', 2)).toBe('1,23');
  });

  it('haalt geplakte duizendtallen weg', () => {
    expect(schoonGetalInvoer('1.234,50', 2)).toBe('1234,50');
    expect(schoonGetalInvoer('1,234.50', 2)).toBe('1234,50');
    expect(schoonGetalInvoer('1.234.567', 0)).toBe('1234567');
    expect(schoonGetalInvoer('1,234,567', 2)).toBe('1234567');
    expect(schoonGetalInvoer('12.345,', 2)).toBe('12345,');
    expect(schoonGetalInvoer(' 1 234,50 ', 2)).toBe('1234,50');
    expect(leesGetal(schoonGetalInvoer('1.234,50', 2))).toBe(1234.5);
    expect(leesGetal(schoonGetalInvoer('1234.50', 2))).toBe(1234.5);
    expect(toonGetal(leesGetal(schoonGetalInvoer('1.234,50', 2)), 2)).toBe('1234,5');
  });

  it('weigert een minteken, ook in een geplakt getal met duizendtallen', () => {
    expect(schoonGetalInvoer('-1.234,50', 2)).toBe('1234,50');
    expect(schoonGetalInvoer('-', 2)).toBe('');
  });

  it('valt terug op het oude gedrag bij scheidingstekens die geen duizendtallen zijn', () => {
    expect(schoonGetalInvoer('1.2.3', 2)).toBe('1,23');
    expect(schoonGetalInvoer('1,5.', 2)).toBe('1,5');
  });
});

describe('tekstVolgtWaarde', () => {
  it('laat de tekst staan als die dezelfde waarde voorstelt', () => {
    expect(tekstVolgtWaarde('12,', 12)).toBe(false);
    expect(tekstVolgtWaarde('5', 5)).toBe(false);
  });

  it('laat een leeg veld leeg als de waarde 0 of leeg wordt (placeholder 0)', () => {
    expect(tekstVolgtWaarde('', 0)).toBe(false);
    expect(tekstVolgtWaarde('', null)).toBe(false);
  });

  it('volgt een echte wijziging van buiten', () => {
    expect(tekstVolgtWaarde('', 7)).toBe(true);
    expect(tekstVolgtWaarde('3', 4)).toBe(true);
    expect(tekstVolgtWaarde('3', null)).toBe(true);
  });
});
