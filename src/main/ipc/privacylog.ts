import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-021. Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen = 'privacylog:lijst' | 'privacylog:haal';

export const privacylogHandlers: DomeinHandlers<Kanalen> = {
  'privacylog:lijst': nietBeschikbaar,
  'privacylog:haal': nietBeschikbaar,
};
