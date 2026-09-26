import type { Eenheid, KlusInvoer } from './types';

// Werkzaamheden, opties en materialen (OFM-043, TDO §4.2 migratie 004, §9.6). De startset hieronder is
// de enige bron (V-13): `migreer()` voegt hem direct na migratie 004 in, met een prijspost zonder prijs
// per werkzaamheid, optie en materiaal. Prijzen staan alleen in de prijslijst (sleutels `werk:<s>`,
// `optie:<werkzaamheid>:<s>`, `mat:<s>`). Soorten werk zijn de keuzelijst `soortWerk` (OFM-034).
// Puur (geen Node of DOM): main, renderer en later de wizard (OFM-044) gebruiken dit.

export interface StartOptie {
  sleutel: string;
  label: string;
  eenheid: Eenheid;
}

export interface StartWerkzaamheid {
  sleutel: string;
  label: string;
  eenheid: Eenheid;
  /** Sleutels uit de keuzelijst `soortWerk`. */
  soortenWerk: readonly string[];
  opties: readonly StartOptie[];
  /** Sleutels van kiesbare materialen. */
  materialen: readonly string[];
  /** Voorgeselecteerd materiaal (een van `materialen`), of `null`. */
  standaardMateriaal: string | null;
}

export interface StartMateriaal {
  sleutel: string;
  label: string;
  eenheid: Eenheid;
}

export const MATERIALEN_STARTSET: readonly StartMateriaal[] = [
  { sleutel: 'pir_60', label: 'PIR 60 mm', eenheid: 'm²' },
  { sleutel: 'pir_80', label: 'PIR 80 mm', eenheid: 'm²' },
  { sleutel: 'pir_100', label: 'PIR 100 mm', eenheid: 'm²' },
  { sleutel: 'eps', label: 'EPS', eenheid: 'm²' },
  { sleutel: 'bitumen', label: 'Bitumen', eenheid: 'm²' },
  { sleutel: 'epdm', label: 'EPDM', eenheid: 'm²' },
  { sleutel: 'pvc', label: 'PVC', eenheid: 'm²' },
  { sleutel: 'daktrim_aluminium', label: 'Daktrim aluminium', eenheid: 'm¹' },
  { sleutel: 'boeideel', label: 'Boeideel', eenheid: 'm¹' },
];

const ISOLATIE = ['pir_60', 'pir_80', 'pir_100', 'eps'];
const BEDEKKING = ['bitumen', 'epdm', 'pvc'];
const DAKRAND = ['daktrim_aluminium', 'boeideel'];

/**
 * Startset (ticket OFM-043). Vervangen = `dak_vervangen`, Nieuw = `nieuw_dak`, Reparatie = `reparatie`;
 * voor dakgoten, isolatie en onderhoud een plausibele koppeling (de dakdekker past dit aan).
 */
export const WERKZAAMHEDEN_STARTSET: readonly StartWerkzaamheid[] = [
  {
    sleutel: 'slopen',
    label: 'Slopen',
    eenheid: 'm²',
    soortenWerk: ['dak_vervangen'],
    opties: [{ sleutel: 'afvalcontainer', label: 'Afvalcontainer', eenheid: 'stuk' }],
    materialen: [],
    standaardMateriaal: null,
  },
  {
    sleutel: 'isoleren',
    label: 'Isoleren',
    eenheid: 'm²',
    soortenWerk: ['nieuw_dak', 'dak_vervangen', 'isolatie'],
    opties: [],
    materialen: ISOLATIE,
    standaardMateriaal: 'pir_80',
  },
  {
    sleutel: 'nieuwe_bedekking',
    label: 'Nieuwe bedekking',
    eenheid: 'm²',
    soortenWerk: ['nieuw_dak', 'dak_vervangen'],
    opties: [],
    materialen: BEDEKKING,
    standaardMateriaal: 'bitumen',
  },
  {
    sleutel: 'dakrand_afwerking',
    label: 'Dakrand en afwerking',
    eenheid: 'm¹',
    soortenWerk: ['nieuw_dak', 'dak_vervangen'],
    opties: [],
    materialen: DAKRAND,
    standaardMateriaal: 'daktrim_aluminium',
  },
  {
    sleutel: 'hemelwaterafvoer',
    label: 'Hemelwaterafvoer',
    eenheid: 'm¹',
    soortenWerk: ['nieuw_dak', 'dak_vervangen', 'dakgoten'],
    opties: [],
    materialen: [],
    standaardMateriaal: null,
  },
  {
    sleutel: 'lekkage_opsporen',
    label: 'Lekkage opsporen',
    eenheid: 'uur',
    soortenWerk: ['reparatie', 'onderhoud'],
    opties: [],
    materialen: [],
    standaardMateriaal: null,
  },
  {
    sleutel: 'plaatselijk_herstel',
    label: 'Plaatselijk herstel',
    eenheid: 'm²',
    soortenWerk: ['reparatie', 'onderhoud'],
    opties: [],
    materialen: ['bitumen', 'epdm'],
    standaardMateriaal: 'bitumen',
  },
  {
    sleutel: 'dakgoot_vervangen',
    label: 'Dakgoot vervangen',
    eenheid: 'm¹',
    soortenWerk: ['reparatie', 'dakgoten'],
    opties: [],
    materialen: [],
    standaardMateriaal: null,
  },
];

// ---------- Prijssleutels (één plek voor prijzen, V-13) ----------

export const werkPrijsSleutel = (werkzaamheid: string): string => `werk:${werkzaamheid}`;
export const optiePrijsSleutel = (werkzaamheid: string, optie: string): string =>
  `optie:${werkzaamheid}:${optie}`;
export const materiaalPrijsSleutel = (materiaal: string): string => `mat:${materiaal}`;

export type PrijsGroep = 'werk' | 'optie' | 'mat';

/** Groep van een prijspost-sleutel; `null` voor de gewone prijslijst (§9.3) en eigen posten. */
export function prijsGroep(sleutel: string | null): PrijsGroep | null {
  const voorvoegsel = sleutel?.split(':')[0];
  return voorvoegsel === 'werk' || voorvoegsel === 'optie' || voorvoegsel === 'mat' ? voorvoegsel : null;
}

// ---------- Gebruik in offertes ----------

export interface GebruikteWerkzaamheden {
  werkzaamheden: string[];
  opties: string[];
  materialen: string[];
}

/**
 * Sleutels van werkzaamheden, opties en materialen die deze offerte gebruikt: zo'n item kan niet
 * verwijderd worden, alleen verborgen. De wizardinvoer kent nog geen werkzaamheden (die komen in
 * OFM-044, dat deze functie invult); tot dan gebruikt geen enkele offerte er een.
 */
export function gebruikteWerkzaamheden(invoer: KlusInvoer): GebruikteWerkzaamheden {
  void invoer;
  return { werkzaamheden: [], opties: [], materialen: [] };
}
