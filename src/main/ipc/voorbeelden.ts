import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-019 (tekstenUitTemplate: OFM-024). Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen =
  | 'voorbeelden:lijst'
  | 'voorbeelden:voegToe'
  | 'voorbeelden:haal'
  | 'voorbeelden:maakOnleesbaar'
  | 'voorbeelden:keurGoed'
  | 'voorbeelden:zetTemplate'
  | 'voorbeelden:verwijder'
  | 'voorbeelden:tekstenUitTemplate';

export const voorbeeldenHandlers: DomeinHandlers<Kanalen> = {
  'voorbeelden:lijst': nietBeschikbaar,
  'voorbeelden:voegToe': nietBeschikbaar,
  'voorbeelden:haal': nietBeschikbaar,
  'voorbeelden:maakOnleesbaar': nietBeschikbaar,
  'voorbeelden:keurGoed': nietBeschikbaar,
  'voorbeelden:zetTemplate': nietBeschikbaar,
  'voorbeelden:verwijder': nietBeschikbaar,
  'voorbeelden:tekstenUitTemplate': nietBeschikbaar,
};
