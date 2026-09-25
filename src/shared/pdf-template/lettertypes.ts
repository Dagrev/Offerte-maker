import type { Opmaak } from '../types';

// Lettertypes van de offerte (TDO §12.2, V-22). Gedeeld door de template (font-family) en
// `src/main/pdf/fonts.ts` (welke woff2-bestanden als @font-face worden ingesloten).

export type Lettertype = Opmaak['lettertype'];
export type Gewicht = 400 | 700;

export interface Fontbestand {
  familie: string;
  gewicht: Gewicht;
  /** Bestandsnaam in `resources/fonts/`, gekopieerd door `scripts/kopieer-fonts.mjs`. */
  bestand: string;
}

const GEWICHTEN: readonly Gewicht[] = [400, 700];

function bestanden(familie: string, slug: string): Fontbestand[] {
  return GEWICHTEN.map((gewicht) => ({ familie, gewicht, bestand: `${slug}-latin-${gewicht}-normal.woff2` }));
}

const INTER = bestanden('Inter', 'inter');
const MERRIWEATHER = bestanden('Merriweather', 'merriweather');
const SOURCE_SANS_3 = bestanden('Source Sans 3', 'source-sans-3');

export interface LettertypeSet {
  /** CSS `font-family` voor lopende tekst. */
  tekst: string;
  /** CSS `font-family` voor koppen. */
  kop: string;
  /** De bestanden die hiervoor ingesloten moeten worden. */
  bestanden: readonly Fontbestand[];
}

export const LETTERTYPES: Record<Lettertype, LettertypeSet> = {
  inter: { tekst: "'Inter', sans-serif", kop: "'Inter', sans-serif", bestanden: INTER },
  merriweather: {
    tekst: "'Inter', sans-serif",
    kop: "'Merriweather', serif",
    bestanden: [...MERRIWEATHER, ...INTER],
  },
  'source-sans-3': {
    tekst: "'Source Sans 3', sans-serif",
    kop: "'Source Sans 3', sans-serif",
    bestanden: SOURCE_SANS_3,
  },
};

/** Alle zes bestanden (V-22), zonder dubbelen. */
export const ALLE_FONTBESTANDEN: readonly Fontbestand[] = [...INTER, ...MERRIWEATHER, ...SOURCE_SANS_3];
