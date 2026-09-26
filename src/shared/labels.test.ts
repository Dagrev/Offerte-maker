import { describe, expect, it } from 'vitest';
import { KEUZE_STARTSET as K } from './keuzelijsten';
import { aanhefRegel, klantWeergave, labelBedekking, labelIsolatie } from './labels';

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

describe('aanhefRegel §9.2', () => {
  it('per aanhef', () => {
    expect(aanhefRegel({ aanhef: 'dhr', naam: 'Jansen' })).toBe('Geachte heer Jansen,');
    expect(aanhefRegel({ aanhef: 'mevr', naam: 'De Vries' })).toBe('Geachte mevrouw De Vries,');
    expect(aanhefRegel({ aanhef: 'fam', naam: 'Bakker ' })).toBe('Geachte familie Bakker,');
    expect(aanhefRegel({ aanhef: 'bedrijf', naam: 'Jansen' })).toBe('Geachte heer, mevrouw,');
  });
});

describe('klantWeergave §8.2', () => {
  it('per aanhef', () => {
    expect(klantWeergave({ aanhef: 'dhr', naam: 'Jansen', bedrijfsnaam: '' })).toBe('Dhr. Jansen');
    expect(klantWeergave({ aanhef: 'mevr', naam: 'De Vries', bedrijfsnaam: '' })).toBe('Mevr. De Vries');
    expect(klantWeergave({ aanhef: 'fam', naam: 'Bakker', bedrijfsnaam: 'x' })).toBe('Fam. Bakker');
    expect(klantWeergave({ aanhef: 'bedrijf', naam: 'Jansen', bedrijfsnaam: 'Bouw BV' })).toBe('Bouw BV');
  });

  it('bedrijf zonder bedrijfsnaam → de naam', () => {
    expect(klantWeergave({ aanhef: 'bedrijf', naam: 'Jansen', bedrijfsnaam: '  ' })).toBe('Jansen');
  });
});
