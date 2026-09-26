import { describe, expect, it } from 'vitest';
import { KEUZE_STARTSET } from './keuzelijsten';
import { omschrijvingKort } from './omschrijvingKort';
import type { KlusInvoer } from './types';

type Deel = Pick<KlusInvoer, 'soortWerk' | 'bedekking' | 'bedekkingAnders' | 'dakvlakken'>;

const vlakken: KlusInvoer['dakvlakken'] = [
  { id: 'a', naam: 'Dakvlak 1', modus: 'lxb', lengteM: 5, breedteM: 4.5, m2: null },
  { id: 'b', naam: 'Dakvlak 2', modus: 'm2', lengteM: null, breedteM: null, m2: 12.3 },
];
const leegVlak: KlusInvoer['dakvlakken'] = [
  { id: 'a', naam: 'Dakvlak 1', modus: 'lxb', lengteM: null, breedteM: null, m2: null },
];

const invoer = (deel: Partial<Deel>): Deel => ({
  soortWerk: 'dak_vervangen',
  bedekking: 'epdm_11',
  bedekkingAnders: '',
  dakvlakken: vlakken,
  ...deel,
});

const kort = (deel: Deel) => omschrijvingKort(deel, KEUZE_STARTSET);

describe('omschrijvingKort', () => {
  it('gebruikt de labels uit de keuzelijsten (OFM-034)', () => {
    const keuzes = {
      soortWerk: [{ sleutel: 'dak_vervangen', label: 'Dak compleet vervangen' }],
      bedekking: [{ sleutel: 'leien', label: 'Leien' }],
    };
    expect(omschrijvingKort(invoer({ bedekking: 'leien' }), keuzes)).toBe(
      'Dak compleet vervangen · Leien · 34,8 m²',
    );
  });

  it('alle drie de delen', () => {
    expect(kort(invoer({}))).toBe('Dak vervangen · EPDM 1,1 mm · 34,8 m²');
  });

  it('laat ontbrekende delen weg', () => {
    expect(kort(invoer({ soortWerk: null }))).toBe('EPDM 1,1 mm · 34,8 m²');
    expect(kort(invoer({ bedekking: null }))).toBe('Dak vervangen · 34,8 m²');
    expect(kort(invoer({ dakvlakken: leegVlak }))).toBe('Dak vervangen · EPDM 1,1 mm');
    expect(kort(invoer({ soortWerk: null, bedekking: null, dakvlakken: leegVlak }))).toBe('');
  });

  it('bedekking anders: de ingevulde tekst, of weglaten als die leeg is', () => {
    expect(kort(invoer({ bedekking: 'anders', bedekkingAnders: 'Zink' }))).toBe(
      'Dak vervangen · Zink · 34,8 m²',
    );
    expect(kort(invoer({ bedekking: 'anders', bedekkingAnders: ' ' }))).toBe('Dak vervangen · 34,8 m²');
  });
});
