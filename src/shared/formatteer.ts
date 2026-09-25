import { format, parse } from 'date-fns';
import { nl } from 'date-fns/locale';
import { rondAf } from './calc/bedragen';

// Opmaak voor weergave (TDO §7, V-14, V-27). Pure functies; geen Node of Electron.
//   formatEuro      overal waar bedragen met centen staan
//   formatEuroHeel  lijst, samenvatting en maandsubtotalen
//   formatAantal    PDF en omschrijvingKort (geen overbodige nullen)
//   formatM2        wizardtotaal (altijd twee decimalen)

/** Intl zet een harde (of smalle harde) spatie tussen € en bedrag; wij willen een gewone spatie. */
function gewoneSpaties(s: string): string {
  return s.replace(/[  ]/g, ' ');
}

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const euroHeel = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const aantal = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 });
const tweeDecimalen = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123456 → `€ 1.234,56` */
export function formatEuro(cent: number): string {
  return gewoneSpaties(euro.format(cent / 100));
}

/** 481200 → `€ 4.812`; eerst half-van-nul-af op hele euro's (481250 → `€ 4.813`, V-27). */
export function formatEuroHeel(cent: number): string {
  return gewoneSpaties(euroHeel.format(rondAf(cent / 100)));
}

/** 3480 → `34,8`, 100 → `1`, 3485 → `34,85` */
export function formatAantal(honderdsten: number): string {
  return aantal.format(honderdsten / 100);
}

/** 3480 → `34,80` */
export function formatM2(honderdsten: number): string {
  return tweeDecimalen.format(honderdsten / 100);
}

/** `YYYY-MM-DD` als lokale kalenderdatum (niet `new Date(s)`, dat leest UTC). */
export function leesDatum(datum: string): Date {
  return parse(datum, 'yyyy-MM-dd', new Date(2000, 0, 1));
}

/** Lokale datum → `YYYY-MM-DD`. */
export function schrijfDatum(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** `2026-09-25` → `25-09-2026` */
export function formatDatum(datum: string): string {
  return format(leesDatum(datum), 'dd-MM-yyyy');
}

/** `2026-09-25` → `25 september 2026` */
export function formatDatumLang(datum: string): string {
  return format(leesDatum(datum), 'd MMMM yyyy', { locale: nl });
}
