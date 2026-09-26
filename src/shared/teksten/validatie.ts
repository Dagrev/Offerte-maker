import type { BedrijfVeld, KlantVeld, ValidatieFout, VeldFout } from '../validatie';

// Meldingen bij `src/shared/validatie.ts` (OFM-030). Gedeeld: de renderer toont ze onder het veld,
// main zet ze met de veldnaam in de `VALIDATIE`-melding (§15.1).

/** Wat er mis is, met een voorbeeld; onder het veld in het rood. */
export const VALIDATIE_FOUTEN: Record<ValidatieFout, string> = {
  postcode: 'Een postcode bestaat uit 4 cijfers en 2 letters, bijvoorbeeld 1234 AB',
  huisnummer: 'Een huisnummer bestaat uit cijfers, eventueel met een toevoeging, bijvoorbeeld 12 of 12A',
  straatHuisnummer: 'Zet het huisnummer achter de straat, bijvoorbeeld Dorpsstraat 12',
  email: 'Een e-mailadres ziet eruit als naam@voorbeeld.nl, zonder spaties',
  telefoon:
    'Een telefoonnummer heeft 10 cijfers, bijvoorbeeld 06 12345678, of begint met + en de landcode, bijvoorbeeld +32 470 12 34 56',
};

export const KLANT_VELDNAMEN: Record<KlantVeld, string> = {
  'adres.straatHuisnummer': 'Straat en huisnummer van de klant',
  'adres.postcode': 'Postcode van de klant',
  'werkadres.straatHuisnummer': 'Straat en huisnummer van het werkadres',
  'werkadres.postcode': 'Postcode van het werkadres',
  telefoon: 'Telefoon van de klant',
  email: 'E-mail van de klant',
};

export const BEDRIJF_VELDNAMEN: Record<BedrijfVeld, string> = {
  adres: 'Adres van het bedrijf',
  postcode: 'Postcode van het bedrijf',
  telefoon: 'Telefoon van het bedrijf',
  email: 'E-mail van het bedrijf',
};

/** `VALIDATIE`-melding van main: "Postcode van de klant: Een postcode bestaat uit …". Eén regel per fout. */
export function validatieMelding<V extends string>(
  fouten: VeldFout<V>[],
  veldnamen: Record<V, string>,
): string {
  return fouten.map((f) => `${veldnamen[f.veld]}: ${VALIDATIE_FOUTEN[f.fout]}.`).join('\n');
}
