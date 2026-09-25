import { ACCENTKLEUREN } from '../schemas';

// Accentkleuren voor de offerte (TDO §4.3, FE-071): zes vaste kleuren plus een eigen #RRGGBB.
// De lijst zelf staat in `schemas.ts` (OFM-004); hier alleen de namen en een veilige omzetting.

export type Accentkleur = (typeof ACCENTKLEUREN)[number];

export const STANDAARD_ACCENTKLEUR: Accentkleur = '#1F4E79';

/** De zes vaste kleuren met hun naam, in de volgorde van §4.3 (voor de keuzetegels in de tab Opmaak). */
export const VASTE_ACCENTKLEUREN: readonly { kleur: Accentkleur; naam: string }[] = [
  { kleur: '#1F4E79', naam: 'Donkerblauw' },
  { kleur: '#2E7D32', naam: 'Groen' },
  { kleur: '#B71C1C', naam: 'Rood' },
  { kleur: '#E65100', naam: 'Oranje' },
  { kleur: '#37474F', naam: 'Antraciet' },
  { kleur: '#6A1B9A', naam: 'Paars' },
];

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * De accentkleur zoals hij in de CSS komt: een geldige `#RRGGBB` (hoofdletters), anders de standaardkleur.
 * De waarde is al door het schema gevalideerd; dit voorkomt dat iets anders ooit in de CSS belandt.
 */
export function veiligeAccentkleur(kleur: string): string {
  return HEX.test(kleur) ? kleur.toUpperCase() : STANDAARD_ACCENTKLEUR;
}
