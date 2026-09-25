import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-014. Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen = 'offerte:bewaarInhoud' | 'offerte:voorbeeldHtml';

export const offerteInhoudHandlers: DomeinHandlers<Kanalen> = {
  'offerte:bewaarInhoud': nietBeschikbaar,
  'offerte:voorbeeldHtml': nietBeschikbaar,
};
