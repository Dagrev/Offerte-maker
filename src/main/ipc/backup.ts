import { lijstBackups, maakBackup } from '../backup/backup';
import { zetTerug } from '../backup/herstel';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-022. Back-ups (TDO §6.2, §14.2, V-19). `backup:zetTerug` herstart de app bij succes,
// dus de renderer krijgt dan geen antwoord meer.
type Kanalen = 'backup:lijst' | 'backup:maak' | 'backup:zetTerug';

export const backupHandlers: DomeinHandlers<Kanalen> = {
  'backup:lijst': () => lijstBackups(),
  'backup:maak': async () => ({ bestand: await maakBackup('handmatig') }),
  'backup:zetTerug': async ({ bestand }) => {
    await zetTerug(bestand);
    return null;
  },
};
