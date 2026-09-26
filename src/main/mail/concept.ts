import { formatDatumLang } from '@shared/formatteer';
import { aanhefRegel } from '@shared/labels';
import { naamVan } from '@shared/naam';
import type { Klant } from '@shared/types';

// Het mailconcept bij Verstuur per e-mail (OFM-041): ontvanger, onderwerp en tekst. Puur; de tekst komt
// uit de instelbare standaardtekst `teksten.emailTekst` met plaatshouders.

export const PLAATSHOUDERS = ['aanhef', 'achternaam', 'nummer', 'bedrijfsnaam', 'geldigTot'] as const;
export type Plaatshouder = (typeof PLAATSHOUDERS)[number];

export interface MailConcept {
  /** E-mailadres van de klant; leeg als dat ontbreekt. */
  aan: string;
  onderwerp: string;
  /** Regels gescheiden door CRLF (wat mailprogramma's verwachten). */
  tekst: string;
}

export interface ConceptBron {
  klant: Pick<Klant, 'aanhef' | 'voornaam' | 'tussenvoegsel' | 'achternaam' | 'email'>;
  /** Weergavenummer met versieletter, bijvoorbeeld `2026-09-26-001b`. */
  nummer: string;
  /** `YYYY-MM-DD`. */
  geldigTot: string;
  bedrijfsnaam: string;
  emailTekst: string;
}

/**
 * Achternaam voor `{achternaam}` (OFM-038: het eigen veld `klant.achternaam`), sinds OFM-046 met het
 * tussenvoegsel vooraan met hoofdletter ("Van der Berg"): de plaatshouder staat meestal na "Geachte …".
 */
export function achternaamVan(klant: Pick<Klant, 'tussenvoegsel' | 'achternaam'>): string {
  return naamVan({ voornaam: '', ...klant }, 'achternaamVooraan');
}

/**
 * Aanhefregel als op de PDF (§9.2: achternaam, zonder achternaam de voornaam); zonder enige naam de
 * neutrale vorm in plaats van "Geachte heer ,".
 */
export function mailAanhef(klant: Pick<Klant, 'aanhef' | 'voornaam' | 'tussenvoegsel' | 'achternaam'>): string {
  const geenNaam = achternaamVan(klant) === '' && klant.voornaam.trim() === '';
  if (klant.aanhef !== 'bedrijf' && geenNaam) return 'Geachte heer, mevrouw,';
  return aanhefRegel(klant);
}

/** Vervangt `{naam}` door de waarde; onbekende plaatshouders blijven letterlijk staan. */
export function vulPlaatshouders(tekst: string, waarden: Record<Plaatshouder, string>): string {
  return tekst.replace(/\{(\w+)\}/g, (geheel, naam: string) =>
    (PLAATSHOUDERS as readonly string[]).includes(naam) ? waarden[naam as Plaatshouder] : geheel,
  );
}

export function maakMailConcept(bron: ConceptBron): MailConcept {
  const bedrijfsnaam = bron.bedrijfsnaam.trim();
  const waarden: Record<Plaatshouder, string> = {
    aanhef: mailAanhef(bron.klant),
    achternaam: achternaamVan(bron.klant),
    nummer: bron.nummer,
    bedrijfsnaam,
    geldigTot: formatDatumLang(bron.geldigTot),
  };
  return {
    aan: bron.klant.email.trim(),
    onderwerp: bedrijfsnaam ? `Offerte ${bron.nummer} van ${bedrijfsnaam}` : `Offerte ${bron.nummer}`,
    tekst: vulPlaatshouders(bron.emailTekst, waarden).replace(/\r?\n/g, '\r\n'),
  };
}
