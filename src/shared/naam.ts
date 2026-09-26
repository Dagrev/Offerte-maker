import type { Klant } from './types';

// Klantnaam in al zijn vormen (OFM-046, TDO §8.2/§9.2). Eén pure functie `naamVan` bepaalt hoe voornaam,
// tussenvoegsel en achternaam samen worden weergegeven; aanhefregel, klantWeergave, PDF-adresblok,
// zoektekst, PII-set en de e-mailplaatshouder `{achternaam}` gaan er allemaal doorheen.

export type Naamdelen = Pick<Klant, 'voornaam' | 'tussenvoegsel' | 'achternaam'>;

/**
 * - `volledig`: "Jan van der Berg" (lege delen vallen weg).
 * - `voorletters`: "J. van der Berg"; zonder achternaam de voornaam voluit.
 * - `achternaam`: "van der Berg" (midden in een zin, tussenvoegsel klein).
 * - `achternaamVooraan`: "Van der Berg" (eerste woord: aanhef, "Fam.", `{achternaam}` in de e-mail).
 */
export type Naamvorm = 'volledig' | 'voorletters' | 'achternaam' | 'achternaamVooraan';

/** Tussenvoegsel zoals het bewaard wordt: getrimd, enkele spaties, kleine letters ("Van  der" → "van der"). */
export function normaliseerTussenvoegsel(tussenvoegsel: string): string {
  return tussenvoegsel.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Voorletters van de voornaam: `Jan` → `J.`, `Jan-Willem Piet` → `J.W.P.` (OFM-038). */
export function voorletters(voornaam: string): string {
  return voornaam
    .split(/[\s-]+/)
    .filter((d) => d !== '')
    .map((d) => `${d.charAt(0).toUpperCase()}.`)
    .join('');
}

/** Eerste letter als hoofdletter ("van der" → "Van der"); "'t" en "'s" blijven klein. */
function vooraan(tussenvoegsel: string): string {
  if (tussenvoegsel.startsWith("'")) return tussenvoegsel;
  return tussenvoegsel.charAt(0).toUpperCase() + tussenvoegsel.slice(1);
}

const samen = (delen: string[]): string => delen.filter((d) => d !== '').join(' ');

/**
 * De naam in de gevraagde vorm. Een tussenvoegsel zonder achternaam telt niet mee. Zonder tussenvoegsel
 * is de uitkomst precies die van vóór OFM-046 (bestaande offertes blijven identiek).
 */
export function naamVan(klant: Naamdelen, vorm: Naamvorm): string {
  const voornaam = klant.voornaam.trim();
  const achternaam = klant.achternaam.trim();
  const tussenvoegsel = achternaam === '' ? '' : normaliseerTussenvoegsel(klant.tussenvoegsel);
  switch (vorm) {
    case 'volledig':
      return samen([voornaam, tussenvoegsel, achternaam]);
    case 'voorletters':
      return achternaam === '' ? voornaam : samen([voorletters(voornaam), tussenvoegsel, achternaam]);
    case 'achternaam':
      return samen([tussenvoegsel, achternaam]);
    case 'achternaamVooraan':
      return samen([vooraan(tussenvoegsel), achternaam]);
  }
}
