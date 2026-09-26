import {
  controleerHuisnummer,
  controleerPostcode,
  controleerStraatHuisnummer,
  ontleedHuisnummer,
  splitsStraatHuisnummer,
  type ValidatieFout,
} from '@shared/validatie';

// Pure hulp bij `AdresVelden` (OFM-031, OFM-040), zonder DOM te testen (test/renderer/adresDelen.test.ts).
// Het datamodel houdt één veld "straat en huisnummer" (§5); het scherm toont straat en huisnummer
// los, zodat postcode + huisnummer vooraan kunnen staan en straat en plaats vanzelf komen.

export interface StraatEnNummer {
  straat: string;
  huisnummer: string;
}

/** Eén opgeslagen veld → straat en huisnummer. Zonder herkenbaar huisnummer staat alles in straat. */
export function splitsAdres(straatHuisnummer: string): StraatEnNummer {
  const tekst = straatHuisnummer.trim().replace(/\s+/g, ' ');
  const s = splitsStraatHuisnummer(tekst);
  if (!s) return { straat: straatHuisnummer, huisnummer: '' };
  return { straat: s.straat, huisnummer: tekst.slice(s.straat.length + 1) };
}

/** Straat en huisnummer → het opgeslagen veld (`Dorpsstraat 12A`); lege delen vallen weg. */
export function voegSamen({ straat, huisnummer }: StraatEnNummer): string {
  return [straat.trim(), huisnummer.trim()].filter((d) => d !== '').join(' ');
}

/** Wat er mis is per los veld. `straatLeeg`/`huisnummerLeeg`: het andere deel is wel ingevuld. */
export interface AdresFouten {
  postcode?: ValidatieFout;
  straat?: 'straatLeeg';
  huisnummer?: ValidatieFout | 'huisnummerLeeg';
}

/**
 * Fouten per los veld, gelijk aan wat `controleerStraatHuisnummer` op het samengevoegde veld vindt:
 * elk adres dat hier foutloos is, keurt main ook goed (en andersom).
 */
export function adresFouten(postcode: string, delen: StraatEnNummer): AdresFouten {
  const fouten: AdresFouten = {};
  if (!controleerPostcode(postcode).geldig) fouten.postcode = 'postcode';
  if (controleerStraatHuisnummer(voegSamen(delen)).geldig) return fouten;
  const h = controleerHuisnummer(delen.huisnummer);
  if (!h.geldig) fouten.huisnummer = h.fout;
  else if (h.waarde === '') fouten.huisnummer = 'huisnummerLeeg';
  else fouten.straat = 'straatLeeg';
  return fouten;
}

/** Sleutel om op te zoeken (`5611 AB|12A`), of `null` als postcode en huisnummer nog niet geldig zijn. */
export function zoekSleutel(postcode: string, huisnummer: string): string | null {
  const p = controleerPostcode(postcode);
  const h = ontleedHuisnummer(huisnummer);
  if (!p.geldig || p.waarde === '' || !h) return null;
  return `${p.waarde}|${h.nummer}${h.toevoeging}`;
}

/** Vergelijkbare vorm van straat of plaats: kleine letters, witruimte samengevoegd (OFM-040). */
export function vergelijkVorm(tekst: string): string {
  return tekst.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Sleutel om andersom op te zoeken (OFM-040): alleen als de postcode leeg is en straat, een geldig
 * huisnummer en plaats zijn ingevuld; anders `null`.
 */
export function terugZoekSleutel(postcode: string, delen: StraatEnNummer, plaats: string): string | null {
  const h = ontleedHuisnummer(delen.huisnummer);
  if (postcode.trim() !== '' || !h) return null;
  if (!/\p{L}/u.test(delen.straat) || !/\p{L}/u.test(plaats)) return null;
  return `${vergelijkVorm(delen.straat)}|${h.nummer}${h.toevoeging}|${vergelijkVorm(plaats)}`;
}

/** De laatste treffer bij PDOK: bij welke postcode + huisnummer (`zoekSleutel`) welk adres hoort. */
export interface Treffer {
  sleutel: string;
  straat: string;
  plaats: string;
}

/**
 * OFM-040: wijkt het ingevulde adres af van de laatste treffer bij dezelfde postcode + huisnummer?
 * Hoofdletterongevoelig en zonder dubbele spaties; lege straat of plaats is geen afwijking.
 */
export function wijktAf(
  treffer: Treffer | null,
  sleutel: string | null,
  straat: string,
  plaats: string,
): boolean {
  if (!treffer || sleutel !== treffer.sleutel) return false;
  if (straat.trim() === '' || plaats.trim() === '') return false;
  return (
    vergelijkVorm(straat) !== vergelijkVorm(treffer.straat) ||
    vergelijkVorm(plaats) !== vergelijkVorm(treffer.plaats)
  );
}
