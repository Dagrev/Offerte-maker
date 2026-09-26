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

/** Een datum in de vorige (`-1`) of volgende (`1`) periode; ook meer stappen tegelijk (`-3`, `7`). */
export function verschuif(weergave: Weergave, datum: string, richting: number): string {
  return schrijfDatum(VERSCHUIVERS[weergave](leesDatum(datum), richting));
}

// Hulpjes voor de periodekiezer op het hoofdscherm (OFM-037). De kiezer rekent zelf niet met datums:
// alles loopt via `periodeVan` en `verschuif`.

/** Of twee datums in dezelfde dag, week, maand of jaar vallen. */
export function zelfdePeriode(weergave: Weergave, a: string, b: string): boolean {
  return periodeVan(weergave, a).van === periodeVan(weergave, b).van;
}

/** ISO-weeknummer (maandag t/m zondag, A-21). */
export function weeknummer(datum: string): number {
  return getISOWeek(leesDatum(datum));
}

/** De maand waarin `datum` valt als kalender: hele weken van maandag t/m zondag, 4 tot 6 rijen. */
export function maandRaster(datum: string): string[][] {
  const { van, tot } = periodeVan('maand', datum);
  const weken: string[][] = [];
  for (let maandag = periodeVan('week', van).van; maandag <= tot; maandag = verschuif('week', maandag, 1)) {
    weken.push(Array.from({ length: 7 }, (_, i) => verschuif('dag', maandag, i)));
  }
  return weken;
}

/** De eerste dag van elk van de twaalf maanden in het jaar van `datum`. */
export function maandenVanJaar(datum: string): string[] {
  const van = periodeVan('jaar', datum).van;
  return Array.from({ length: 12 }, (_, i) => verschuif('maand', van, i));
}

/**
 * Jaren voor de jaarkiezer, als 1 januari: van tien jaar vóór vandaag tot en met volgend jaar, en
 * verder terug of vooruit als `datum` daarbuiten ligt (na lang bladeren met ◀ ▶).
 */
export function kiesbareJaren(vandaag: string, datum: string): string[] {
  const dezeJaar = periodeVan('jaar', vandaag).van;
  const gekozen = periodeVan('jaar', datum).van;
  const eerste = [verschuif('jaar', dezeJaar, -10), gekozen].sort()[0] ?? gekozen;
  const laatste = [verschuif('jaar', dezeJaar, 1), gekozen].sort()[1] ?? gekozen;
  const jaren: string[] = [];
  for (let jaar = eerste; jaar <= laatste; jaar = verschuif('jaar', jaar, 1)) jaren.push(jaar);
  return jaren;
}

/** Geldig tot = offertedatum + geldigheid in dagen (V-12, FE-058). */
export function berekenGeldigTot(offertedatum: string, geldigheidDagen: number): string {
  return schrijfDatum(addDays(leesDatum(offertedatum), geldigheidDagen));
}
