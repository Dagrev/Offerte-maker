import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-015. Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen = 'offerte:maakDefinitief' | 'offerte:openPdf' | 'offerte:afdrukken' | 'offerte:toonInMap';

export const offerteDefinitiefHandlers: DomeinHandlers<Kanalen> = {
  'offerte:maakDefinitief': nietBeschikbaar,
  'offerte:openPdf': nietBeschikbaar,
  'offerte:afdrukken': nietBeschikbaar,
  'offerte:toonInMap': nietBeschikbaar,
};
