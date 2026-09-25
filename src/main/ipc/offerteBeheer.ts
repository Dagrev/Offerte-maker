import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-016. Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen = 'offerte:zetStatus' | 'offerte:verwijder' | 'offerte:zetTerug' | 'prullenbak:lijst';

export const offerteBeheerHandlers: DomeinHandlers<Kanalen> = {
  'offerte:zetStatus': nietBeschikbaar,
  'offerte:verwijder': nietBeschikbaar,
  'offerte:zetTerug': nietBeschikbaar,
  'prullenbak:lijst': nietBeschikbaar,
};
