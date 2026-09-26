import type {
  DaksysteemRegel,
  Eenheid,
  GekozenMateriaal,
  GekozenWerkzaamheid,
  KlusInvoer,
  Materiaal,
  Werkzaamheid,
  WerkzaamhedenSet,
} from './types';

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
/** OFM-048: de uurprijs van een werkzaamheid staat naast de prijs per eenheid. */
export const uurPrijsSleutel = (werkzaamheid: string): string => `werk:${werkzaamheid}:uur`;
export const optiePrijsSleutel = (werkzaamheid: string, optie: string): string =>
  `optie:${werkzaamheid}:${optie}`;
export const materiaalPrijsSleutel = (materiaal: string): string => `mat:${materiaal}`;

export type PrijsGroep = 'werk' | 'optie' | 'mat';

/**
 * Het item bij een prijspost-sleutel: `werk:slopen:uur` → `slopen`, `optie:slopen:afvalcontainer` →
 * `afvalcontainer`, `mat:pir_80` → `pir_80`.
 */
export function itemSleutel(sleutel: string): string {
  const delen = sleutel.split(':');
  return (delen[0] === 'werk' ? delen[1] : delen.at(-1)) ?? '';
}

/** Groep van een prijspost-sleutel; `null` voor de vaste posten (§9.3) en eigen posten. */
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
 * Sleutels van werkzaamheden, opties en materialen die deze offerte gebruikt (OFM-044): zo'n item kan
 * niet verwijderd worden, alleen verborgen. Eenmalige items tellen niet (die staan niet in de
 * instellingen). Werkt ook op invoer zonder zod (oude offertes zonder `werkzaamheden`).
 */
export function gebruikteWerkzaamheden(
  invoer: Partial<Pick<KlusInvoer, 'werkzaamheden'>>,
): GebruikteWerkzaamheden {
  const uit: GebruikteWerkzaamheden = { werkzaamheden: [], opties: [], materialen: [] };
  for (const w of invoer.werkzaamheden ?? []) {
    if (w.sleutel !== null) uit.werkzaamheden.push(w.sleutel);
    for (const o of w.opties) uit.opties.push(o.sleutel);
    for (const m of w.materialen) if (m.sleutel !== null) uit.materialen.push(m.sleutel);
  }
  return uit;
}

// ---------- Werkzaamheden in een offerte (OFM-044) ----------

/** Wat de wizard, Maak zonder Claude en de agentopdracht uit de instellingen nodig hebben. */
export type WerkCatalogus = Pick<WerkzaamhedenSet, 'werkzaamheden' | 'materialen'>;

export interface ItemInfo {
  label: string;
  eenheid: Eenheid;
}

/** Naam van een eenmalig item zonder naam (half ingevuld). */
export const NAAMLOOS = { werkzaamheid: 'Werkzaamheid', materiaal: 'Materiaal' } as const;

/**
 * Naam en eenheid; een verwijderde sleutel toont zichzelf (per post), zodat er niets wegvalt. Per uur
 * (OFM-048) is de eenheid altijd `uur`.
 */
export function werkInfo(
  catalogus: WerkCatalogus,
  w: Pick<GekozenWerkzaamheid, 'sleutel' | 'eenmalig'> & { perUur?: boolean },
): ItemInfo {
  const info = ((): ItemInfo => {
    if (w.eenmalig) {
      return { label: w.eenmalig.label.trim() || NAAMLOOS.werkzaamheid, eenheid: w.eenmalig.eenheid };
    }
    const item = catalogus.werkzaamheden.find((x) => x.sleutel === w.sleutel);
    return item ? { label: item.label, eenheid: item.eenheid } : { label: w.sleutel ?? '', eenheid: 'post' };
  })();
  return w.perUur ? { ...info, eenheid: 'uur' } : info;
}

/** Standaardprijs van een werkzaamheid uit de instellingen (OFM-048): de uurprijs bij per uur. */
export function standaardPrijs(
  werk: Pick<Werkzaamheid, 'prijsCent' | 'uurprijsCent'>,
  perUur: boolean,
): number | null {
  return perUur ? werk.uurprijsCent : werk.prijsCent;
}

