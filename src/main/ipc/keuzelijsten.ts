import { bewaarKeuzelijst, herstelKeuzelijst, lijstKeuzeopties } from '../db/repo/keuzeopties';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-034 (TDO §6.2). Instelbare keuzelijsten van de wizard; `bewaar` krijgt de hele lijst.
type Kanalen = 'keuzelijsten:haal' | 'keuzelijsten:bewaar' | 'keuzelijsten:herstel';

export const keuzelijstenHandlers: DomeinHandlers<Kanalen> = {
  'keuzelijsten:haal': () => lijstKeuzeopties(),
  'keuzelijsten:bewaar': ({ lijst, opties }) => bewaarKeuzelijst(lijst, opties),
  'keuzelijsten:herstel': ({ lijst }) => {
    herstelKeuzelijst(lijst);
    return null;
  },
};
