import { puntTekst } from '@shared/teksten/wizardPunten';
import type { WizardPunt, WizardStapNummer } from '@shared/wizardControle';

// Markeringen in de stappenbalk (OFM-042): per stap het aantal punten en dezelfde teksten als in de
// samenvatting bij **Maak de offerte** (OFM-035), voor de tooltip.

/** Markering van één stap: het aantal punten en de regels voor de tooltip. */
export interface StapMarkering {
  aantal: number;
  punten: readonly string[];
}

const STAPPEN: readonly WizardStapNummer[] = [1, 2, 3, 4];

/** Markeringen voor de vier wizardstappen (index 0 = stap 1). */
export function stapMarkeringen(punten: readonly WizardPunt[]): StapMarkering[] {
  return STAPPEN.map((stap) => {
    const teksten = punten.filter((p) => p.stap === stap).map(puntTekst);
    return { aantal: teksten.length, punten: teksten };
  });
}
