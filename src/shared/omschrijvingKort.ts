import { aantalNaarHonderdsten, totaalM2 } from './calc/bedragen';
import { formatAantal } from './formatteer';
import { keuzeLabel, type Keuzes } from './keuzelijsten';
import { labelBedekking } from './labels';
import { oudeVelden, type OudeInvoer } from './oudeInvoer';
import type { KlusInvoer } from './types';

// Korte omschrijving voor lijst en zoekresultaten (TDO §8.2, V-14):
// `<soortWerk> · <bedekking> · <totaalM2> m²`, ontbrekende delen weggelaten. Labels uit de
// keuzelijsten (OFM-034); na hernoemen rekent main de opgeslagen omschrijvingen opnieuw uit. Sinds
// OFM-044 kiest de wizard geen bedekking meer; alleen oude offertes hebben dat deel nog.

export function omschrijvingKort(
  invoer: Pick<KlusInvoer, 'soortWerk' | 'dakvlakken'> & Pick<OudeInvoer, 'bedekking' | 'bedekkingAnders'>,
  keuzes: Pick<Keuzes, 'soortWerk' | 'bedekking'>,
): string {
  const oud = oudeVelden(invoer);
  const delen: string[] = [];
  if (invoer.soortWerk !== null) delen.push(keuzeLabel(keuzes, 'soortWerk', invoer.soortWerk));
  if (oud.bedekking !== null) delen.push(labelBedekking(keuzes, oud.bedekking, oud.bedekkingAnders));
  const m2 = totaalM2(invoer.dakvlakken);
  if (m2 > 0) delen.push(`${formatAantal(aantalNaarHonderdsten(m2))} m²`);
  return delen.filter((d) => d !== '').join(' · ');
}
