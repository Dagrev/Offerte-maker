import { AppFout } from '@shared/fouten';
import { wizardPuntenMelding } from '@shared/teksten/wizardPunten';
import { wizardPunten } from '@shared/wizardControle';
import { haalInstelling } from '../db/repo/instellingen';
import { haalOfferteVoorAgent } from '../db/repo/offertesInhoud';

// OFM-035: vóór `offerte:maak` en `offerte:maakZonderClaude` dezelfde controle als de samenvatting in
// de wizard, zodat die niet alleen in de renderer zit. Gooit `VALIDATIE` met de punten in de melding.
// OFM-038: met de instelling `verplicht` (Instellingen › Verplichte velden).

export function controleerVolledig(id: string): void {
  const offerte = haalOfferteVoorAgent(id);
  const punten = wizardPunten(offerte.klant, offerte.invoer, haalInstelling('verplicht'));
  if (punten.length > 0) throw new AppFout('VALIDATIE', wizardPuntenMelding(punten));
}
