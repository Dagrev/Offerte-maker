import { nietBeschikbaar } from '@shared/fouten';
import { bepaalClaudeStatus } from '../agent/claudeStatus';
import { loginClaude, testClaude } from '../agent/koppeling';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-012 (bewaarApiSleutel en kiesPad: OFM-020). Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen =
  'claude:status' | 'claude:login' | 'claude:test' | 'claude:bewaarApiSleutel' | 'claude:kiesPad';

export const claudeHandlers: DomeinHandlers<Kanalen> = {
  'claude:status': () => bepaalClaudeStatus(),
  'claude:login': () => loginClaude(),
  'claude:test': () => testClaude(),
  'claude:bewaarApiSleutel': nietBeschikbaar,
  'claude:kiesPad': nietBeschikbaar,
};
