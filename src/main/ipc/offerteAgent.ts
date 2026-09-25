import type { WebContents } from 'electron';
import { AppFout } from '@shared/fouten';
import { VOORTGANG_KANAAL } from '@shared/ipcKanalen';
import type { Voortgang } from '@shared/types';
import {
  isBezig,
  maakOfferte,
  MELDING_AL_BEZIG,
  pasAanMetClaude,
  stopTaak,
  type Stuur,
} from '../agent/taken';
import { zetVersieTerug } from '../db/repo/offertesInhoud';
import { maakZonderClaude } from '../offerte/maakZonderClaude';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-013 (maak, stop), OFM-017 (pasAanMetClaude, zetVersieTerug), OFM-025 (maakZonderClaude). Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen =
  | 'offerte:maak'
  | 'offerte:stop'
  | 'offerte:pasAanMetClaude'
  | 'offerte:zetVersieTerug'
  | 'offerte:maakZonderClaude';

/** Voortgang naar het venster dat de taak startte; een gesloten venster wordt overgeslagen. */
export function stuurNaar(sender: Pick<WebContents, 'isDestroyed' | 'send'>): Stuur {
  return (voortgang: Voortgang) => {
    if (!sender.isDestroyed()) sender.send(VOORTGANG_KANAAL, voortgang);
  };
}

export const offerteAgentHandlers: DomeinHandlers<Kanalen> = {
  'offerte:maak': ({ id }, event) => maakOfferte(id, { stuur: stuurNaar(event.sender) }),
  'offerte:stop': ({ id }) => {
    stopTaak(id);
    return null;
  },
  'offerte:pasAanMetClaude': ({ id, instructie }, event) =>
    pasAanMetClaude(id, instructie, { stuur: stuurNaar(event.sender) }),
  'offerte:zetVersieTerug': ({ id, versieId }) => {
    // Niet terugzetten terwijl de agent aan deze offerte werkt: het antwoord zou de versie overschrijven.
    if (isBezig(id)) throw new AppFout('VALIDATIE', MELDING_AL_BEZIG);
    return zetVersieTerug(id, versieId);
  },
  'offerte:maakZonderClaude': ({ id }) => maakZonderClaude(id),
};
