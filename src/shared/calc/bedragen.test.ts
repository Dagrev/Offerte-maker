import { describe, expect, it } from 'vitest';
import type { BtwTarief } from '../types';
import {
  aantalNaarHonderdsten,
  berekenTotalen,
  euroNaarCent,
  m2VanDakvlak,
  regelbedragCent,
  rondAf,
  totaalM2,
} from './bedragen';

const regel = (aantalHonderdsten: number, prijsCent: number, btwTarief: BtwTarief) => ({
  aantalHonderdsten,
  prijsCent,
  btwTarief,
});

describe('rondAf', () => {
  it('rondt half van nul af, ook negatief', () => {
    expect(rondAf(0.5)).toBe(1);
    expect(rondAf(-0.5)).toBe(-1);
    expect(rondAf(1.5)).toBe(2);
    expect(rondAf(-1.5)).toBe(-2);
    expect(rondAf(2.5)).toBe(3);
    expect(rondAf(-2.5)).toBe(-3);
  });

  it('rondt gewoon af onder en boven de helft', () => {
    expect(rondAf(1.49)).toBe(1);
    expect(rondAf(-1.49)).toBe(-1);
    expect(rondAf(1.51)).toBe(2);
    expect(rondAf(-1.51)).toBe(-2);
  });

  it('geeft 0 en nooit -0', () => {
    expect(Object.is(rondAf(0), 0)).toBe(true);
    expect(Object.is(rondAf(-0.4), 0)).toBe(true);
  });
});

describe('regelbedragCent', () => {
  it('rekent aantal in honderdsten maal prijs in centen', () => {
    expect(regelbedragCent({ aantalHonderdsten: 3480, prijsCent: 5500 })).toBe(191400);
    expect(regelbedragCent({ aantalHonderdsten: 100, prijsCent: 15000 })).toBe(15000);
  });

  it('rondt af op hele centen', () => {
    // 0,33 × 1,99 = 0,6567 → 66 cent
    expect(regelbedragCent({ aantalHonderdsten: 33, prijsCent: 199 })).toBe(66);
    // 0,5 × 0,01 = 0,005 → half van nul af → 1 cent
    expect(regelbedragCent({ aantalHonderdsten: 50, prijsCent: 1 })).toBe(1);
    expect(regelbedragCent({ aantalHonderdsten: 50, prijsCent: -1 })).toBe(-1);
  });
});

describe('berekenTotalen', () => {
  it('controlevoorbeeld FE-038', () => {
    const t = berekenTotalen([regel(3480, 5500, 21), regel(100, 15000, 9)]);
    expect(t).toEqual({
      subtotaalCent: 206400,
      btw: [
        { tarief: 21, grondslagCent: 191400, bedragCent: 40194 },
        { tarief: 9, grondslagCent: 15000, bedragCent: 1350 },
      ],
      totaalCent: 247944,
    });
  });

  it('lege regellijst geeft alles 0', () => {
    expect(berekenTotalen([])).toEqual({ subtotaalCent: 0, btw: [], totaalCent: 0 });
  });

  it('zet btw-regels in de volgorde 21, 9, 0, ongeacht de volgorde van de regels', () => {
    const t = berekenTotalen([regel(100, 1000, 0), regel(100, 1000, 9), regel(100, 1000, 21)]);
    expect(t.btw.map((b) => b.tarief)).toEqual([21, 9, 0]);
    expect(t.btw).toEqual([
      { tarief: 21, grondslagCent: 1000, bedragCent: 210 },
      { tarief: 9, grondslagCent: 1000, bedragCent: 90 },
      { tarief: 0, grondslagCent: 1000, bedragCent: 0 },
    ]);
    expect(t.subtotaalCent).toBe(3000);
    expect(t.totaalCent).toBe(3300);
  });

  it('toont 0 % alleen bij regels met 0 %', () => {
    expect(berekenTotalen([regel(100, 1000, 21)]).btw.map((b) => b.tarief)).toEqual([21]);
    expect(berekenTotalen([regel(100, 1000, 0)]).btw).toEqual([
      { tarief: 0, grondslagCent: 1000, bedragCent: 0 },
    ]);
    expect(berekenTotalen([regel(100, 1000, 9)]).btw.map((b) => b.tarief)).toEqual([9]);
  });

  it('telt regels met hetzelfde tarief op tot één grondslag en rekent btw daarover', () => {
    // 2 × 0,05 btw zou los 2 × 1 = 2 cent zijn; over de grondslag 50 cent is het 11 (10,5 → 11).
    const t = berekenTotalen([regel(100, 25, 21), regel(100, 25, 21)]);
    expect(t.btw).toEqual([{ tarief: 21, grondslagCent: 50, bedragCent: 11 }]);
    expect(t.totaalCent).toBe(61);
  });

  it('werkt met negatieve regels (korting)', () => {
    const t = berekenTotalen([regel(100, 10000, 21), regel(100, -2050, 21)]);
    expect(t.subtotaalCent).toBe(7950);
    expect(t.btw).toEqual([{ tarief: 21, grondslagCent: 7950, bedragCent: 1670 }]);
    expect(t.totaalCent).toBe(9620);
  });
});

describe('m2VanDakvlak en totaalM2', () => {
  const lxb = (lengteM: number | null, breedteM: number | null) => ({
    modus: 'lxb' as const,
    lengteM,
    breedteM,
    m2: null,
  });
  const m2 = (waarde: number | null) => ({ modus: 'm2' as const, lengteM: null, breedteM: null, m2: waarde });

  it('rekent lengte × breedte op twee decimalen', () => {
    expect(m2VanDakvlak(lxb(5, 4.5))).toBe(22.5);
    expect(m2VanDakvlak(lxb(3.333, 3.333))).toBe(11.11);
  });

  it('neemt bij modus m2 de opgegeven oppervlakte', () => {
    expect(m2VanDakvlak(m2(12.3))).toBe(12.3);
  });

  it('telt null en negatieve maten als 0', () => {
    expect(m2VanDakvlak(lxb(null, 4))).toBe(0);
    expect(m2VanDakvlak(lxb(4, null))).toBe(0);
    expect(m2VanDakvlak(lxb(-2, 4))).toBe(0);
    expect(m2VanDakvlak(lxb(4, -2))).toBe(0);
    expect(m2VanDakvlak(m2(null))).toBe(0);
    expect(m2VanDakvlak(m2(-5))).toBe(0);
  });

  it('FE-023: 5 × 4,5 en 12,3 m² → 34,8', () => {
    expect(totaalM2([lxb(5, 4.5), m2(12.3)])).toBe(34.8);
  });

  it('negeert ongeldige vlakken in het totaal en rondt af op twee decimalen', () => {
    expect(totaalM2([lxb(5, 4.5), lxb(null, 3), m2(-1)])).toBe(22.5);
    expect(totaalM2([m2(0.1), m2(0.2)])).toBe(0.3);
    expect(totaalM2([])).toBe(0);
  });
});

describe('euroNaarCent en aantalNaarHonderdsten', () => {
  it('rekent om naar integers', () => {
    expect(euroNaarCent(12.5)).toBe(1250);
    expect(euroNaarCent(0.1 + 0.2)).toBe(30);
    expect(euroNaarCent(-19.99)).toBe(-1999);
    expect(aantalNaarHonderdsten(34.8)).toBe(3480);
    expect(aantalNaarHonderdsten(1)).toBe(100);
    expect(aantalNaarHonderdsten(1.15)).toBe(115);
  });
});
