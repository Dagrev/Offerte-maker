import { describe, expect, it } from 'vitest';
import { beoordeelSelectie, splitsRedacties } from '../../src/renderer/src/componenten/redacties';

describe('splitsRedacties (review, FE-082)', () => {
  it('plaatshouders worden aparte delen met hun soort; de rest blijft gewone tekst', () => {
    expect(splitsRedacties('Geachte [VERWIJDERD],\nGroet, [BEDRIJF][VERWIJDERD]')).toEqual([
      { tekst: 'Geachte ', redactie: null },
      { tekst: '[VERWIJDERD]', redactie: 'verwijderd' },
      { tekst: ',\nGroet, ', redactie: null },
      { tekst: '[BEDRIJF]', redactie: 'bedrijf' },
      { tekst: '[VERWIJDERD]', redactie: 'verwijderd' },
    ]);
  });

  it('zonder plaatshouders één deel; lege tekst geen delen; lijkende tekst telt niet', () => {
    expect(splitsRedacties('Gewone tekst')).toEqual([{ tekst: 'Gewone tekst', redactie: null }]);
    expect(splitsRedacties('')).toEqual([]);
    expect(splitsRedacties('[verwijderd] [KLANT_NAAM]')).toEqual([
      { tekst: '[verwijderd] [KLANT_NAAM]', redactie: null },
    ]);
  });

  it('de delen samen geven de oorspronkelijke tekst terug (selectie = wat main kent)', () => {
    const tekst = 'a [BEDRIJF] b [VERWIJDERD] c';
    expect(
      splitsRedacties(tekst)
        .map((d) => d.tekst)
        .join(''),
    ).toBe(tekst);
  });
});

describe('beoordeelSelectie (Onleesbaar maken, 2–200 tekens)', () => {
  it('te kort, precies goed, te lang', () => {
    expect(beoordeelSelectie('  a \n')).toEqual({ soort: 'geen' });
    expect(beoordeelSelectie(' Jansen\n')).toEqual({ soort: 'ok', fragment: 'Jansen' });
    expect(beoordeelSelectie('ab')).toEqual({ soort: 'ok', fragment: 'ab' });
    expect(beoordeelSelectie('x'.repeat(200))).toEqual({ soort: 'ok', fragment: 'x'.repeat(200) });
    expect(beoordeelSelectie('x'.repeat(201))).toEqual({ soort: 'teLang' });
  });
});
