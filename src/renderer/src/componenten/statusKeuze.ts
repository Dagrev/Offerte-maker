import type { Status } from '@shared/types';

// Welke status de gebruiker kan kiezen (FO UC-08, FE-060). Gedeeld door de statusknoppen op het
// detailscherm (OFM-016) en het contextmenu in het overzicht (OFM-052), zodat de regel op één plek
// staat. Main controleert hetzelfde (`zetStatus`: "Maak de offerte eerst definitief.").

/** Alle statussen in de volgorde van de knoppen en het menu. */
export const STATUSSEN: readonly Status[] = ['concept', 'klaar', 'verstuurd', 'akkoord', 'afgewezen'];

/** Concept is alleen een aanduiding (die zet de app zelf); de andere vier zodra de offerte definitief is. */
export function statusKiesbaar(status: Status, definitief: boolean): boolean {
  return definitief && status !== 'concept';
}
