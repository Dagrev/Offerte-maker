import { AppFout } from '@shared/fouten';
import { wizardPuntenMelding } from '@shared/teksten/wizardPunten';
import { wizardPunten } from '@shared/wizardControle';
import { werkInfo } from '@shared/werkzaamheden';
import { vraagtNieuweBedekking } from '@shared/keuzelijsten';
import { haalInstelling } from '../db/repo/instellingen';
import { haalKeuzes } from '../db/repo/keuzeopties';
import { haalOfferteVoorAgent } from '../db/repo/offertesInhoud';
import { haalWerkzaamheden } from '../db/repo/werkzaamheden';

// OFM-035: vóór `offerte:maak` en `offerte:maakZonderClaude` dezelfde controle als de samenvatting in
// de wizard, zodat die niet alleen in de renderer zit. Gooit `VALIDATIE` met de punten in de melding.
// OFM-038: met de instelling `verplicht` (Instellingen › Verplichte velden). OFM-044: een werkzaamheid
// met aantal 0 heet in de melding zoals in de instellingen.

export function controleerVolledig(id: string): void {
  const offerte = haalOfferteVoorAgent(id);
  const catalogus = haalWerkzaamheden();
  const keuzes = haalKeuzes();
  const punten = wizardPunten(
    offerte.klant,
    offerte.invoer,
    haalInstelling('verplicht'),
    (w) => werkInfo(catalogus, w).label,
    // OFM-050: de nieuwe dakbedekking telt alleen bij een soort werk die erom vraagt.
    (soortWerk) => vraagtNieuweBedekking(keuzes, soortWerk),
  );
  if (punten.length > 0) throw new AppFout('VALIDATIE', wizardPuntenMelding(punten));
}
