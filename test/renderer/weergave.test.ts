import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_ZOOM,
  MIN_PASSEND,
  MIN_ZOOM,
  ZOOM_STAPPEN,
  kanGroter,
  kanKleiner,
  passendeSchaal,
  useWeergave,
  volgendeStap,
  vorigeStap,
  zoomPercentage,
} from '../../src/renderer/src/stores/weergave';

// OFM-054: zoomstand van het offertevoorbeeld.

const A4 = { breedte: 794, hoogte: 1123 };

beforeEach(() => useWeergave.setState({ zoom: 'passend' }));

describe('passendeSchaal', () => {
  it('kleinste van breedte en hoogte, min de marge', () => {
    // Hoge, smalle houder: de breedte bepaalt.
    expect(passendeSchaal(794 / 2 + 32, 2000, A4)).toBeCloseTo(0.5);
    // Brede, lage houder: de hoogte bepaalt.
    expect(passendeSchaal(3000, 1123 / 2 + 32, A4)).toBeCloseTo(0.5);
  });

  it('binnen het zoombereik, ook bij een nog niet gemeten houder', () => {
    expect(passendeSchaal(0, 0, A4)).toBe(MIN_ZOOM);
    // Kleine houder: onder de kleinste stap (tot 10 %), zodat de pagina toch past.
    expect(passendeSchaal(794 * 0.19 + 32, 1123 * 0.19 + 32, A4)).toBeCloseTo(0.19);
    expect(passendeSchaal(50, 50, A4)).toBe(MIN_PASSEND);
    expect(kanKleiner(0.19)).toBe(false);
    expect(volgendeStap(0.19)).toBe(0.25);
    expect(passendeSchaal(100_000, 100_000, A4)).toBe(MAX_ZOOM);
  });
});

describe('stappen', () => {
  it('− en + gaan naar de volgende stap, ook vanuit een tussenwaarde (Passend)', () => {
    expect(ZOOM_STAPPEN).toEqual([0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3]);
    expect(volgendeStap(0.72)).toBe(0.75);
    expect(vorigeStap(0.72)).toBe(0.67);
    expect(volgendeStap(1)).toBe(1.25);
    expect(vorigeStap(1)).toBe(0.75);
  });

  it('aan het einde van het bereik blijft het staan en is de knop uit', () => {
    expect(volgendeStap(3)).toBe(3);
    expect(vorigeStap(0.25)).toBe(0.25);
    expect(kanGroter(3)).toBe(false);
    expect(kanKleiner(0.25)).toBe(false);
    expect(kanGroter(2)).toBe(true);
    expect(kanKleiner(0.33)).toBe(true);
  });

  it('percentage afgerond met spatie', () => {
    expect(zoomPercentage(0.7234)).toBe('72 %');
    expect(zoomPercentage(1)).toBe('100 %');
  });
});

describe('useWeergave', () => {
  it('begint passend en onthoudt de laatste stand', () => {
    expect(useWeergave.getState().zoom).toBe('passend');
    useWeergave.getState().zetZoom(1.5);
    expect(useWeergave.getState().zoom).toBe(1.5);
  });
});
