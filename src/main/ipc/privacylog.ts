import { haalPrivacylog, lijstPrivacylog } from '../db/repo/privacylog';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-021 (TDO §6.2, V-18). Opdracht- en antwoordtekst gaan alleen naar de renderer,
// nooit naar het technische log (NFE-019).
type Kanalen = 'privacylog:lijst' | 'privacylog:haal';

export const privacylogHandlers: DomeinHandlers<Kanalen> = {
  'privacylog:lijst': () => lijstPrivacylog(),
  'privacylog:haal': ({ id }) => haalPrivacylog(id),
};
