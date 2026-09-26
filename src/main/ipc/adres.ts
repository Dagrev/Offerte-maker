import { zoekAdres } from '../adres/pdok';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-031 (A-29). Straat en plaats bij postcode en huisnummer via PDOK; niet in het
// privacylog (dat is voor Claude), wel een regel zonder waarden in main.log.
type Kanalen = 'adres:zoek';

export const adresHandlers: DomeinHandlers<Kanalen> = {
  'adres:zoek': (invoer) => zoekAdres(invoer),
};
