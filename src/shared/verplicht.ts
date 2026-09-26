import { m2VanDakvlak } from './calc/bedragen';
import type { Klant, KlusInvoer } from './types';
import { splitsStraatHuisnummer } from './validatie';

// Instelbare verplichte velden van de wizard (OFM-038). Puur: gedeeld door de wizard (samenvatting en
// stappenbalk), main (`offerte:maak`, `offerte:maakZonderClaude`) en de tab Instellingen › Verplichte
// velden. Een nieuw veld (bijv. OFM-044 "minstens één werkzaamheid") = één entry in `VERPLICHT_VELDEN`
// met een standaard in `STANDAARD_VERPLICHT`, een stap in `VELD_STAP`, een controle in `ONTBREEKT` en
// teksten; oude opgeslagen instellingen krijgen voor dat veld vanzelf de standaard (schema-default).

/** Velden waarvan de gebruiker kan instellen of ze verplicht zijn, in de volgorde van de wizard. */
export const VERPLICHT_VELDEN = [
  // stap 1: klant
  'aanhef',
  'voornaam',
  'achternaam',
  'bedrijfsnaam',
  'postcode',
  'huisnummer',
  'straat',
  'plaats',
  'telefoon',
  'email',
  'werkPostcode',
  'werkHuisnummer',
  'werkStraat',
  'werkPlaats',
  // stap 2: het dak (hoogte sinds OFM-044)
  'soortDak',
  'hoogte',
  // stap 3: werkzaamheden (OFM-044; soort werk staat hier ook; OFM-050 nieuwe dakbedekking)
  'nieuweBedekking',
  'werkzaamheid',
] as const;

export type VerplichtVeld = (typeof VERPLICHT_VELDEN)[number];

/** Altijd verplicht, niet uit te zetten: de agent heeft ze nodig om een offerte te schrijven. */
export const ALTIJD_VERPLICHT = ['soortWerk', 'dakvlak'] as const;
export type AltijdVerplichtVeld = (typeof ALTIJD_VERPLICHT)[number];

/** Elk veld dat in de wizard als "ontbreekt" gemeld kan worden. */
export type WizardVeld = VerplichtVeld | AltijdVerplichtVeld;

export type Verplicht = Record<VerplichtVeld, boolean>;

/** De stap waarop het veld in de wizard staat (sinds OFM-044: hoogte bij het dak, soort werk bij stap 3). */
export const VELD_STAP: Record<WizardVeld, 1 | 2 | 3> = {
  aanhef: 1,
  voornaam: 1,
  achternaam: 1,
  bedrijfsnaam: 1,
  postcode: 1,
  huisnummer: 1,
  straat: 1,
  plaats: 1,
  telefoon: 1,
  email: 1,
  werkPostcode: 1,
  werkHuisnummer: 1,
  werkStraat: 1,
  werkPlaats: 1,
  soortWerk: 3,
  soortDak: 2,
  dakvlak: 2,
  hoogte: 2,
  nieuweBedekking: 3,
  werkzaamheid: 3,
};

/** Standaard: alles van stap 1 verplicht; in stap 2 alleen de altijd-verplichte velden; in stap 3 minstens één werkzaamheid (OFM-044). */
export const STANDAARD_VERPLICHT: Verplicht = {
  aanhef: true,
  voornaam: true,
  achternaam: true,
  bedrijfsnaam: true,
  postcode: true,
  huisnummer: true,
  straat: true,
  plaats: true,
  telefoon: true,
  email: true,
  werkPostcode: true,
  werkHuisnummer: true,
  werkStraat: true,
  werkPlaats: true,
  soortDak: false,
  hoogte: false,
  nieuweBedekking: false,
  werkzaamheid: true,
};

export function standaardVerplicht(): Verplicht {
  return { ...STANDAARD_VERPLICHT };
}

const leeg = (tekst: string) => tekst.trim() === '';

/**
 * Straat en huisnummer staan samen in één veld (§5, OFM-031). Een huisnummer is er als het laatste deel
 * een huisnummer is; de straat is er als er iets anders dan alleen een huisnummer staat.
 */
function adresDelen(straatHuisnummer: string): { straat: boolean; huisnummer: boolean } {
  if (leeg(straatHuisnummer)) return { straat: false, huisnummer: false };
  if (splitsStraatHuisnummer(straatHuisnummer)) return { straat: true, huisnummer: true };
  return { straat: true, huisnummer: false };
}

