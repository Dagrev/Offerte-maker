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

type Naam = Pick<Klant, 'voornaam' | 'achternaam'>;

/** Voor- en achternaam samen (`Jan de Vries`); een leeg deel valt weg (OFM-038). */
export function volledigeNaam(klant: Naam): string {
  return [klant.voornaam.trim(), klant.achternaam.trim()].filter((d) => d !== '').join(' ');
}

/** Voorletters van de voornaam: `Jan` → `J.`, `Jan-Willem Piet` → `J.W.P.` (OFM-038). */
export function voorletters(voornaam: string): string {
  return voornaam
    .split(/[\s-]+/)
    .filter((d) => d !== '')
    .map((d) => `${d.charAt(0).toUpperCase()}.`)
    .join('');
}

/** Voorletters en achternaam (`J. Jansen`); zonder achternaam de voornaam voluit (OFM-038). */
export function naamMetVoorletters(klant: Naam): string {
  const achternaam = klant.achternaam.trim();
  if (achternaam === '') return klant.voornaam.trim();
  return [voorletters(klant.voornaam), achternaam].filter((d) => d !== '').join(' ');
}

/**
 * Aanhefregel boven de brief (§9.2); de app zet die, niet de agent. Met de achternaam ("Geachte heer
 * Jansen,"); zonder achternaam de voornaam (OFM-038).
 */
export function aanhefRegel(klant: Pick<Klant, 'aanhef' | 'voornaam' | 'achternaam'>): string {
  const naam = klant.achternaam.trim() || klant.voornaam.trim();
  const regels: Record<Aanhef, string> = {
    dhr: `Geachte heer ${naam},`,
    mevr: `Geachte mevrouw ${naam},`,
    fam: `Geachte familie ${naam},`,
    bedrijf: 'Geachte heer, mevrouw,',
  };
  return regels[klant.aanhef];
}

/**
 * Klantnaam in lijsten en op de PDF (§8.2, OFM-038): `Dhr. J. Jansen`, `Fam. Jansen` (zonder
 * voorletters), of bij `bedrijf` de bedrijfsnaam (de contactpersoon als die leeg is).
 */
export function klantWeergave(
  klant: Pick<Klant, 'aanhef' | 'voornaam' | 'achternaam' | 'bedrijfsnaam'>,
): string {
  const naam = naamMetVoorletters(klant);
  switch (klant.aanhef) {
    case 'dhr':
      return `Dhr. ${naam}`;
    case 'mevr':
      return `Mevr. ${naam}`;
    case 'fam':
      return `Fam. ${klant.achternaam.trim() || klant.voornaam.trim()}`;
    case 'bedrijf':
      return klant.bedrijfsnaam.trim() || naam;
  }
}
