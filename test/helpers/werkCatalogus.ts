import type { GekozenWerkzaamheid, WerkzaamhedenSet } from '../../src/shared/types';

// Kleine catalogus van werkzaamheden en materialen voor unit-tests (OFM-044), zonder database.

export const CATALOGUS: WerkzaamhedenSet = {
  soortenWerk: [
    {
      sleutel: 'dak_vervangen',
      label: 'Dak vervangen',
      verborgen: false,
      werkzaamheden: ['w-slopen', 'w-iso'],
    },
  ],
  werkzaamheden: [
    {
      id: 'w-slopen',
      sleutel: 'slopen',
      label: 'Slopen',
      eenheid: 'm²',
      prijsCent: 1200,
      uurprijsCent: 4500,
      btwTarief: 21,
      verborgen: false,
      standaard: true,
      inGebruik: false,
      soortenWerk: ['dak_vervangen'],
      opties: [
        {
          id: 'o-afval',
          sleutel: 'afvalcontainer',
          label: 'Afvalcontainer',
          eenheid: 'stuk',
          prijsCent: 35000,
          verborgen: false,
          inGebruik: false,
        },
      ],
      materialen: [],
    },
    {
      id: 'w-iso',
      sleutel: 'isoleren',
      label: 'Isoleren',
      eenheid: 'm²',
      prijsCent: null,
      uurprijsCent: null,
      btwTarief: 21,
      verborgen: false,
      standaard: true,
      inGebruik: false,
      soortenWerk: ['dak_vervangen'],
      opties: [],
      materialen: [
        { materiaalId: 'm-pir60', standaard: false },
        { materiaalId: 'm-pir80', standaard: true },
      ],
    },
  ],
  materialen: [
    {
      id: 'm-pir60',
      sleutel: 'pir_60',
      label: 'PIR 60 mm',
      eenheid: 'm²',
      prijsCent: 1500,
      btwTarief: 21,
      verborgen: false,
      standaard: true,
      inGebruik: false,
    },
    {
      id: 'm-pir80',
      sleutel: 'pir_80',
      label: 'PIR 80 mm',
      eenheid: 'm²',
      prijsCent: 1800,
      btwTarief: 21,
      verborgen: false,
      standaard: true,
      inGebruik: false,
    },
    {
      id: 'm-trim',
      sleutel: 'daktrim',
      label: 'Daktrim',
      eenheid: 'm¹',
      prijsCent: null,
      btwTarief: 21,
      verborgen: false,
      standaard: false,
      inGebruik: false,
    },
  ],
};

/** Een gekozen werkzaamheid met standaardwaarden. */
export function gekozen(deel: Partial<GekozenWerkzaamheid> = {}): GekozenWerkzaamheid {
  return {
    id: 'g1',
    sleutel: 'slopen',
    eenmalig: null,
    aantal: 20,
    prijsCent: 1200,
    perUur: false,
    notitie: '',
    materialen: [],
    opties: [],
    ...deel,
  };
}
