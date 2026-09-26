import { keuzeLabel, type Keuzes } from './keuzelijsten';
import type { Aanhef, Klant } from './types';

// Labels (TDO §9.1). De labels van de keuzelijsten komen sinds OFM-034 uit de database
// (`keuzeopties`), doorgegeven als `Keuzes`; de startwaarden staan in `keuzelijsten.ts`. Hier staan de
// afgeleide labels, de aanhefregel (§9.2) en klantWeergave (§8.2). Gebruikt door main, shared (PDF) en
// renderer (V-16).

/** Label van de bedekking; bij `anders` de ingevulde tekst (leeg als niets ingevuld). */
export function labelBedekking(
  keuzes: Pick<Keuzes, 'bedekking'>,
  bedekking: string,
  bedekkingAnders: string,
): string {
  return bedekking === 'anders' ? bedekkingAnders.trim() : keuzeLabel(keuzes, 'bedekking', bedekking);
}

/** Label van de isolatie; bij `anders` `<n> mm` (leeg als er geen dikte is ingevuld). */
export function labelIsolatie(
  keuzes: Pick<Keuzes, 'isolatie'>,
  isolatie: string,
  isolatieAndersMm: number | null,
): string {
  if (isolatie !== 'anders') return keuzeLabel(keuzes, 'isolatie', isolatie);
  return isolatieAndersMm === null ? '' : `${isolatieAndersMm} mm`;
}

/** Aanhefregel boven de brief (§9.2); de app zet die, niet de agent. */
export function aanhefRegel(klant: Pick<Klant, 'aanhef' | 'naam'>): string {
  const naam = klant.naam.trim();
  const regels: Record<Aanhef, string> = {
    dhr: `Geachte heer ${naam},`,
    mevr: `Geachte mevrouw ${naam},`,
    fam: `Geachte familie ${naam},`,
    bedrijf: 'Geachte heer, mevrouw,',
  };
  return regels[klant.aanhef];
}

/** Klantnaam in lijsten (§8.2): `Dhr. Jansen`, of bij `bedrijf` de bedrijfsnaam (de naam als die leeg is). */
export function klantWeergave(klant: Pick<Klant, 'aanhef' | 'naam' | 'bedrijfsnaam'>): string {
  const naam = klant.naam.trim();
  switch (klant.aanhef) {
    case 'dhr':
      return `Dhr. ${naam}`;
    case 'mevr':
      return `Mevr. ${naam}`;
    case 'fam':
      return `Fam. ${naam}`;
    case 'bedrijf':
      return klant.bedrijfsnaam.trim() || naam;
  }
}
