import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-022. Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen = 'backup:lijst' | 'backup:maak' | 'backup:zetTerug';

export const backupHandlers: DomeinHandlers<Kanalen> = {
  'backup:lijst': nietBeschikbaar,
  'backup:maak': nietBeschikbaar,
  'backup:zetTerug': nietBeschikbaar,
};
