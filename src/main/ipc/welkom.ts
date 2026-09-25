import { nietBeschikbaar } from '@shared/fouten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-023. Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen = 'welkom:voltooi';

export const welkomHandlers: DomeinHandlers<Kanalen> = {
  'welkom:voltooi': nietBeschikbaar,
};
