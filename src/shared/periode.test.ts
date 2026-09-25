import { describe, expect, it } from 'vitest';
import { berekenGeldigTot, periodeVan, verschuif } from './periode';
import { formatDatum } from './formatteer';

describe('periodeVan', () => {
  it('dag', () => {
    expect(periodeVan('dag', '2026-09-25')).toEqual({
      van: '2026-09-25',
      tot: '2026-09-25',
      label: 'vrijdag 25 september 2026',
    });
  });

  it('week binnen één maand', () => {
    expect(periodeVan('week', '2026-09-25')).toEqual({
      van: '2026-09-21',
      tot: '2026-09-27',
      label: 'week 39 · 21 – 27 sep 2026',
    });
  });

  it('week loopt van maandag tot en met zondag (FE-013)', () => {
    expect(periodeVan('week', '2026-09-21').van).toBe('2026-09-21');
    const zondag = periodeVan('week', '2026-09-27');
    expect(zondag.van).toBe('2026-09-21');
    expect(zondag.tot).toBe('2026-09-27');
    expect(zondag.label).toBe('week 39 · 21 – 27 sep 2026');
  });

  it('week over een maandgrens', () => {
    expect(periodeVan('week', '2026-10-01')).toEqual({
      van: '2026-09-28',
      tot: '2026-10-04',
      label: 'week 40 · 28 sep – 4 okt 2026',
    });
  });

  it('week over de jaarwisseling', () => {
    const verwacht = { van: '2025-12-29', tot: '2026-01-04', label: 'week 1 · 29 dec 2025 – 4 jan 2026' };
    expect(periodeVan('week', '2025-12-29')).toEqual(verwacht);
    expect(periodeVan('week', '2026-01-04')).toEqual(verwacht);
  });

  it('jaar met ISO-week 53', () => {
    expect(periodeVan('week', '2026-12-31')).toEqual({
      van: '2026-12-28',
      tot: '2027-01-03',
      label: 'week 53 · 28 dec 2026 – 3 jan 2027',
    });
    expect(periodeVan('week', '2020-12-31').label).toBe('week 53 · 28 dec 2020 – 3 jan 2021');
  });

  it('maandafkortingen zonder punt', () => {
    expect(periodeVan('week', '2026-03-04').label).toBe('week 10 · 2 – 8 mrt 2026');
    expect(periodeVan('week', '2026-05-29').label).toBe('week 22 · 25 – 31 mei 2026');
    expect(periodeVan('week', '2026-06-30').label).toBe('week 27 · 29 jun – 5 jul 2026');
  });

  it('maand', () => {
    expect(periodeVan('maand', '2026-09-25')).toEqual({
      van: '2026-09-01',
      tot: '2026-09-30',
      label: 'september 2026',
    });
    expect(periodeVan('maand', '2028-02-10').tot).toBe('2028-02-29');
  });

  it('jaar', () => {
    expect(periodeVan('jaar', '2026-09-25')).toEqual({ van: '2026-01-01', tot: '2026-12-31', label: '2026' });
  });
});

describe('verschuif', () => {
  it('week terug levert een datum in de week van 14 t/m 20 sep (FE-011)', () => {
    const vorige = verschuif('week', '2026-09-25', -1);
    expect(periodeVan('week', vorige)).toMatchObject({ van: '2026-09-14', tot: '2026-09-20' });
  });

  it('week vooruit', () => {
    expect(periodeVan('week', verschuif('week', '2026-09-25', 1)).van).toBe('2026-09-28');
  });

  it('dag, maand en jaar in beide richtingen', () => {
    expect(verschuif('dag', '2026-09-25', -1)).toBe('2026-09-24');
    expect(verschuif('dag', '2026-12-31', 1)).toBe('2027-01-01');
    expect(verschuif('maand', '2026-09-25', -1)).toBe('2026-08-25');
    expect(verschuif('maand', '2026-12-15', 1)).toBe('2027-01-15');
    expect(verschuif('maand', '2026-01-31', 1)).toBe('2026-02-28');
    expect(verschuif('jaar', '2026-09-25', -1)).toBe('2025-09-25');
    expect(verschuif('jaar', '2026-09-25', 1)).toBe('2027-09-25');
  });
});

describe('berekenGeldigTot', () => {
  it('telt de geldigheid in dagen op bij de offertedatum (V-12, FE-058)', () => {
    expect(berekenGeldigTot('2026-09-25', 30)).toBe('2026-10-25');
    expect(formatDatum(berekenGeldigTot('2026-09-25', 30))).toBe('25-10-2026');
    expect(berekenGeldigTot('2026-12-15', 30)).toBe('2027-01-14');
    expect(berekenGeldigTot('2026-09-25', 0)).toBe('2026-09-25');
  });

  it('verschuift niet rond de zomertijdwissel', () => {
    expect(berekenGeldigTot('2026-03-20', 30)).toBe('2026-04-19');
    expect(berekenGeldigTot('2026-10-20', 30)).toBe('2026-11-19');
  });
});
