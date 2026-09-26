// Getallen in een invoerveld met de komma als decimaalteken (TDO §13.3, GetalVeld). Puur, zodat het
// zonder DOM te testen is (test/renderer/getalNotatie.test.ts).

/**
 * Herkent een geplakt getal met duizendtallen: `1.234,50`, `1.234.567`, `1,234.50` of `1,234,567`.
 * Geeft de tekst terug met de komma als enige (decimaal)teken, of `null` als het geen getal met
 * duizendtallen is. Eén punt of één komma zonder duizendtalgroepen (`1234.50`, `1,234`) is gewoon
 * een decimaalteken en valt hier dus niet onder.
 */
function zonderDuizendtallen(tekst: string): string | null {
  const punten = /^(\d{1,3}(?:\.\d{3})+),(\d*)$|^(\d{1,3}(?:\.\d{3}){2,})$/.exec(tekst);
  if (punten) {
    return punten[1] !== undefined
      ? `${punten[1].replace(/\./g, '')},${punten[2] ?? ''}`
      : (punten[3] ?? '').replace(/\./g, '');
  }
  const kommas = /^(\d{1,3}(?:,\d{3})+)\.(\d*)$|^(\d{1,3}(?:,\d{3}){2,})$/.exec(tekst);
  if (kommas) {
    return kommas[1] !== undefined
      ? `${kommas[1].replace(/,/g, '')},${kommas[2] ?? ''}`
      : (kommas[3] ?? '').replace(/,/g, '');
  }
  return null;
}

/**
 * Houdt alleen toegestane tekens over terwijl de gebruiker typt of plakt: cijfers en één komma, met
 * ten hoogste `decimalen` cijfers erachter. Een punt wordt een komma; een minteken verdwijnt (geen
 * negatieve waarden). Geplakte duizendtallen (`1.234,50`) worden eerst weggehaald.
 */
export function schoonGetalInvoer(tekst: string, decimalen: number): string {
  const kaal = tekst.replace(/[\s ]/g, '');
  const bron = zonderDuizendtallen(kaal.replace(/^-/, '')) ?? kaal;
  let uit = '';
  let kommaGezien = false;
  let naKomma = 0;
  for (const teken of bron.replace(/\./g, ',')) {
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
  // Een voorloopnul vóór een cijfer valt weg: `05` → `5` (maar `0,5` blijft).
  return uit.replace(/^0+(?=\d)/, '');
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

/**
 * Moet de getoonde tekst worden vervangen nu de waarde van buiten is veranderd? Niet als de tekst
 * al dezelfde waarde voorstelt, en niet als het veld leeg is en de waarde 0 of leeg is: een leeg
 * veld telt als 0 en blijft dan leeg (met de placeholder `0`) in plaats van een 0 terug te krijgen.
 */
export function tekstVolgtWaarde(tekst: string, waarde: number | null): boolean {
  const huidig = leesGetal(tekst);
  if (huidig === waarde) return false;
  if (huidig === null && (waarde === null || waarde === 0)) return false;
  return true;
}
