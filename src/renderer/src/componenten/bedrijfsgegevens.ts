import type { Bedrijf } from '@shared/types';

// Welke bedrijfsgegevens nog leeg zijn (OFM-029). Puur, zodat het zonder DOM te testen is
// (test/renderer/bedrijfsgegevens.test.ts). Het welkomstscherm blokkeert niet meer op een lege
// bedrijfsnaam (V-20), maar meldt bij het verlaten van stap 1 wat er later nog kan.

export type OntbrekendGegeven = 'naam' | 'adres' | 'kvk' | 'btwNummer' | 'iban';

type BedrijfVelden = Pick<Bedrijf, 'naam' | 'adres' | 'postcode' | 'plaats' | 'kvk' | 'btwNummer' | 'iban'>;

const leeg = (waarde: string) => waarde.trim() === '';

/** Ontbrekende gegevens in vaste volgorde; het adres ontbreekt als straat, postcode of plaats leeg is. */
export function ontbrekendeBedrijfsgegevens(bedrijf: BedrijfVelden): OntbrekendGegeven[] {
  const uit: OntbrekendGegeven[] = [];
  if (leeg(bedrijf.naam)) uit.push('naam');
  if (leeg(bedrijf.adres) || leeg(bedrijf.postcode) || leeg(bedrijf.plaats)) uit.push('adres');
  if (leeg(bedrijf.kvk)) uit.push('kvk');
  if (leeg(bedrijf.btwNummer)) uit.push('btwNummer');
  if (leeg(bedrijf.iban)) uit.push('iban');
  return uit;
}
