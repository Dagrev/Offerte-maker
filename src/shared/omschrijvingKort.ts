import { aantalNaarHonderdsten, totaalM2 } from './calc/bedragen';
import { formatAantal } from './formatteer';
import { keuzeLabel, type Keuzes } from './keuzelijsten';
import type { KlusInvoer } from './types';

// Korte omschrijving voor lijst en zoekresultaten (TDO §8.2, V-14): `<soortWerk> · <totaalM2> m²`,
// ontbrekende delen weggelaten. Labels uit de keuzelijsten (OFM-034); na hernoemen rekent main de
// opgeslagen omschrijvingen opnieuw uit. Het deel `<bedekking>` verviel met de oude stap Extra's
// (OFM-044/045); oude offertes houden hun opgeslagen omschrijving tot die opnieuw wordt uitgerekend.

export function omschrijvingKort(
  invoer: Pick<KlusInvoer, 'soortWerk' | 'dakvlakken'>,
  keuzes: Pick<Keuzes, 'soortWerk'>,
): string {
  const delen: string[] = [];
  if (invoer.soortWerk !== null) delen.push(keuzeLabel(keuzes, 'soortWerk', invoer.soortWerk));
  const m2 = totaalM2(invoer.dakvlakken);
  if (m2 > 0) delen.push(`${formatAantal(aantalNaarHonderdsten(m2))} m²`);
  return delen.filter((d) => d !== '').join(' · ');
}
