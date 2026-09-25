import { aantalNaarHonderdsten, totaalM2 } from './calc/bedragen';
import { formatAantal } from './formatteer';
import { SOORT_WERK_LABELS, labelBedekking } from './labels';
import type { KlusInvoer } from './types';

// Korte omschrijving voor lijst en zoekresultaten (TDO §8.2, V-14):
// `<soortWerk> · <bedekking> · <totaalM2> m²`, ontbrekende delen weggelaten.

export function omschrijvingKort(
  invoer: Pick<KlusInvoer, 'soortWerk' | 'bedekking' | 'bedekkingAnders' | 'dakvlakken'>,
): string {
  const delen: string[] = [];
  if (invoer.soortWerk !== null) delen.push(SOORT_WERK_LABELS[invoer.soortWerk]);
  if (invoer.bedekking !== null) delen.push(labelBedekking(invoer.bedekking, invoer.bedekkingAnders));
  const m2 = totaalM2(invoer.dakvlakken);
  if (m2 > 0) delen.push(`${formatAantal(aantalNaarHonderdsten(m2))} m²`);
  return delen.filter((d) => d !== '').join(' · ');
}
