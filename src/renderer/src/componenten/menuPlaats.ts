// Plaats van een contextmenu binnen het venster (OFM-052). Puur, zodat het zonder DOM te testen is.

/** Afstand tot de rand van het venster in pixels. */
export const MENU_RAND = 8;

/**
 * Linkerbovenhoek van het menu. Past het rechts of onder de positie niet, dan spiegelt het naar links
 * of naar boven; past ook dat niet, dan zo dicht mogelijk tegen de rand (nooit buiten het venster).
 */
export function plaatsBinnen(
  positie: { x: number; y: number },
  maat: { breedte: number; hoogte: number },
  venster: { breedte: number; hoogte: number },
): { x: number; y: number } {
  const passend = (p: number, m: number, v: number) => {
    if (p + m <= v - MENU_RAND) return p;
    return Math.max(MENU_RAND, Math.min(p - m, v - MENU_RAND - m));
  };
  return {
    x: passend(positie.x, maat.breedte, venster.breedte),
    y: passend(positie.y, maat.hoogte, venster.hoogte),
  };
}
