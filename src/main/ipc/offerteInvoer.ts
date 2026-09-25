import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-010. Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen = 'offerte:nieuw' | 'offerte:haal' | 'offerte:bewaarInvoer';

export const offerteInvoerHandlers: DomeinHandlers<Kanalen> = {
  'offerte:nieuw': nietBeschikbaar,
  'offerte:haal': nietBeschikbaar,
  'offerte:bewaarInvoer': nietBeschikbaar,
};
