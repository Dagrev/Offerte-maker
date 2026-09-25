import { prullenbakLijst, verwijderOfferte, zetOfferteTerug, zetStatus } from '../db/repo/offertesBeheer';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-016. Status, verwijderen, terugzetten en de prullenbak (TDO §6.2, FE-060, FE-062).
type Kanalen = 'offerte:zetStatus' | 'offerte:verwijder' | 'offerte:zetTerug' | 'prullenbak:lijst';

export const offerteBeheerHandlers: DomeinHandlers<Kanalen> = {
  'offerte:zetStatus': ({ id, status }) => {
    zetStatus(id, status);
    return null;
  },
  'offerte:verwijder': ({ id }) => {
    verwijderOfferte(id);
    return null;
  },
  'offerte:zetTerug': ({ id }) => {
    zetOfferteTerug(id);
    return null;
  },
  'prullenbak:lijst': () => prullenbakLijst(),
};
