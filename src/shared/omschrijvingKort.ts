import { aantalNaarHonderdsten, totaalM2 } from './calc/bedragen';
import { formatAantal } from './formatteer';
import { keuzeLabel, type Keuzes } from './keuzelijsten';
import { labelBedekking } from './labels';
import type { KlusInvoer } from './types';

// Korte omschrijving voor lijst en zoekresultaten (TDO §8.2, V-14):
// `<soortWerk> · <bedekking> · <totaalM2> m²`, ontbrekende delen weggelaten. Labels uit de
// keuzelijsten (OFM-034); na hernoemen rekent main de opgeslagen omschrijvingen opnieuw uit.

export function omschrijvingKort(
  invoer: Pick<KlusInvoer, 'soortWerk' | 'bedekking' | 'bedekkingAnders' | 'dakvlakken'>,
  keuzes: Pick<Keuzes, 'soortWerk' | 'bedekking'>,
): string {
  const delen: string[] = [];
  if (invoer.soortWerk !== null) delen.push(keuzeLabel(keuzes, 'soortWerk', invoer.soortWerk));
  if (invoer.bedekking !== null) delen.push(labelBedekking(keuzes, invoer.bedekking, invoer.bedekkingAnders));
  const m2 = totaalM2(invoer.dakvlakken);
  if (m2 > 0) delen.push(`${formatAantal(aantalNaarHonderdsten(m2))} m²`);
  return delen.filter((d) => d !== '').join(' · ');
}
