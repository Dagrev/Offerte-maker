import { describe, expect, it } from 'vitest';
import { heeftOudeKeuzes, oudeVelden } from './oudeInvoer';

// OFM-044: de velden van de oude stap Extra's, alleen nog in oude offertes.

describe('oudeVelden', () => {
  it('vult ontbrekende velden aan met "niets gekozen"', () => {
    expect(oudeVelden({})).toEqual({
      bedekking: null,
      bedekkingAnders: '',
      slopenEnAfvoeren: false,
      isolatie: 'geen',
      isolatieAndersMm: null,
      daktrimM1: 0,
      dakgootM1: 0,
      hwaAantal: 0,
      noodoverloopAantal: 0,
      doorvoerAantal: 0,
      lichtkoepelAantal: 0,
      afwerking: 'geen',
      extraAantallen: {},
    });
    expect(oudeVelden({ bedekking: 'bitumen', hwaAantal: 2 })).toMatchObject({
      bedekking: 'bitumen',
      hwaAantal: 2,
    });
  });
});

describe('heeftOudeKeuzes', () => {
  it.each([
    [{}, false],
    [{ bedekking: 'epdm_11' }, true],
    [{ slopenEnAfvoeren: true }, true],
    [{ isolatie: '80' }, true],
    [{ afwerking: 'grind' }, true],
    [{ daktrimM1: 0.5 }, true],
    [{ extraAantallen: { zink: 0 } }, false],
    [{ extraAantallen: { zink: 2 } }, true],
  ])('%j → %s', (invoer, verwacht) => {
    expect(heeftOudeKeuzes(invoer)).toBe(verwacht);
  });
});
