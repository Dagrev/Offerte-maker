import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-018. Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen =
  | 'instellingen:haal'
  | 'instellingen:bewaar'
  | 'instellingen:kiesLogo'
  | 'instellingen:verwijderLogo'
  | 'instellingen:opmaakVoorbeeld';

export const instellingenHandlers: DomeinHandlers<Kanalen> = {
  'instellingen:haal': nietBeschikbaar,
  'instellingen:bewaar': nietBeschikbaar,
  'instellingen:kiesLogo': nietBeschikbaar,
  'instellingen:verwijderLogo': nietBeschikbaar,
  'instellingen:opmaakVoorbeeld': nietBeschikbaar,
};
