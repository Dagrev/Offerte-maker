import { zoekAdres } from '../adres/pdok';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-031/040 (A-29). Adres opzoeken via PDOK in twee richtingen; niet in het
// privacylog (dat is voor Claude), wel een regel zonder waarden in main.log.
type Kanalen = 'adres:zoek';

export const adresHandlers: DomeinHandlers<Kanalen> = {
  'adres:zoek': (invoer) => zoekAdres(invoer),
};
