import { describe, expect, it } from 'vitest';
import * as s from './schemas';
import {
  AFWERKING_LABELS,
  BEDEKKING_LABELS,
  HOOGTE_LABELS,
  HUIDIGE_BEDEKKING_LABELS,
  ISOLATIE_LABELS,
  ONDERGROND_LABELS,
  SOORT_DAK_LABELS,
  SOORT_WERK_LABELS,
  aanhefRegel,
  klantWeergave,
  labelBedekking,
  labelIsolatie,
} from './labels';

describe('labels §9.1', () => {
  it('dekt precies de waardesets uit de schema’s', () => {
    const paren: [readonly string[], Record<string, string>][] = [
      [s.soortWerkSchema.options, SOORT_WERK_LABELS],
      [s.soortDakSchema.options, SOORT_DAK_LABELS],
      [s.bedekkingSchema.options, BEDEKKING_LABELS],
      [s.huidigeBedekkingSchema.options, HUIDIGE_BEDEKKING_LABELS],
      [s.ondergrondSchema.options, ONDERGROND_LABELS],
      [s.isolatieSchema.options, ISOLATIE_LABELS],
      [s.afwerkingSchema.options, AFWERKING_LABELS],
      [s.hoogteSchema.options, HOOGTE_LABELS],
    ];
    for (const [waarden, labels] of paren) {
      expect(Object.keys(labels).sort()).toEqual([...waarden].sort());
      for (const label of Object.values(labels)) expect(label).not.toBe('');
    }
  });

  it('bevat de letterlijke labels', () => {
    expect(SOORT_WERK_LABELS.dak_vervangen).toBe('Dak vervangen');
    expect(SOORT_DAK_LABELS).toEqual({ plat: 'plat dak', hellend: 'hellend dak' });
    expect(BEDEKKING_LABELS.epdm_11).toBe('EPDM 1,1 mm');
    expect(HUIDIGE_BEDEKKING_LABELS.onbekend).toBe('Weet ik niet');
    expect(ONDERGROND_LABELS.staal).toBe('Staal');
    expect(ISOLATIE_LABELS['80']).toBe('80 mm (Rc 3,5)');
    expect(AFWERKING_LABELS.sedum).toBe('Sedum');
    expect(HOOGTE_LABELS['1']).toBe('Begane grond / 1 bouwlaag');
    expect(HOOGTE_LABELS['3plus']).toBe('3 of meer bouwlagen');
  });

  it('bedekking anders → de ingevulde tekst', () => {
    expect(labelBedekking('epdm_15', 'wordt genegeerd')).toBe('EPDM 1,5 mm');
    expect(labelBedekking('anders', ' Zink ')).toBe('Zink');
    expect(labelBedekking('anders', '')).toBe('');
  });

  it('isolatie anders → <n> mm', () => {
    expect(labelIsolatie('100', 140)).toBe('100 mm');
    expect(labelIsolatie('anders', 140)).toBe('140 mm');
    expect(labelIsolatie('anders', null)).toBe('');
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
