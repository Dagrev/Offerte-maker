import type {
  Aanhef,
  Afwerking,
  Bedekking,
  Hoogte,
  HuidigeBedekking,
  Isolatie,
  Klant,
  Ondergrond,
  SoortDak,
  SoortWerk,
} from './types';

// Vaste labels voor de waardesets (TDO §9.1), de aanhefregel (§9.2) en klantWeergave (§8.2).
// Gebruikt door main (prompts, omschrijvingKort), shared (PDF) en renderer (wizard, lijst) (V-16).

export const SOORT_WERK_LABELS: Record<SoortWerk, string> = {
  nieuw_dak: 'Nieuw dak',
  dak_vervangen: 'Dak vervangen',
  reparatie: 'Reparatie',
  dakgoten: 'Dakgoten',
  isolatie: 'Isolatie',
  onderhoud: 'Onderhoud',
};

export const SOORT_DAK_LABELS: Record<SoortDak, string> = {
  plat: 'plat dak',
  hellend: 'hellend dak',
};

/** Vast label per bedekking. Bij `anders` alleen een tegeltekst; gebruik `labelBedekking` voor inhoud. */
export const BEDEKKING_LABELS: Record<Bedekking, string> = {
  epdm_11: 'EPDM 1,1 mm',
  epdm_15: 'EPDM 1,5 mm',
  resitrix: 'Resitrix',
  bitumen: 'Bitumen',
  anders: 'Anders',
};

export const HUIDIGE_BEDEKKING_LABELS: Record<HuidigeBedekking, string> = {
  bitumen: 'Bitumen',
  epdm: 'EPDM',
  grind_op_bitumen: 'Grind op bitumen',
  onbekend: 'Weet ik niet',
};

export const ONDERGROND_LABELS: Record<Ondergrond, string> = {
  hout: 'Hout',
  beton: 'Beton',
  staal: 'Staal',
  onbekend: 'Weet ik niet',
};

/** Vast label per isolatie. Bij `anders` alleen een tegeltekst; gebruik `labelIsolatie` voor inhoud. */
export const ISOLATIE_LABELS: Record<Isolatie, string> = {
  geen: 'Geen',
  '80': '80 mm (Rc 3,5)',
  '100': '100 mm',
  '120': '120 mm',
  anders: 'Anders',
};

export const AFWERKING_LABELS: Record<Afwerking, string> = {
  geen: 'Geen',
  grind: 'Grind',
  sedum: 'Sedum',
};

export const HOOGTE_LABELS: Record<Hoogte, string> = {
  '1': 'Begane grond / 1 bouwlaag',
  '2': '2 bouwlagen',
  '3plus': '3 of meer bouwlagen',
};

/** Label van de bedekking; bij `anders` de ingevulde tekst (leeg als niets ingevuld). */
export function labelBedekking(bedekking: Bedekking, bedekkingAnders: string): string {
  return bedekking === 'anders' ? bedekkingAnders.trim() : BEDEKKING_LABELS[bedekking];
}

/** Label van de isolatie; bij `anders` `<n> mm` (leeg als er geen dikte is ingevuld). */
export function labelIsolatie(isolatie: Isolatie, isolatieAndersMm: number | null): string {
  if (isolatie !== 'anders') return ISOLATIE_LABELS[isolatie];
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
