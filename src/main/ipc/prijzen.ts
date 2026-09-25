import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-018. Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen = 'prijzen:lijst' | 'prijzen:bewaar' | 'prijzen:verwijder';

export const prijzenHandlers: DomeinHandlers<Kanalen> = {
  'prijzen:lijst': nietBeschikbaar,
  'prijzen:bewaar': nietBeschikbaar,
  'prijzen:verwijder': nietBeschikbaar,
};
