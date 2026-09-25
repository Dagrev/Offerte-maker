import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  getISOWeek,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { nl } from 'date-fns/locale';
import { leesDatum, schrijfDatum } from './formatteer';

// Periodes voor het hoofdscherm (TDO §8.2, V-14, FE-011, FE-013) en geldig-tot (V-12, FE-058).
// Alle datums zijn strings `YYYY-MM-DD` en worden als lokale kalenderdatum gelezen.

export type Weergave = 'dag' | 'week' | 'maand' | 'jaar';

export interface Periode {
  /** Eerste dag, inclusief. */
  van: string;
  /** Laatste dag, inclusief. */
  tot: string;
  label: string;
}

const WEEK = { weekStartsOn: 1 } as const;

const VERSCHUIVERS = { dag: addDays, week: addWeeks, maand: addMonths, jaar: addYears } as const;

/** Maandafkorting zonder punt (`sep`, `okt`, `mrt`); date-fns `nl` geeft `sep.`. */
function maandKort(d: Date): string {
  return format(d, 'MMM', { locale: nl }).replace(/\.$/, '');
}

/** `21 – 27 sep 2026`, `28 sep – 4 okt 2026`, `29 dec 2025 – 4 jan 2026`. */
function bereikLabel(van: Date, tot: Date): string {
  const jaarVan = van.getFullYear();
  const jaarTot = tot.getFullYear();
  if (jaarVan !== jaarTot) {
    return `${van.getDate()} ${maandKort(van)} ${jaarVan} – ${tot.getDate()} ${maandKort(tot)} ${jaarTot}`;
  }
  if (van.getMonth() !== tot.getMonth()) {
    return `${van.getDate()} ${maandKort(van)} – ${tot.getDate()} ${maandKort(tot)} ${jaarTot}`;
  }
  return `${van.getDate()} – ${tot.getDate()} ${maandKort(tot)} ${jaarTot}`;
}

/** De periode (dag, week ma–zo, maand of jaar) waarin `datum` valt, met label. */
export function periodeVan(weergave: Weergave, datum: string): Periode {
  const d = leesDatum(datum);
  switch (weergave) {
    case 'dag':
      return { van: datum, tot: datum, label: format(d, 'EEEE d MMMM yyyy', { locale: nl }) };
    case 'week': {
      const van = startOfWeek(d, WEEK);
      const tot = endOfWeek(d, WEEK);
      return {
        van: schrijfDatum(van),
        tot: schrijfDatum(tot),
        label: `week ${getISOWeek(d)} · ${bereikLabel(van, tot)}`,
      };
    }
    case 'maand':
      return {
        van: schrijfDatum(startOfMonth(d)),
        tot: schrijfDatum(endOfMonth(d)),
        label: format(d, 'MMMM yyyy', { locale: nl }),
      };
    case 'jaar':
      return {
        van: schrijfDatum(startOfYear(d)),
        tot: schrijfDatum(endOfYear(d)),
        label: format(d, 'yyyy'),
      };
  }
}

/** Een datum in de vorige (`-1`) of volgende (`1`) periode. */
export function verschuif(weergave: Weergave, datum: string, richting: -1 | 1): string {
  return schrijfDatum(VERSCHUIVERS[weergave](leesDatum(datum), richting));
}

/** Geldig tot = offertedatum + geldigheid in dagen (V-12, FE-058). */
export function berekenGeldigTot(offertedatum: string, geldigheidDagen: number): string {
  return schrijfDatum(addDays(leesDatum(offertedatum), geldigheidDagen));
}
