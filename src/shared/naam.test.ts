import { describe, expect, it } from 'vitest';
import { naamVan, normaliseerTussenvoegsel, voorletters } from './naam';

const berg = { voornaam: 'Jan', tussenvoegsel: 'van der', achternaam: 'Berg' };

describe('naamVan (OFM-046)', () => {
  it('alle vormen met een tussenvoegsel', () => {
    expect(naamVan(berg, 'volledig')).toBe('Jan van der Berg');
    expect(naamVan(berg, 'voorletters')).toBe('J. van der Berg');
    expect(naamVan(berg, 'achternaam')).toBe('van der Berg');
    expect(naamVan(berg, 'achternaamVooraan')).toBe('Van der Berg');
  });

  it('tussenvoegsel alleen vooraan met hoofdletter, verder klein, ook als het anders bewaard is', () => {
    const k = { ...berg, tussenvoegsel: ' Van  Der ' };
    expect(naamVan(k, 'voorletters')).toBe('J. van der Berg');
    expect(naamVan(k, 'achternaamVooraan')).toBe('Van der Berg');
  });

  it("'t en 's blijven vooraan klein", () => {
    const k = { voornaam: 'Piet', tussenvoegsel: "'t", achternaam: 'Hart' };
    expect(naamVan(k, 'achternaamVooraan')).toBe("'t Hart");
    expect(naamVan(k, 'voorletters')).toBe("P. 't Hart");
  });

  it('zonder tussenvoegsel precies zoals vóór OFM-046 (ook een achternaam met "de" erin)', () => {
    const k = { voornaam: 'Anna', tussenvoegsel: '', achternaam: 'de Vries' };
    expect(naamVan(k, 'volledig')).toBe('Anna de Vries');
    expect(naamVan(k, 'voorletters')).toBe('A. de Vries');
    expect(naamVan(k, 'achternaam')).toBe('de Vries');
    expect(naamVan(k, 'achternaamVooraan')).toBe('de Vries');
  });

  it('tussenvoegsel zonder achternaam telt niet mee; zonder achternaam de voornaam voluit', () => {
    const k = { voornaam: 'Jan', tussenvoegsel: 'van', achternaam: ' ' };
    expect(naamVan(k, 'volledig')).toBe('Jan');
    expect(naamVan(k, 'voorletters')).toBe('Jan');
    expect(naamVan(k, 'achternaam')).toBe('');
    expect(naamVan(k, 'achternaamVooraan')).toBe('');
  });

  it('zonder voornaam geen voorletters', () => {
    expect(naamVan({ ...berg, voornaam: '' }, 'voorletters')).toBe('van der Berg');
    expect(naamVan({ ...berg, voornaam: '' }, 'volledig')).toBe('van der Berg');
  });
});

describe('hulpfuncties', () => {
  it('normaliseerTussenvoegsel: trimmen, enkele spaties, kleine letters', () => {
    expect(normaliseerTussenvoegsel('  Van  DER ')).toBe('van der');
    expect(normaliseerTussenvoegsel('')).toBe('');
  });

  it('voorletters', () => {
    expect(voorletters('jan-willem  piet')).toBe('J.W.P.');
    expect(voorletters(' ')).toBe('');
  });
});