/**
 * Wissel tussen prijs per eenheid en per uur (OFM-048): de prijs wordt de standaardprijs van de nieuwe
 * keuze, het aantal 1 (uur) resp. het standaardaantal. Zonder item (eenmalig of verwijderd) blijft de
 * prijs staan.
 */
export function wisselPerUur(
  gekozen: Pick<GekozenWerkzaamheid, 'prijsCent'>,
  werk: Pick<Werkzaamheid, 'eenheid' | 'prijsCent' | 'uurprijsCent'> | undefined,
  perUur: boolean,
  totaalM2: number,
): Pick<GekozenWerkzaamheid, 'perUur' | 'aantal' | 'prijsCent'> {
  return {
    perUur,
    aantal: perUur ? 1 : standaardAantal(werk?.eenheid ?? 'post', totaalM2),
    prijsCent: werk ? standaardPrijs(werk, perUur) : gekozen.prijsCent,
  };
}

export function materiaalInfo(
  catalogus: WerkCatalogus,
  m: Pick<GekozenMateriaal, 'sleutel' | 'eenmalig'>,
): ItemInfo {
  if (m.eenmalig) {
    return { label: m.eenmalig.label.trim() || NAAMLOOS.materiaal, eenheid: m.eenmalig.eenheid };
  }
  const item = catalogus.materialen.find((x) => x.sleutel === m.sleutel);
  return item ? { label: item.label, eenheid: item.eenheid } : { label: m.sleutel ?? '', eenheid: 'post' };
}

export function optieInfo(catalogus: WerkCatalogus, werkSleutel: string | null, optie: string): ItemInfo {
  const item = catalogus.werkzaamheden
    .find((x) => x.sleutel === werkSleutel)
    ?.opties.find((o) => o.sleutel === optie);
  return item ? { label: item.label, eenheid: item.eenheid } : { label: optie, eenheid: 'stuk' };
}

/** Standaardaantal (ticket OFM-044): de totale m² van het dak bij eenheid m², anders 1. */
export function standaardAantal(eenheid: Eenheid, totaalM2: number): number {
  return eenheid === 'm²' ? totaalM2 : 1;
}

const nieuwId = () => crypto.randomUUID();

/** Een materiaal uit de instellingen: hetzelfde aantal als de werkzaamheid bij dezelfde eenheid, anders 1. */
export function kiesMateriaal(
  materiaal: Materiaal,
  werkEenheid: Eenheid,
  werkAantal: number,
  maakId: () => string = nieuwId,
): GekozenMateriaal {
  return {
    id: maakId(),
    sleutel: materiaal.sleutel,
    eenmalig: null,
    aantal: materiaal.eenheid === werkEenheid ? werkAantal : 1,
    prijsCent: materiaal.prijsCent,
  };
}

/** OFM-051: het daksysteem van een offerte (ondergrond uit stap 2, nieuwe dakbedekking uit stap 3). */
export type Daksysteem = Pick<KlusInvoer, 'ondergrond' | 'nieuweBedekking'>;

const GEEN_DAKSYSTEEM: Daksysteem = { ondergrond: null, nieuweBedekking: null };

/**
 * Een werkzaamheid uit de instellingen zoals hij in de offerte komt: standaardaantal, prijs uit de
 * prijslijst en een voorgeselecteerd materiaal: de gekozen nieuwe dakbedekking als die bij deze
 * werkzaamheid kiesbaar is (OFM-050), anders het standaardmateriaal bij dit daksysteem
 * (`standaardMateriaalVoor`, OFM-051).
 */
