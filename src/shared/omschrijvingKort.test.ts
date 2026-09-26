import { describe, expect, it } from 'vitest';
import { KEUZE_STARTSET } from './keuzelijsten';
import { omschrijvingKort } from './omschrijvingKort';
import type { KlusInvoer } from './types';

type Deel = Pick<KlusInvoer, 'soortWerk' | 'dakvlakken'>;

const vlakken: KlusInvoer['dakvlakken'] = [
  { id: 'a', naam: 'Dakvlak 1', modus: 'lxb', lengteM: 5, breedteM: 4.5, m2: null },
  { id: 'b', naam: 'Dakvlak 2', modus: 'm2', lengteM: null, breedteM: null, m2: 12.3 },
];
const leegVlak: KlusInvoer['dakvlakken'] = [
  { id: 'a', naam: 'Dakvlak 1', modus: 'lxb', lengteM: null, breedteM: null, m2: null },
];

const invoer = (deel: Partial<Deel>): Deel => ({ soortWerk: 'dak_vervangen', dakvlakken: vlakken, ...deel });

const kort = (deel: Deel) => omschrijvingKort(deel, KEUZE_STARTSET);

describe('omschrijvingKort', () => {
  it('gebruikt de labels uit de keuzelijsten (OFM-034)', () => {
    const keuzes = { soortWerk: [{ sleutel: 'dak_vervangen', label: 'Dak compleet vervangen' }] };
    expect(omschrijvingKort(invoer({}), keuzes)).toBe('Dak compleet vervangen · 34,8 m²');
  });

  it('soort werk en m² (sinds OFM-044/045 zonder bedekking)', () => {
    expect(kort(invoer({}))).toBe('Dak vervangen · 34,8 m²');
  });

  it('laat ontbrekende delen weg', () => {
    expect(kort(invoer({ soortWerk: null }))).toBe('34,8 m²');
    expect(kort(invoer({ dakvlakken: leegVlak }))).toBe('Dak vervangen');
    expect(kort(invoer({ soortWerk: null, dakvlakken: leegVlak }))).toBe('');
  });
});
