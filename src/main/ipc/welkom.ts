import { wijzigInstelling } from '../db/repo/instellingen';
import { log } from '../log';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-023 (TDO §6.2, §13.4, FE-004). Het beginscherm kiest App.tsx op `app:info.welkomVoltooid`.
type Kanalen = 'welkom:voltooi';

export const welkomHandlers: DomeinHandlers<Kanalen> = {
  /** **Klaar** of **Overslaan**: het welkomstscherm komt bij een volgende start niet meer terug. */
  'welkom:voltooi': () => {
    wijzigInstelling('app', { welkomVoltooid: true });
    log.info('welkomstscherm voltooid');
    return null;
  },
};
