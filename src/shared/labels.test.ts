import { describe, expect, it } from 'vitest';
import { KEUZE_STARTSET as K } from './keuzelijsten';
import {
  aanhefRegel,
  klantWeergave,
  labelBedekking,
  labelIsolatie,
  naamMetVoorletters,
  volledigeNaam,
  voorletters,
} from './labels';
import type { Aanhef } from './types';

describe('labels §9.1 (uit de keuzelijsten, OFM-034)', () => {
  it('bedekking anders → de ingevulde tekst; andere sleutels → het label', () => {
    expect(labelBedekking(K, 'epdm_15', 'wordt genegeerd')).toBe('EPDM 1,5 mm');
    expect(labelBedekking(K, 'anders', ' Zink ')).toBe('Zink');
    expect(labelBedekking(K, 'anders', '')).toBe('');
    expect(labelBedekking({ bedekking: [{ sleutel: 'epdm_15', label: 'EPDM dik' }] }, 'epdm_15', '')).toBe(
      'EPDM dik',
    );
  });

  it('isolatie anders → <n> mm', () => {
    expect(labelIsolatie(K, '100', 140)).toBe('100 mm');
    expect(labelIsolatie(K, 'anders', 140)).toBe('140 mm');
    expect(labelIsolatie(K, 'anders', null)).toBe('');
  });

  it('onbekende (verwijderde) sleutel toont zichzelf', () => {
    expect(labelBedekking(K, 'leien', '')).toBe('leien');
    expect(labelIsolatie(K, '160_mm', null)).toBe('160_mm');
  });
});

describe('namen (OFM-038)', () => {
  it('volledigeNaam: lege delen vallen weg', () => {
    expect(volledigeNaam({ voornaam: ' Jan ', achternaam: 'de Vries' })).toBe('Jan de Vries');
    expect(volledigeNaam({ voornaam: '', achternaam: 'Jansen' })).toBe('Jansen');
    expect(volledigeNaam({ voornaam: 'Jan', achternaam: ' ' })).toBe('Jan');
  });

  it('voorletters: per deel, ook na een koppelteken', () => {
    expect(voorletters('Jan')).toBe('J.');
    expect(voorletters('jan-willem  piet')).toBe('J.W.P.');
    expect(voorletters(' ')).toBe('');
  });

  it('naamMetVoorletters: zonder achternaam de voornaam voluit', () => {
    expect(naamMetVoorletters({ voornaam: 'Jan', achternaam: 'Jansen' })).toBe('J. Jansen');
    expect(naamMetVoorletters({ voornaam: '', achternaam: 'Jansen' })).toBe('Jansen');
    expect(naamMetVoorletters({ voornaam: 'Jan', achternaam: '' })).toBe('Jan');
  });
});

describe('aanhefRegel §9.2', () => {
  const k = (aanhef: Aanhef, achternaam: string, voornaam = 'Jan') => ({ aanhef, voornaam, achternaam });
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

  it('bedrijf zonder bedrijfsnaam → de contactpersoon', () => {
    expect(klantWeergave(k('bedrijf', 'Jansen', '  '))).toBe('J. Jansen');
  });
});
