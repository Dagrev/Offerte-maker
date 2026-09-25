// Getallen in een invoerveld met de komma als decimaalteken (TDO §13.3, GetalVeld). Puur, zodat het
// zonder DOM te testen is (test/renderer/getalNotatie.test.ts).

/**
 * Houdt alleen toegestane tekens over terwijl de gebruiker typt: cijfers en één komma, met ten
 * hoogste `decimalen` cijfers erachter. Een punt wordt een komma; een minteken verdwijnt (geen
 * negatieve waarden).
 */
export function schoonGetalInvoer(tekst: string, decimalen: number): string {
  let uit = '';
  let kommaGezien = false;
  let naKomma = 0;
  for (const teken of tekst.replace(/\./g, ',')) {
    if (teken >= '0' && teken <= '9') {
      if (kommaGezien) {
        if (naKomma >= decimalen) continue;
        naKomma += 1;
      }
      uit += teken;
    } else if (teken === ',' && !kommaGezien && decimalen > 0) {
      kommaGezien = true;
      uit += teken;
    }
  }
  return uit;
}

/** `'12,5'` → `12.5`; leeg of alleen een komma → `null`. */
export function leesGetal(tekst: string): number | null {
  const schoon = tekst.trim().replace(',', '.');
  if (schoon === '' || schoon === '.') return null;
  const getal = Number(schoon);
  return Number.isFinite(getal) && getal >= 0 ? getal : null;
}

/** `12.5` → `'12,5'`; `null` → `''`. Geen duizendtallen, zodat de tekst weer invoerbaar is. */
export function toonGetal(getal: number | null, decimalen: number): string {
  if (getal === null) return '';
  const afgerond = Number(getal.toFixed(decimalen));
  return String(afgerond).replace('.', ',');
}
