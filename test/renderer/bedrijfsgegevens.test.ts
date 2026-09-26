import { describe, expect, it } from 'vitest';
import { standaardInstelling } from '@shared/schemas';
import { ontbrekendeBedrijfsgegevens } from '../../src/renderer/src/componenten/bedrijfsgegevens';
import { useBedrijfHint } from '../../src/renderer/src/stores/bedrijfHint';

// OFM-029: welke bedrijfsgegevens het welkomstscherm na stap 1 als ontbrekend meldt, en de hint-store.

const leeg = standaardInstelling('bedrijf');
const compleet = {
  ...leeg,
  naam: 'Dakwerken Zuid',
  adres: 'Industrieweg 1',
  postcode: '5600 AA',
  plaats: 'Eindhoven',
  kvk: '12345678',
  btwNummer: 'NL001234567B01',
  iban: 'NL00BANK0123456789',
};

describe('ontbrekendeBedrijfsgegevens', () => {
  it('alles leeg: naam, adres, KvK, btw-nummer en IBAN, in die volgorde', () => {
    expect(ontbrekendeBedrijfsgegevens(leeg)).toEqual(['naam', 'adres', 'kvk', 'btwNummer', 'iban']);
  });

  it('compleet: niets; contactpersoon, telefoon, e-mail en website tellen niet mee', () => {
    expect(ontbrekendeBedrijfsgegevens(compleet)).toEqual([]);
  });

  it('alleen spaties telt als leeg', () => {
    expect(ontbrekendeBedrijfsgegevens({ ...compleet, naam: '  ', iban: '\t' })).toEqual(['naam', 'iban']);
  });

  it.each(['adres', 'postcode', 'plaats'] as const)('adres ontbreekt als %s leeg is', (veld) => {
    expect(ontbrekendeBedrijfsgegevens({ ...compleet, [veld]: '' })).toEqual(['adres']);
  });
});

describe('useBedrijfHint', () => {
  it('begint zichtbaar; verberg geldt voor deze start', () => {
    expect(useBedrijfHint.getState().verborgen).toBe(false);
    useBedrijfHint.getState().verberg();
    expect(useBedrijfHint.getState().verborgen).toBe(true);
  });
});
