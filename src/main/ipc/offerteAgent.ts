import type { WebContents } from 'electron';
import { nietBeschikbaar } from '@shared/fouten';
import { VOORTGANG_KANAAL } from '@shared/ipcKanalen';
import type { Voortgang } from '@shared/types';
import { maakOfferte, stopTaak, type Stuur } from '../agent/taken';
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
  'offerte:pasAanMetClaude': nietBeschikbaar,
  'offerte:zetVersieTerug': nietBeschikbaar,
  'offerte:maakZonderClaude': nietBeschikbaar,
};
