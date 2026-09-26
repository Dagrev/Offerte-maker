// Pure delen van de nummering (TDO §8.1, FE-055). `volgendNummer(db, jaar)` hoort bij de repo-kant
// in main (OFM-015): `src/shared` mag de database niet importeren.

/**
 * `formatNummer('2026-09-26', 1)` → `2026-09-26-001` (OFM-033): de datum waarop de offerte voor het
 * eerst definitief werd, plus het volgnummer per jaar; boven 999 gewoon meer cijfers
 * (`2026-09-26-1000`). Oude nummers (`2026-001`, vóór OFM-033) blijven zoals ze zijn.
 */
export function formatNummer(datum: string, volgnummer: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new RangeError(`Geen datum: ${datum}`);
  return `${datum}-${String(volgnummer).padStart(3, '0')}`;
}

/** Het jaar van een datum `YYYY-MM-DD`; bepaalt de reeks van het volgnummer en de PDF-map. */
export function jaarVan(datum: string): number {
  return Number(datum.slice(0, 4));
}

/**
 * Versieletter voor een nieuwe PDF bij `n` bestaande PDF's van de offerte:
 * 0 → `''`, 1 → `'b'`, 2 → `'c'`, … 25 → `'z'`.
 */
export function versieletter(aantalBestaandePdfs: number): string {
  const n = aantalBestaandePdfs;
  if (!Number.isInteger(n) || n < 0 || n > 25) {
    throw new RangeError(`Geen versieletter voor ${n} bestaande PDF's`);
  }
  return n === 0 ? '' : String.fromCharCode(97 + n);
}

/**
 * Weergavenummer = nummer + versieletter van de laatste PDF. Zonder nummer (concept) `null`;
 * zonder PDF alleen het nummer.
 */
export function weergaveNummer(nummer: string | null, versieletterLaatstePdf: string | null): string | null {
  if (nummer === null) return null;
  return nummer + (versieletterLaatstePdf ?? '');
}
