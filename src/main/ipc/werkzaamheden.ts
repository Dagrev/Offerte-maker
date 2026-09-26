import { bewaarWerkzaamheden, haalWerkzaamheden, herstelWerkzaamheden } from '../db/repo/werkzaamheden';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-043 (TDO §6.2). Werkzaamheden, opties en materialen; `bewaar` krijgt de hele set.
type Kanalen = 'werkzaamheden:haal' | 'werkzaamheden:bewaar' | 'werkzaamheden:herstel';

export const werkzaamhedenHandlers: DomeinHandlers<Kanalen> = {
  'werkzaamheden:haal': () => haalWerkzaamheden(),
  'werkzaamheden:bewaar': (invoer) => bewaarWerkzaamheden(invoer),
  'werkzaamheden:herstel': () => {
    herstelWerkzaamheden();
    return null;
  },
};
