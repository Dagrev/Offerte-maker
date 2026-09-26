import { describe, expect, it } from 'vitest';
import { aanhefRegel, klantWeergave, naamMetVoorletters, volledigeNaam, voorletters } from './labels';
import type { Aanhef } from './types';

describe('namen (OFM-038)', () => {
  it('volledigeNaam: lege delen vallen weg', () => {
    expect(volledigeNaam({ voornaam: ' Jan ', tussenvoegsel: '', achternaam: 'de Vries' })).toBe('Jan de Vries');
    expect(volledigeNaam({ voornaam: '', tussenvoegsel: '', achternaam: 'Jansen' })).toBe('Jansen');
    expect(volledigeNaam({ voornaam: 'Jan', tussenvoegsel: '', achternaam: ' ' })).toBe('Jan');
  });

  it('voorletters: per deel, ook na een koppelteken', () => {
    expect(voorletters('Jan')).toBe('J.');
    expect(voorletters('jan-willem  piet')).toBe('J.W.P.');
    expect(voorletters(' ')).toBe('');
  });

  it('naamMetVoorletters: zonder achternaam de voornaam voluit', () => {
    expect(naamMetVoorletters({ voornaam: 'Jan', tussenvoegsel: '', achternaam: 'Jansen' })).toBe('J. Jansen');
    expect(naamMetVoorletters({ voornaam: '', tussenvoegsel: '', achternaam: 'Jansen' })).toBe('Jansen');
    expect(naamMetVoorletters({ voornaam: 'Jan', tussenvoegsel: '', achternaam: '' })).toBe('Jan');
  });
});

describe('aanhefRegel §9.2', () => {
  const k = (aanhef: Aanhef, achternaam: string, voornaam = 'Jan') => ({ aanhef, voornaam, tussenvoegsel: '', achternaam });
  it('per aanhef, met de achternaam', () => {
    expect(aanhefRegel(k('dhr', 'Jansen'))).toBe('Geachte heer Jansen,');
    expect(aanhefRegel(k('mevr', 'De Vries'))).toBe('Geachte mevrouw De Vries,');
    expect(aanhefRegel(k('fam', 'Bakker '))).toBe('Geachte familie Bakker,');
    expect(aanhefRegel(k('bedrijf', 'Jansen'))).toBe('Geachte heer, mevrouw,');
  });

  it('zonder achternaam de voornaam; zonder voornaam gewoon de achternaam (oude offertes)', () => {
    expect(aanhefRegel(k('dhr', ''))).toBe('Geachte heer Jan,');
    expect(aanhefRegel(k('dhr', 'Piet Jansen', ''))).toBe('Geachte heer Piet Jansen,');
  });
});

describe('klantWeergave §8.2', () => {
  const k = (aanhef: Aanhef, achternaam: string, bedrijfsnaam = '', voornaam = 'Jan') => ({
    aanhef,
    voornaam,
    tussenvoegsel: '',
    achternaam,
    bedrijfsnaam,
  });
  it('per aanhef: voorletters bij dhr. en mevr., niet bij fam.', () => {
    expect(klantWeergave(k('dhr', 'Jansen'))).toBe('Dhr. J. Jansen');
    expect(klantWeergave(k('mevr', 'de Vries', '', 'Anna'))).toBe('Mevr. A. de Vries');
    expect(klantWeergave(k('fam', 'Bakker', 'x'))).toBe('Fam. Bakker');
    expect(klantWeergave(k('bedrijf', 'Jansen', 'Bouw BV'))).toBe('Bouw BV');
  });

  it('zonder voornaam (oude offerte na migratie 003) precies zoals vroeger', () => {
    expect(klantWeergave(k('dhr', 'P. Jansen', '', ''))).toBe('Dhr. P. Jansen');
    expect(klantWeergave(k('fam', '', '', 'Jan'))).toBe('Fam. Jan');
  });

  it('OFM-046: tussenvoegsel klein na voorletters, met hoofdletter na "Fam." en in de aanhef', () => {
    const berg = { voornaam: 'Jan', tussenvoegsel: 'van der', achternaam: 'Berg', bedrijfsnaam: 'Bouw BV' };
    expect(klantWeergave({ ...berg, aanhef: 'dhr' })).toBe('Dhr. J. van der Berg');
    expect(klantWeergave({ ...berg, aanhef: 'fam' })).toBe('Fam. Van der Berg');
    expect(klantWeergave({ ...berg, aanhef: 'bedrijf', bedrijfsnaam: '' })).toBe('J. van der Berg');
    expect(aanhefRegel({ ...berg, aanhef: 'dhr' })).toBe('Geachte heer Van der Berg,');
    expect(aanhefRegel({ ...berg, aanhef: 'fam' })).toBe('Geachte familie Van der Berg,');
    expect(volledigeNaam(berg)).toBe('Jan van der Berg');
  });

  it('bedrijf zonder bedrijfsnaam → de contactpersoon', () => {
    expect(klantWeergave(k('bedrijf', 'Jansen', '  '))).toBe('J. Jansen');
  });
});