export function kiesWerkzaamheid(
  werk: Werkzaamheid,
  catalogus: WerkCatalogus,
  totaalM2: number,
  daksysteem: Daksysteem = GEEN_DAKSYSTEEM,
  regels: readonly DaksysteemRegel[] = [],
  maakId: () => string = nieuwId,
): GekozenWerkzaamheid {
  const aantal = standaardAantal(werk.eenheid, totaalM2);
  const standaard = standaardMateriaalVoor(werk, daksysteem, regels);
  const materiaal =
    bedekkingMateriaal(werk, catalogus, daksysteem.nieuweBedekking) ??
    catalogus.materialen.find((m) => m.id === standaard);
  return {
    id: maakId(),
    sleutel: werk.sleutel,
    eenmalig: null,
    aantal,
    prijsCent: werk.prijsCent,
    perUur: false,
    notitie: '',
    materialen: materiaal ? [kiesMateriaal(materiaal, werk.eenheid, aantal, maakId)] : [],
    opties: [],
  };
}

// ---------- Standaardmaterialen per daksysteem (OFM-051) ----------

/**
 * Waar het standaardmateriaal vandaan komt: een regel voor precies deze combinatie, een algemenere regel
 * (alle ondergronden of alle bedekkingen), of het gewone standaardmateriaal van de werkzaamheid.
 */
export type DaksysteemBron = 'combinatie' | 'geerfd' | 'gewoon';

export interface DaksysteemStandaard {
  /** Materiaal-id, of `null` (geen standaard). */
  materiaalId: string | null;
  bron: DaksysteemBron;
  /** De regel die de waarde levert (`null` bij het gewone standaardmateriaal). */
  regel: DaksysteemRegel | null;
}

/**
 * Het standaardmateriaal van een werkzaamheid bij een ondergrond en bedekking (`null` = alle), met de bron.
 * Terugvalvolgorde (besluit eigenaar): precies (ondergrond, bedekking) → (alle, bedekking) → (ondergrond,
 * alle) → het gewone standaardmateriaal. Een regel met een materiaal dat niet (meer) kiesbaar is telt niet.
 */
export function daksysteemStandaard(
  werk: Pick<Werkzaamheid, 'id' | 'materialen'>,
  ondergrond: string | null,
  bedekking: string | null,
  regels: readonly DaksysteemRegel[],
): DaksysteemStandaard {
  const kandidaten: [string | null, string | null][] = [
    [ondergrond, bedekking],
    [null, bedekking],
    [ondergrond, null],
  ];
  for (const [index, [o, b]] of kandidaten.entries()) {
    if (o === null && b === null) continue;
    const regel = regels.find(
      (r) =>
        r.werkzaamheidId === werk.id &&
        r.ondergrond === o &&
        r.bedekking === b &&
        werk.materialen.some((m) => m.materiaalId === r.materiaalId),
    );
    if (regel) return { materiaalId: regel.materiaalId, bron: index === 0 ? 'combinatie' : 'geerfd', regel };
  }
  return {
    materiaalId: werk.materialen.find((m) => m.standaard)?.materiaalId ?? null,
    bron: 'gewoon',
    regel: null,
  };
}

/**
 * Het standaardmateriaal (id) van een werkzaamheid bij het daksysteem van de offerte (OFM-051). Een
 * ondergrond of nieuwe bedekking `null` telt als "alle".
 */
export function standaardMateriaalVoor(
  werk: Pick<Werkzaamheid, 'id' | 'materialen'>,
  invoer: Daksysteem,
  regels: readonly DaksysteemRegel[],
): string | null {
  return daksysteemStandaard(werk, invoer.ondergrond, invoer.nieuweBedekking, regels).materiaalId;
}

/**
 * De regels die na een wijziging in de instellingen nog kloppen: de werkzaamheid bestaat en het materiaal
 * is er nog kiesbaar. `vervallen` telt alleen regels van een werkzaamheid die nog bestaat (verwijderen van
 * de werkzaamheid zelf hoeft geen melding).
 */
export function geldigeDaksystemen(
  regels: readonly DaksysteemRegel[],
  werkzaamheden: readonly Pick<Werkzaamheid, 'id' | 'materialen'>[],
): { regels: DaksysteemRegel[]; vervallen: number } {
  let vervallen = 0;
  const geldig = regels.filter((r) => {
    const werk = werkzaamheden.find((w) => w.id === r.werkzaamheidId);
    if (!werk) return false;
    if (werk.materialen.some((m) => m.materiaalId === r.materiaalId)) return true;
    vervallen += 1;
    return false;
  });
  return { regels: geldig, vervallen };
}

