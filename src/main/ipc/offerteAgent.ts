import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-013 (maak, stop), OFM-017 (pasAanMetClaude, zetVersieTerug), OFM-025 (maakZonderClaude). Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen =
  | 'offerte:maak'
  | 'offerte:stop'
  | 'offerte:pasAanMetClaude'
  | 'offerte:zetVersieTerug'
  | 'offerte:maakZonderClaude';

export const offerteAgentHandlers: DomeinHandlers<Kanalen> = {
  'offerte:maak': nietBeschikbaar,
  'offerte:stop': nietBeschikbaar,
  'offerte:pasAanMetClaude': nietBeschikbaar,
  'offerte:zetVersieTerug': nietBeschikbaar,
  'offerte:maakZonderClaude': nietBeschikbaar,
};
