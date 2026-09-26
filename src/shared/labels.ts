import type { Aanhef, Klant } from './types';
import { naamVan, type Naamdelen } from './naam';

// Labels (TDO §9.1). De labels van de keuzelijsten komen sinds OFM-034 uit de database
// (`keuzeopties`), doorgegeven als `Keuzes`; de startwaarden staan in `keuzelijsten.ts`. Hier staan de
// namen, de aanhefregel (§9.2) en klantWeergave (§8.2); de afgeleide labels van bedekking en isolatie
// vervielen met OFM-045. Gebruikt door main, shared (PDF) en
// renderer (V-16).

// De naamvormen zelf staan sinds OFM-046 (tussenvoegsel) in `naam.ts`.
export { voorletters } from './naam';

/** Voornaam, tussenvoegsel en achternaam samen (`Jan van der Berg`); een leeg deel valt weg. */
export function volledigeNaam(klant: Naamdelen): string {
  return naamVan(klant, 'volledig');
}

/** Voorletters en achternaam (`J. van der Berg`); zonder achternaam de voornaam voluit (OFM-038/046). */
export function naamMetVoorletters(klant: Naamdelen): string {
  return naamVan(klant, 'voorletters');
}

/**
 * Aanhefregel boven de brief (§9.2); de app zet die, niet de agent. Met de achternaam ("Geachte heer
 * Jansen,", met tussenvoegsel "Geachte heer Van der Berg,"); zonder achternaam de voornaam (OFM-038/046).
 */
export function aanhefRegel(klant: Pick<Klant, 'aanhef'> & Naamdelen): string {
  const naam = naamVan(klant, 'achternaamVooraan') || klant.voornaam.trim();
  const regels: Record<Aanhef, string> = {
    dhr: `Geachte heer ${naam},`,
    mevr: `Geachte mevrouw ${naam},`,
    fam: `Geachte familie ${naam},`,
    bedrijf: 'Geachte heer, mevrouw,',
  };
  return regels[klant.aanhef];
}

/**
 * Klantnaam in lijsten en op de PDF (§8.2, OFM-038/046): `Dhr. J. van der Berg`, `Fam. Van der Berg`
 * (zonder voorletters, tussenvoegsel vooraan met hoofdletter), of bij `bedrijf` de bedrijfsnaam (de
 * contactpersoon als die leeg is).
 */
export function klantWeergave(klant: Pick<Klant, 'aanhef' | 'bedrijfsnaam'> & Naamdelen): string {
  const naam = naamMetVoorletters(klant);
  switch (klant.aanhef) {
    case 'dhr':
      return `Dhr. ${naam}`;
    case 'mevr':
      return `Mevr. ${naam}`;
    case 'fam':
      return `Fam. ${naamVan(klant, 'achternaamVooraan') || klant.voornaam.trim()}`;
    case 'bedrijf':
      return klant.bedrijfsnaam.trim() || naam;
  }
}