/** Wat de wizard nodig heeft om het standaardmateriaal per daksysteem te bepalen. */
export type DaksysteemCatalogus = Pick<WerkzaamhedenSet, 'werkzaamheden' | 'materialen' | 'daksystemen'>;

export interface DaksysteemHint {
  /** Het standaardmateriaal bij het huidige daksysteem. */
  materiaal: Materiaal;
  /** Id (in de offerte) van het gekozen materiaal dat het vervangt. */
  vervangt: string;
}

/**
 * Hint in stap 3 na het wijzigen van ondergrond of nieuwe bedekking (OFM-051): de gekozen materialen
 * blijven staan, maar is het standaardmateriaal bij het huidige daksysteem niet gekozen terwijl er wel
 * een ander "standaard"-materiaal van deze werkzaamheid gekozen is (het gewone standaardmateriaal of een
 * materiaal uit een regel), dan stelt de wizard voor dat te vervangen. Geen hint bij een eenmalige of
 * verwijderde werkzaamheid, bij een werkzaamheid waar de nieuwe dakbedekking al voor zorgt
 * (`pasBedekkingToe`) of bij een eigen materiaalkeuze.
 */
export function daksysteemHint(
  gekozen: GekozenWerkzaamheid,
  set: DaksysteemCatalogus,
  daksysteem: Daksysteem,
): DaksysteemHint | null {
  const werk = set.werkzaamheden.find((w) => w.sleutel === gekozen.sleutel);
  if (!werk || bedekkingMateriaal(werk, set, daksysteem.nieuweBedekking)) return null;
  const nu = standaardMateriaalVoor(werk, daksysteem, set.daksystemen);
  const materiaal = set.materialen.find((m) => m.id === nu);
  if (!materiaal || gekozen.materialen.some((m) => m.sleutel === materiaal.sleutel)) return null;
  const standaarden = new Set([
    ...werk.materialen.filter((m) => m.standaard).map((m) => m.materiaalId),
    ...set.daksystemen.filter((r) => r.werkzaamheidId === werk.id).map((r) => r.materiaalId),
  ]);
  const idVan = (sleutel: string | null) => set.materialen.find((m) => m.sleutel === sleutel)?.id ?? '';
  const oud = gekozen.materialen.find((m) => standaarden.has(idVan(m.sleutel)));
  return oud ? { materiaal, vervangt: oud.id } : null;
}

/** **Gebruik** bij de hint: het voorgestelde materiaal op de plek en met het aantal van het oude. */
export function gebruikDaksysteem(
  gekozen: GekozenWerkzaamheid,
  catalogus: WerkCatalogus,
  hint: DaksysteemHint,
  maakId: () => string = nieuwId,
): GekozenWerkzaamheid {
  const nieuw = kiesMateriaal(hint.materiaal, werkInfo(catalogus, gekozen).eenheid, gekozen.aantal, maakId);
  return {
    ...gekozen,
    materialen: gekozen.materialen.map((m) => (m.id === hint.vervangt ? { ...nieuw, aantal: m.aantal } : m)),
  };
}

// ---------- Nieuwe dakbedekking (OFM-050) ----------

/**
 * Het kiesbare materiaal van deze werkzaamheid met dezelfde sleutel als de nieuwe dakbedekking, of
 * `undefined` (geen bedekking gekozen, of de werkzaamheid heeft dat materiaal niet).
 */
export function bedekkingMateriaal(
  werk: Pick<Werkzaamheid, 'materialen'>,
  catalogus: WerkCatalogus,
  nieuweBedekking: string | null,
): Materiaal | undefined {
  if (nieuweBedekking === null) return undefined;
  const materiaal = catalogus.materialen.find((m) => m.sleutel === nieuweBedekking);
  return materiaal && werk.materialen.some((x) => x.materiaalId === materiaal.id) ? materiaal : undefined;
}

