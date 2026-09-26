import { lijstOverzicht, zoekOffertes } from '../db/repo/offertesLezen';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-009 (TDO §6.2, §8.2). De invoer is al gevalideerd door registreer.ts.
type Kanalen = 'overzicht:lijst' | 'overzicht:zoek';

export const overzichtHandlers: DomeinHandlers<Kanalen> = {
  'overzicht:lijst': ({ weergave, datum, statussen, ordening }) =>
    lijstOverzicht(weergave, datum, { statussen, ordening }),
  'overzicht:zoek': ({ tekst, statussen, ordening }) => zoekOffertes(tekst, { statussen, ordening }),
};
