import { app, shell } from 'electron';
import { AppFout } from '@shared/fouten';
import { log } from '../log';
import { haalInstelling } from '../db/repo/instellingen';
import { paden } from '../paden';
import { vandaag } from '../testhaken';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-002/OFM-004. `welkomVoltooid` koppelt OFM-003 aan de instellingen (V-27);
// `app:openMap` bouwt OFM-021 (V-17).
type Kanalen = 'app:info' | 'app:openMap';

export const appHandlers: DomeinHandlers<Kanalen> = {
  'app:info': () => ({
    versie: app.getVersion(),
    welkomVoltooid: haalInstelling('app').welkomVoltooid,
    vandaag: vandaag(),
    dataMap: paden.dataMap,
    documentenMap: paden.documentenMap,
  }),
  // V-17 (OFM-021): alleen 'log' of 'offertes'; het pad komt uit paden.ts, nooit uit de renderer.
  'app:openMap': async ({ welke }) => {
    const map = welke === 'log' ? paden.logMap : paden.documentenMap;
    const fout = await shell.openPath(map);
    if (fout) {
      log.warn(`app:openMap ${welke} mislukt: ${fout}`);
      throw new AppFout('ONBEKEND');
    }
    return null;
  },
};
