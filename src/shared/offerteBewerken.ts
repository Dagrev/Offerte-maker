import { formatEuro } from './formatteer';
import type { Eenheid, OfferteInhoud, Offerteregel } from './types';

// Pure hulpfuncties voor het detailscherm en het bewerkscherm (TDO §13.4, V-05, FE-051/052).
// Gedeeld door renderer (live weergave) en main (`offerte:bewaarInhoud`), zodat beide dezelfde regels
// toepassen. Zichtbare tekst komt uit de renderer (`teksten/`) via een parameter (V-11).

/** Tekst van één schattingsmelding; de renderer levert hem uit `teksten/detail.ts`. */
export type SchattingsTekst = (omschrijving: string, prijs: string, eenheid: Eenheid) => string;

/**
 * Punten van de gele balk (V-05): de opgeslagen controlepunten plus, berekend en niet opgeslagen, één
 * melding per regel met `prijsbron 'schatting'`.
 */
export function gelePunten(inhoud: OfferteInhoud, schatting: SchattingsTekst): string[] {
  const meldingen = inhoud.regels
    .filter((r) => r.prijsbron === 'schatting')
    .map((r) => schatting(r.omschrijving, formatEuro(r.prijsCent), r.eenheid));
  return [...inhoud.controlepunten, ...meldingen];
}

/**
 * Prijsbron na handmatig aanpassen (§5, V-05): een regel die niet in `oud` voorkomt (nieuw) of waarvan
 * de prijs anders is, wordt `handmatig`. De overige regels houden hun prijsbron.
 */
export function markeerHandmatig(
  oud: readonly Offerteregel[],
  nieuw: readonly Offerteregel[],
): Offerteregel[] {
  const oudePrijs = new Map(oud.map((r) => [r.id, r.prijsCent]));
  return nieuw.map((r) => {
    const prijs = oudePrijs.get(r.id);
    return prijs === undefined || prijs !== r.prijsCent ? { ...r, prijsbron: 'handmatig' } : r;
  });
}

/** Nieuwe regel (§5): eigen id, `handmatig`, geen prijspost. */
export function nieuweRegel(id: string): Offerteregel {
  return {
    id,
    omschrijving: '',
    aantalHonderdsten: 100,
    eenheid: 'stuk',
    prijsCent: 0,
    btwTarief: 21,
    prijsbron: 'handmatig',
    prijspostId: null,
  };
}

/** Verplaatst element `index` één plek omhoog (`-1`) of omlaag (`1`); buiten de lijst → ongewijzigd. */
export function verplaats<T>(lijst: readonly T[], index: number, richting: -1 | 1): T[] {
  const doel = index + richting;
  const kopie = [...lijst];
  if (index < 0 || index >= lijst.length || doel < 0 || doel >= lijst.length) return kopie;
  [kopie[index], kopie[doel]] = [kopie[doel] as T, kopie[index] as T];
  return kopie;
}

/** Werkomschrijving uit een tekstvak: één stap per regel, lege regels vallen weg. */
export function werkomschrijvingUitTekst(tekst: string): string[] {
  return tekst.split(/\r?\n/).filter((regel) => regel.trim() !== '');
}

/** Formulierstate van het bewerkscherm: de werkomschrijving als één tekstvak. */
export interface BewerkFormulier extends Omit<OfferteInhoud, 'werkomschrijving'> {
  werkomschrijving: string;
}

export function formulierVan(inhoud: OfferteInhoud): BewerkFormulier {
  return { ...inhoud, werkomschrijving: inhoud.werkomschrijving.join('\n') };
}

/**
 * Inhoud uit het formulier, zoals hij naar `offerte:bewaarInhoud` gaat en in de live weergave gebruikt
 * wordt: werkomschrijving per regel, prijsbron bijgewerkt ten opzichte van de `oorspronkelijke` regels.
 */
export function inhoudVan(f: BewerkFormulier, oorspronkelijk: readonly Offerteregel[]): OfferteInhoud {
  return {
    titel: f.titel,
    inleiding: f.inleiding,
    werkomschrijving: werkomschrijvingUitTekst(f.werkomschrijving),
    regels: markeerHandmatig(oorspronkelijk, f.regels),
    uitvoering: f.uitvoering,
    opmerkingen: f.opmerkingen,
    afsluiting: f.afsluiting,
    controlepunten: f.controlepunten,
  };
}

/** Heeft de gebruiker iets veranderd ten opzichte van de geopende inhoud? */
export function isGewijzigd(f: BewerkFormulier, oorspronkelijk: OfferteInhoud): boolean {
  const nu = inhoudVan(f, oorspronkelijk.regels);
  const was = inhoudVan(formulierVan(oorspronkelijk), oorspronkelijk.regels);
  return JSON.stringify(nu) !== JSON.stringify(was);
}
