import type { Klant } from './types';

// Controles van stap 1 van de wizard (FE-024, V-16). Pure functies; de meldingsteksten staan in de
// tekstmodule van de wizard. Fouten blokkeren **Volgende**, waarschuwingen niet.

export const POSTCODE_PATROON = /^[1-9]\d{3}\s?[A-Za-z]{2}$/;
export const EMAIL_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface KlantControle {
  fouten: { naam?: 'leeg'; plaats?: 'leeg' };
  waarschuwingen: { postcode?: 'vorm'; email?: 'vorm'; werkadresPostcode?: 'vorm' };
}

function postcodeOk(postcode: string): boolean {
  const p = postcode.trim();
  return p === '' || POSTCODE_PATROON.test(p);
}

export function controleerKlant(klant: Klant): KlantControle {
  const fouten: KlantControle['fouten'] = {};
  const waarschuwingen: KlantControle['waarschuwingen'] = {};
  if (klant.naam.trim() === '') fouten.naam = 'leeg';
  if (klant.adres.plaats.trim() === '') fouten.plaats = 'leeg';
  if (!postcodeOk(klant.adres.postcode)) waarschuwingen.postcode = 'vorm';
  if (klant.heeftWerkadres && !postcodeOk(klant.werkadres.postcode))
    waarschuwingen.werkadresPostcode = 'vorm';
  const email = klant.email.trim();
  if (email !== '' && !EMAIL_PATROON.test(email)) waarschuwingen.email = 'vorm';
  return { fouten, waarschuwingen };
}

/** `true` als **Volgende** op stap 1 mag (alleen fouten blokkeren). */
export function klantCompleet(klant: Klant): boolean {
  return Object.keys(controleerKlant(klant).fouten).length === 0;
}
