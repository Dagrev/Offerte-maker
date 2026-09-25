// Pure delen van de nummering (TDO §8.1, FE-055). `volgendNummer(db, jaar)` hoort bij de repo-kant
// in main (OFM-015): `src/shared` mag de database niet importeren.

/** `formatNummer(2026, 1)` → `2026-001`; boven 999 gewoon meer cijfers (`2026-1000`). */
export function formatNummer(jaar: number, volgnummer: number): string {
  return `${jaar}-${String(volgnummer).padStart(3, '0')}`;
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
