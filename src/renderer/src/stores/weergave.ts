import { create } from 'zustand';

// Zoomstand van het offertevoorbeeld (OFM-054, TDO §12.5). Eén stand voor het detailscherm en de
// opmaakvoorbeelden in Instellingen; hij blijft staan zolang de app open is (ook na wisselen tussen
// offertes), maar wordt bewust niet opgeslagen: na een herstart begint het voorbeeld weer passend.

/** `'passend'` = de hele A4-pagina past in de houder; een getal = vaste schaal (1 = 100 %). */
export type Zoom = 'passend' | number;

/** De zoomstappen van − en + (25 % t/m 300 %). */
export const ZOOM_STAPPEN: readonly number[] = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3];
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;

/** Marge rond de pagina in stand Passend (CSS-pixels, per kant). */
export const PASSEND_MARGE = 16;

/**
 * Ondergrens van Passend. Lager dan de kleinste stap (25 %): op 1024 × 700 met een uitgeklapte gele
 * balk is er maar ± 240 px hoogte, en Passend moet dan toch de hele pagina tonen.
 */
export const MIN_PASSEND = 0.1;

/** Schaal waarbij de hele pagina (breedte én hoogte) in de houder past (10 %–300 %). */
export function passendeSchaal(
  houderBreedte: number,
  houderHoogte: number,
  pagina: { breedte: number; hoogte: number },
): number {
  const breedte = (houderBreedte - 2 * PASSEND_MARGE) / pagina.breedte;
  const hoogte = (houderHoogte - 2 * PASSEND_MARGE) / pagina.hoogte;
  const schaal = Math.min(breedte, hoogte);
  if (!Number.isFinite(schaal) || schaal <= 0) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_PASSEND, schaal));
}

/** Eerstvolgende stap groter dan de huidige schaal (of de grootste). */
export function volgendeStap(schaal: number): number {
  return ZOOM_STAPPEN.find((s) => s > schaal + 0.001) ?? MAX_ZOOM;
}

/** Eerstvolgende stap kleiner dan de huidige schaal (of de kleinste). */
export function vorigeStap(schaal: number): number {
  return [...ZOOM_STAPPEN].reverse().find((s) => s < schaal - 0.001) ?? MIN_ZOOM;
}

export function kanGroter(schaal: number): boolean {
  return schaal < MAX_ZOOM - 0.001;
}

export function kanKleiner(schaal: number): boolean {
  return schaal > MIN_ZOOM + 0.001;
}

/** "72 %" (afgerond, met spatie zoals in de rest van de app). */
export function zoomPercentage(schaal: number): string {
  return `${Math.round(schaal * 100)} %`;
}

interface WeergaveState {
  zoom: Zoom;
  zetZoom: (zoom: Zoom) => void;
}

export const useWeergave = create<WeergaveState>()((set) => ({
  zoom: 'passend',
  zetZoom: (zoom) => set({ zoom }),
}));
