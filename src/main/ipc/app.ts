import { app } from 'electron';
import { nietBeschikbaar } from '@shared/fouten';
import { paden } from '../paden';
import { vandaag } from '../testhaken';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-002/OFM-004. `welkomVoltooid` koppelt OFM-003 aan de instellingen (V-27);
// `app:openMap` bouwt OFM-021 (V-17).
type Kanalen = 'app:info' | 'app:openMap';

export const appHandlers: DomeinHandlers<Kanalen> = {
  'app:info': () => ({
    versie: app.getVersion(),
    welkomVoltooid: false,
    vandaag: vandaag(),
    dataMap: paden.dataMap,
    documentenMap: paden.documentenMap,
  }),
  'app:openMap': nietBeschikbaar,
};
