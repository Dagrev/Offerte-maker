import { haalInstelling } from '../db/repo/instellingen';
import { bewaarInvoer, haalOfferte, maakOfferte } from '../db/repo/offertesInvoer';
import { testhaak, vandaag } from '../testhaken';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-010. Nieuwe offerte, ophalen en wizardinvoer bewaren (TDO §6.2, V-10, V-12).
type Kanalen = 'offerte:nieuw' | 'offerte:haal' | 'offerte:bewaarInvoer';

export const offerteInvoerHandlers: DomeinHandlers<Kanalen> = {
  'offerte:nieuw': ({ bronId, zelfdeKlant }) => ({
    id: maakOfferte({
      bronId,
      zelfdeKlant,
      vandaag: vandaag(),
      geldigheidDagen: haalInstelling('teksten').geldigheidDagen,
    }),
  }),

  'offerte:haal': ({ id }) => {
    // §3: testhaak voor het pad "onverwachte fout → ONBEKEND" (E2E).
    if (testhaak('ipc-fout')) throw new Error('testhaak ipc-fout');
    return haalOfferte(id);
  },

  'offerte:bewaarInvoer': (invoer) => {
    bewaarInvoer(invoer, haalInstelling('teksten').geldigheidDagen);
    return null;
  },
};
