import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-009. Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen = 'overzicht:lijst' | 'overzicht:zoek';

export const overzichtHandlers: DomeinHandlers<Kanalen> = {
  'overzicht:lijst': nietBeschikbaar,
  'overzicht:zoek': nietBeschikbaar,
};
