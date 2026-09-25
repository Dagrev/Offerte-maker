import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-012 (bewaarApiSleutel en kiesPad: OFM-020). Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen =
  'claude:status' | 'claude:login' | 'claude:test' | 'claude:bewaarApiSleutel' | 'claude:kiesPad';

export const claudeHandlers: DomeinHandlers<Kanalen> = {
  'claude:status': nietBeschikbaar,
  'claude:login': nietBeschikbaar,
  'claude:test': nietBeschikbaar,
  'claude:bewaarApiSleutel': nietBeschikbaar,
  'claude:kiesPad': nietBeschikbaar,
};
