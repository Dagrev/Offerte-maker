import type { WizardVeld } from '../verplicht';
import type { WizardPunt } from '../wizardControle';
import { KLANT_VELDNAMEN, VALIDATIE_FOUTEN } from './validatie';

// Teksten van de wizardpunten (OFM-035, OFM-038). Gedeeld: de renderer toont ze in de samenvatting bij
// **Maak de offerte** en in de tab Verplichte velden, main zet ze in de `VALIDATIE`-melding van
// `offerte:maak` en `offerte:maakZonderClaude`.

/** Naam van elk wizardveld, zoals in de tab Instellingen › Verplichte velden. */
export const WIZARD_VELDNAMEN: Record<WizardVeld, string> = {
  aanhef: 'Aanhef',
  voornaam: 'Voornaam',
  achternaam: 'Achternaam',
  bedrijfsnaam: 'Bedrijfsnaam (bij Bedrijf)',
  postcode: 'Postcode',
  huisnummer: 'Huisnummer',
  straat: 'Straat',
  plaats: 'Plaats',
  telefoon: 'Telefoon',
  email: 'E-mail',
  werkPostcode: 'Postcode van het werkadres',
  werkHuisnummer: 'Huisnummer van het werkadres',
  werkStraat: 'Straat van het werkadres',
  werkPlaats: 'Plaats van het werkadres',
  soortWerk: 'Soort werk',
  soortDak: 'Soort dak',
  dakvlak: 'Een dakvlak groter dan 0 m²',
  hoogte: 'Hoogte',
  werkzaamheid: 'Minstens één werkzaamheid',
};

/** Eén punt per ontbrekend verplicht veld. */
export const WIZARD_PUNT_TEKSTEN: Record<WizardVeld, string> = {
  aanhef: 'Aanhef is niet gekozen',
  voornaam: 'Voornaam ontbreekt',
  achternaam: 'Achternaam ontbreekt',
  bedrijfsnaam: 'Bedrijfsnaam ontbreekt',
  postcode: 'Postcode ontbreekt',
  huisnummer: 'Huisnummer ontbreekt',
  straat: 'Straat ontbreekt',
  plaats: 'Plaats ontbreekt',
  telefoon: 'Telefoon ontbreekt',
  email: 'E-mail ontbreekt',
  werkPostcode: 'Postcode van het werkadres ontbreekt',
  werkHuisnummer: 'Huisnummer van het werkadres ontbreekt',
  werkStraat: 'Straat van het werkadres ontbreekt',
  werkPlaats: 'Plaats van het werkadres ontbreekt',
  soortWerk: 'Soort werk is niet gekozen',
  soortDak: 'Soort dak is niet gekozen',
  dakvlak: 'Geen dakvlak ingevuld',
  hoogte: 'Hoogte is niet gekozen',
  werkzaamheid: 'Geen werkzaamheid gekozen',
};

/** OFM-044: een gekozen werkzaamheid zonder aantal. */
export const aantalNulTekst = (label: string) => `Vul het aantal in bij ${label || 'een werkzaamheid'}`;

export function puntTekst(punt: WizardPunt): string {
  if (punt.soort === 'ongeldig') return `${KLANT_VELDNAMEN[punt.veld]}: ${VALIDATIE_FOUTEN[punt.fout]}`;
  if (punt.soort === 'aantalNul') return aantalNulTekst(punt.label);
  return WIZARD_PUNT_TEKSTEN[punt.veld];
}

export const WIZARD_PUNTEN_KOP = 'De offerte kan nog niet worden gemaakt. Dit ontbreekt nog of klopt niet:';

/** `VALIDATIE`-melding van main: de kop en één regel per punt. */
export function wizardPuntenMelding(punten: readonly WizardPunt[]): string {
  return [WIZARD_PUNTEN_KOP, ...punten.map((p) => `- ${puntTekst(p)}`)].join('\n');
}