/** OFM-050: vraagt deze soort werk om een nieuwe dakbedekking (vinkje in de keuzelijst soort werk)? */
export type VraagtBedekking = (soortWerk: string) => boolean;

type Bron = {
  klant: Klant;
  invoer: Pick<KlusInvoer, 'soortWerk' | 'soortDak' | 'dakvlakken' | 'hoogte' | 'werkzaamheden'> &
    Partial<Pick<KlusInvoer, 'nieuweBedekking'>>;
  vraagtBedekking: VraagtBedekking;
};

/** Per veld: `true` als het ontbreekt. Werkadres telt alleen als "Het werk is op een ander adres" aan staat. */
const ONTBREEKT: Record<WizardVeld, (b: Bron) => boolean> = {
  aanhef: ({ klant }) => leeg(klant.aanhef),
  voornaam: ({ klant }) => leeg(klant.voornaam),
  achternaam: ({ klant }) => leeg(klant.achternaam),
  bedrijfsnaam: ({ klant }) => klant.aanhef === 'bedrijf' && leeg(klant.bedrijfsnaam),
  postcode: ({ klant }) => leeg(klant.adres.postcode),
  huisnummer: ({ klant }) => !adresDelen(klant.adres.straatHuisnummer).huisnummer,
  straat: ({ klant }) => !adresDelen(klant.adres.straatHuisnummer).straat,
  plaats: ({ klant }) => leeg(klant.adres.plaats),
  telefoon: ({ klant }) => leeg(klant.telefoon),
  email: ({ klant }) => leeg(klant.email),
  werkPostcode: ({ klant }) => klant.heeftWerkadres && leeg(klant.werkadres.postcode),
  werkHuisnummer: ({ klant }) =>
    klant.heeftWerkadres && !adresDelen(klant.werkadres.straatHuisnummer).huisnummer,
  werkStraat: ({ klant }) => klant.heeftWerkadres && !adresDelen(klant.werkadres.straatHuisnummer).straat,
  werkPlaats: ({ klant }) => klant.heeftWerkadres && leeg(klant.werkadres.plaats),
  soortWerk: ({ invoer }) => invoer.soortWerk === null,
  soortDak: ({ invoer }) => invoer.soortDak === null,
  dakvlak: ({ invoer }) => !invoer.dakvlakken.some((v) => m2VanDakvlak(v) > 0),
  hoogte: ({ invoer }) => invoer.hoogte === null || leeg(invoer.hoogte),
  // Alleen als de gekozen soort werk erom vraagt; anders staat het veld niet in de wizard.
  nieuweBedekking: ({ invoer, vraagtBedekking }) =>
    invoer.soortWerk !== null &&
    vraagtBedekking(invoer.soortWerk) &&
    (invoer.nieuweBedekking ?? null) === null,
  werkzaamheid: ({ invoer }) => invoer.werkzaamheden.length === 0,
};

/** Alle velden in wizardvolgorde (altijd-verplicht op hun plek: dakvlak in stap 2, soort werk in stap 3). */
const ALLE_VELDEN: readonly WizardVeld[] = [
  ...VERPLICHT_VELDEN.filter((v) => VELD_STAP[v] === 1),
  ...VERPLICHT_VELDEN.filter((v) => VELD_STAP[v] === 2),
  'dakvlak',
  'soortWerk',
  ...VERPLICHT_VELDEN.filter((v) => VELD_STAP[v] === 3),
];

/**
 * De verplichte velden die leeg zijn, in wizardvolgorde. `vraagtBedekking` (OFM-050): zonder die
 * functie telt de nieuwe dakbedekking nooit als ontbrekend.
 */
export function ontbrekendeVelden(
  klant: Klant,
  invoer: Bron['invoer'],
  verplicht: Verplicht,
  vraagtBedekking: VraagtBedekking = () => false,
): WizardVeld[] {
  const isVerplicht = (v: WizardVeld) =>
    (ALTIJD_VERPLICHT as readonly string[]).includes(v) || verplicht[v as VerplichtVeld];
  return ALLE_VELDEN.filter((v) => isVerplicht(v) && ONTBREEKT[v]({ klant, invoer, vraagtBedekking }));
}