/**
 * Na het kiezen van een nieuwe dakbedekking: bij elke gekozen werkzaamheid uit de instellingen die dat
 * materiaal kiesbaar heeft, komt het erin in plaats van een ander bedekkingsmateriaal (een materiaal
 * met de sleutel van een optie uit `bedekkingen`, de lijst `nieuweBedekking`). Andere materialen, eenmalige
 * items en werkzaamheden zonder dat materiaal blijven zoals ze zijn; handmatig wisselen kan daarna weer.
 */
export function pasBedekkingToe(
  werkzaamheden: readonly GekozenWerkzaamheid[],
  set: WerkzaamhedenSet,
  bedekkingen: ReadonlySet<string>,
  nieuweBedekking: string | null,
  maakId: () => string = nieuwId,
): GekozenWerkzaamheid[] {
  return werkzaamheden.map((w) => {
    const item = set.werkzaamheden.find((x) => x.sleutel === w.sleutel);
    const materiaal = item && bedekkingMateriaal(item, set, nieuweBedekking);
    if (!item || !materiaal) return w;
    if (w.materialen.some((m) => m.sleutel === materiaal.sleutel)) return w;
    const nieuw = kiesMateriaal(materiaal, werkInfo(set, w).eenheid, w.aantal, maakId);
    const isBedekking = (m: GekozenMateriaal) => m.sleutel !== null && bedekkingen.has(m.sleutel);
    const plek = w.materialen.findIndex(isBedekking);
    // Het nieuwe materiaal neemt de plek en het aantal van het eerste oude bedekkingsmateriaal over.
    const materialen =
      plek === -1
        ? [...w.materialen, nieuw]
        : w.materialen.flatMap((m, i) =>
            i === plek ? [{ ...nieuw, aantal: m.aantal }] : isBedekking(m) ? [] : [m],
          );
    return { ...w, materialen };
  });
}

/** Eén regel die uit een werkzaamheid volgt (voor Maak zonder Claude en de agentopdracht). */
export interface WerkRegel {
  omschrijving: string;
  eenheid: Eenheid;
  aantal: number;
  /** Prijs voor deze offerte; `null` = geen prijs. */
  prijsCent: number | null;
  /** Prijspost-sleutel (`werk:`, `mat:`, `optie:`), of `null` bij een eenmalig item. */
  prijsSleutel: string | null;
}

export interface WerkGroep {
  werk: WerkRegel;
  notitie: string;
  /** Materialen en dan opties (een optie telt één keer). */
  subregels: WerkRegel[];
}

/** Per gekozen werkzaamheid de regel en de subregels, in de volgorde van de offerte. */
export function werkGroepen(
  werkzaamheden: readonly GekozenWerkzaamheid[],
  catalogus: WerkCatalogus,
): WerkGroep[] {
  return werkzaamheden.map((w) => {
    const info = werkInfo(catalogus, w);
    const materialen = w.materialen.map((m): WerkRegel => {
      const mi = materiaalInfo(catalogus, m);
      return {
        omschrijving: mi.label,
        eenheid: mi.eenheid,
        aantal: m.aantal,
        prijsCent: m.prijsCent,
        prijsSleutel: m.sleutel === null ? null : materiaalPrijsSleutel(m.sleutel),
      };
    });
    const opties = w.opties.map((o): WerkRegel => {
      const oi = optieInfo(catalogus, w.sleutel, o.sleutel);
      return {
        omschrijving: oi.label,
        eenheid: oi.eenheid,
        aantal: 1,
        prijsCent: o.prijsCent,
        prijsSleutel: w.sleutel === null ? null : optiePrijsSleutel(w.sleutel, o.sleutel),
      };
    });
    return {
      werk: {
        omschrijving: info.label,
        eenheid: info.eenheid,
        aantal: w.aantal,
        prijsCent: w.prijsCent,
        prijsSleutel:
          w.sleutel === null ? null : w.perUur ? uurPrijsSleutel(w.sleutel) : werkPrijsSleutel(w.sleutel),
      },
      notitie: w.notitie.trim(),
      subregels: [...materialen, ...opties],
    };
  });
}
