import type { WizardPunt } from '../wizardControle';
import { KLANT_VELDNAMEN, VALIDATIE_FOUTEN } from './validatie';

// Teksten van de wizardpunten (OFM-035). Gedeeld: de renderer toont ze in de samenvatting bij
// **Maak de offerte**, main zet ze in de `VALIDATIE`-melding van `offerte:maak` en
// `offerte:maakZonderClaude`.

export const WIZARD_PUNT_TEKSTEN = {
  naam: 'Naam van de klant ontbreekt',
  soortWerk: 'Soort werk is niet gekozen',
  dakvlak: 'Geen dakvlak ingevuld',
} as const;

export function puntTekst(punt: WizardPunt): string {
  if (punt.soort === 'ongeldig') return `${KLANT_VELDNAMEN[punt.veld]}: ${VALIDATIE_FOUTEN[punt.fout]}`;
  return WIZARD_PUNT_TEKSTEN[punt.soort];
}

export const WIZARD_PUNTEN_KOP = 'De offerte kan nog niet worden gemaakt. Dit ontbreekt nog of klopt niet:';

/** `VALIDATIE`-melding van main: de kop en één regel per punt. */
export function wizardPuntenMelding(punten: readonly WizardPunt[]): string {
  return [WIZARD_PUNTEN_KOP, ...punten.map((p) => `- ${puntTekst(p)}`)].join('\n');
}
