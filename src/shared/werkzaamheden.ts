import type {
  Eenheid,
  GekozenMateriaal,
  GekozenWerkzaamheid,
  KlusInvoer,
  Materiaal,
  MateriaalTags,
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
  /**
   * OFM-055: starttags per groep (sleutels uit de keuzelijst); een groep die ontbreekt is `'alle'`. Een
   * sleutel die niet (meer) in de keuzelijst staat, telt niet.
   */
  tags?: { ondergrond?: readonly string[]; bedekking?: readonly string[] };
}

export const MATERIALEN_STARTSET: readonly StartMateriaal[] = [
  { sleutel: 'pir_60', label: 'PIR 60 mm', eenheid: 'm²' },
  { sleutel: 'pir_80', label: 'PIR 80 mm', eenheid: 'm²' },
  { sleutel: 'pir_100', label: 'PIR 100 mm', eenheid: 'm²' },
  { sleutel: 'eps', label: 'EPS', eenheid: 'm²' },
  { sleutel: 'bitumen', label: 'Bitumen', eenheid: 'm²', tags: { bedekking: ['bitumen'] } },
  { sleutel: 'epdm', label: 'EPDM', eenheid: 'm²', tags: { bedekking: ['epdm'] } },
  { sleutel: 'pvc', label: 'PVC', eenheid: 'm²', tags: { bedekking: ['pvc'] } },
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

// ---------- Tags en daksituaties (OFM-055) ----------

/**
 * De daksituatie van een offerte: ondergrond uit stap 2 en nieuwe dakbedekking uit stap 3. Vervangt het
 * "daksysteem" van OFM-051.
 */
export type Daksituatie = Pick<KlusInvoer, 'ondergrond' | 'nieuweBedekking'>;

const GEEN_SITUATIE: Daksituatie = { ondergrond: null, nieuweBedekking: null };

/** De optie "Weet ik niet" van de keuzelijst ondergrond: geen tag en geen situatie. */
export const ONDERGROND_ONBEKEND = 'onbekend';

/** De twee tag-groepen en de keuzelijst waar hun sleutels uit komen. */
export type TagGroep = keyof MateriaalTags;
export const TAG_LIJST = { ondergrond: 'ondergrond', bedekking: 'nieuweBedekking' } as const;

/** Tags van een nieuw materiaal: overal te gebruiken. */
export const ALLE_TAGS: MateriaalTags = { ondergrond: 'alle', bedekking: 'alle' };

/** Past een materiaal met deze tags bij een sleutel van die groep? `null` (niets gekozen) = alles past. */
export function heeftTag(tags: MateriaalTags, groep: TagGroep, sleutel: string | null): boolean {
  const waarde = tags[groep];
  return sleutel === null || waarde === 'alle' || waarde.includes(sleutel);
}

/**
 * Past het materiaal bij de daksituatie van de offerte? Een kant zonder keuze (of met ondergrond "Weet ik
 * niet") telt als "alle".
 */
export function pastBijSituatie(materiaal: Pick<Materiaal, 'tags'>, situatie: Daksituatie): boolean {
  const ondergrond = situatie.ondergrond === ONDERGROND_ONBEKEND ? null : situatie.ondergrond;
  return (
    heeftTag(materiaal.tags, 'ondergrond', ondergrond) &&
    heeftTag(materiaal.tags, 'bedekking', situatie.nieuweBedekking)
  );
}

/**
 * Een tag aan- of uitzetten. `alle` = alle sleutels van de keuzelijst (zonder "Weet ik niet", ook de
 * verborgen). Staan daarna alle sleutels aan, dan wordt het weer `'alle'` (een later toegevoegde optie
 * staat dan vanzelf aan); de laatste tag van een groep uitzetten kan niet (dan blijft het zoals het was).
 */
export function zetTag(
  tags: MateriaalTags,
  groep: TagGroep,
  sleutel: string,
  aan: boolean,
  alle: readonly string[],
): MateriaalTags {
  const nu = tags[groep] === 'alle' ? alle : tags[groep];
  const set = new Set(nu);
  if (aan) set.add(sleutel);
  else set.delete(sleutel);
  if (set.size === 0) return tags;
  const volgorde = [...alle, ...[...set].filter((s) => !alle.includes(s))];
  const nieuw = volgorde.filter((s) => set.has(s));
  return { ...tags, [groep]: alle.every((s) => set.has(s)) ? 'alle' : nieuw };
}

/** Een situatie waarvoor de wizard materialen voorselecteert: ondergrond (geen "Weet ik niet") × bedekking. */
export interface SituatieSleutel {
  ondergrond: string;
  bedekking: string;
}

/** Zelfde situatie? */
export const zelfdeSituatie = (a: SituatieSleutel, b: SituatieSleutel): boolean =>
  a.ondergrond === b.ondergrond && a.bedekking === b.bedekking;

/**
 * De situatieknoppen in de tab: elke niet-verborgen ondergrond (zonder "Weet ik niet") × elke niet-verborgen
 * nieuwe dakbedekking, in lijstvolgorde (ondergrond eerst).
 */
export function situatieCombinaties(
  ondergronden: readonly { sleutel: string; verborgen: boolean }[],
  bedekkingen: readonly { sleutel: string; verborgen: boolean }[],
): SituatieSleutel[] {
  const zichtbaar = <T extends { verborgen: boolean }>(lijst: readonly T[]) =>
    lijst.filter((o) => !o.verborgen);
  return zichtbaar(ondergronden)
    .filter((o) => o.sleutel !== ONDERGROND_ONBEKEND)
    .flatMap((o) => zichtbaar(bedekkingen).map((b) => ({ ondergrond: o.sleutel, bedekking: b.sleutel })));
}

/** De situatie van een offerte, of `null` als die niet vaststaat (geen ondergrond, "Weet ik niet", geen bedekking). */
export function situatieVan(invoer: Daksituatie): SituatieSleutel | null {
  const { ondergrond, nieuweBedekking } = invoer;
  if (ondergrond === null || ondergrond === ONDERGROND_ONBEKEND || nieuweBedekking === null) return null;
  return { ondergrond, bedekking: nieuweBedekking };
}

const isKiesbaar = (werk: Pick<Werkzaamheid, 'materialen'>, materiaalId: string) =>
  werk.materialen.some((m) => m.materiaalId === materiaalId);

/**
 * De standaardmaterialen van een werkzaamheid met "Materiaal per daksituatie" bij de situatie van de
 * offerte, in de volgorde van de materialenlijst: alleen materialen die (nog) kiesbaar zijn en met hun
 * tags bij de situatie passen. Leeg zonder vinkje of zonder vaststaande situatie.
 */
export function situatieMaterialen(
  werk: Pick<Werkzaamheid, 'materialen' | 'perSituatie' | 'situaties'>,
  catalogus: WerkCatalogus,
  invoer: Daksituatie,
): Materiaal[] {
  const situatie = situatieVan(invoer);
  if (!werk.perSituatie || situatie === null) return [];
  const ids = new Set(werk.situaties.find((s) => zelfdeSituatie(s, situatie))?.materiaalIds);
  return catalogus.materialen.filter(
    (m) => ids.has(m.id) && isKiesbaar(werk, m.id) && pastBijSituatie(m, invoer),
  );
}

/**
 * Wat de wizard bij het aanvinken van een werkzaamheid voorselecteert: met "Materiaal per daksituatie" de
 * materialen van de situatie, anders het ene standaardmateriaal (zoals vóór OFM-055).
 */
export function standaardMaterialen(
  werk: Pick<Werkzaamheid, 'materialen' | 'perSituatie' | 'situaties'>,
  catalogus: WerkCatalogus,
  invoer: Daksituatie,
): Materiaal[] {
  if (werk.perSituatie) return situatieMaterialen(werk, catalogus, invoer);
  const standaard = werk.materialen.find((m) => m.standaard)?.materiaalId;
  return catalogus.materialen.filter((m) => m.id === standaard);
}

/**
 * Een werkzaamheid uit de instellingen zoals hij in de offerte komt: standaardaantal, prijs uit de
 * prijslijst en de voorgeselecteerde materialen (`standaardMaterialen`, OFM-055), elk met het
 * standaardaantal.
 */
export function kiesWerkzaamheid(
  werk: Werkzaamheid,
  catalogus: WerkCatalogus,
  totaalM2: number,
  situatie: Daksituatie = GEEN_SITUATIE,
  maakId: () => string = nieuwId,
): GekozenWerkzaamheid {
  const aantal = standaardAantal(werk.eenheid, totaalM2);
  return {
    id: maakId(),
    sleutel: werk.sleutel,
    eenmalig: null,
    aantal,
    prijsCent: werk.prijsCent,
    perUur: false,
    notitie: '',
    materialen: standaardMaterialen(werk, catalogus, situatie).map((m) =>
      kiesMateriaal(m, werk.eenheid, aantal, maakId),
    ),
    opties: [],
  };
}

/**
 * De materialen die de wizard bij een gekozen werkzaamheid als vinkje toont: kiesbaar bij de
 * werkzaamheid, niet verborgen en passend bij de situatie van de offerte, plus wat al gekozen is.
 */
export function kiesbareMaterialen(
  werk: Pick<Werkzaamheid, 'materialen'> | undefined,
  catalogus: WerkCatalogus,
  invoer: Daksituatie,
  gekozen: ReadonlySet<string>,
): Materiaal[] {
  return catalogus.materialen.filter(
    (m) =>
      gekozen.has(m.sleutel) ||
      (!m.verborgen && werk !== undefined && isKiesbaar(werk, m.id) && pastBijSituatie(m, invoer)),
  );
}

export interface SituatieHint {
  /** De standaardmaterialen bij de huidige situatie. */
  materialen: Materiaal[];
}

/**
 * Hint in stap 3 (OFM-051, sinds OFM-055 met de hele set): bij een werkzaamheid met "Materiaal per
 * daksituatie" staat er nog een standaardmateriaal van een andere situatie in (bijvoorbeeld na een andere
 * ondergrond), of staat er nog helemaal geen materiaal terwijl de situatie er wel heeft (bijvoorbeeld omdat
 * de nieuwe dakbedekking pas na de werkzaamheid gekozen is). Geen hint bij een eigen keuze (alleen
 * niet-standaard materialen), als een deel van de set bewust is uitgevinkt, of als de situatie niet
 * vaststaat of geen materialen heeft.
 */
export function situatieHint(
  gekozen: GekozenWerkzaamheid,
  catalogus: WerkCatalogus,
  invoer: Daksituatie,
): SituatieHint | null {
  const werk = catalogus.werkzaamheden.find((w) => w.sleutel === gekozen.sleutel);
  if (!werk) return null;
  const set = situatieMaterialen(werk, catalogus, invoer);
  if (set.length === 0) return null;
  const inSet = new Set(set.map((m) => m.sleutel));
  const standaarden = standaardSleutels(werk, catalogus);
  const vreemd = gekozen.materialen.some(
    (m) => m.sleutel !== null && standaarden.has(m.sleutel) && !inSet.has(m.sleutel),
  );
  return vreemd || gekozen.materialen.length === 0 ? { materialen: set } : null;
}

/** Sleutels van alle (kiesbare) standaardmaterialen van een werkzaamheid over alle situaties. */
function standaardSleutels(
  werk: Pick<Werkzaamheid, 'materialen' | 'situaties'>,
  catalogus: WerkCatalogus,
): Set<string> {
  const ids = new Set(werk.situaties.flatMap((s) => s.materiaalIds));
  return new Set(
    catalogus.materialen.filter((m) => ids.has(m.id) && isKiesbaar(werk, m.id)).map((m) => m.sleutel),
  );
}

/**
 * **Gebruik** bij de hint: de standaardmaterialen van andere situaties gaan eruit, die van deze situatie
 * komen erbij (met het standaardaantal) op de plek van het eerste weggehaalde materiaal. Al gekozen
 * materialen uit de set en handmatig toegevoegde (ook eenmalige) blijven staan zoals ze zijn.
 */
export function gebruikSituatie(
  gekozen: GekozenWerkzaamheid,
  catalogus: WerkCatalogus,
  hint: SituatieHint,
  maakId: () => string = nieuwId,
): GekozenWerkzaamheid {
  const werk = catalogus.werkzaamheden.find((w) => w.sleutel === gekozen.sleutel);
  const standaarden = werk ? standaardSleutels(werk, catalogus) : new Set<string>();
  const inSet = new Set(hint.materialen.map((m) => m.sleutel));
  const weg = (m: GekozenMateriaal) =>
    m.sleutel !== null && standaarden.has(m.sleutel) && !inSet.has(m.sleutel);
  const aanwezig = new Set(gekozen.materialen.map((m) => m.sleutel));
  const eenheid = werkInfo(catalogus, gekozen).eenheid;
  const nieuw = hint.materialen
    .filter((m) => !aanwezig.has(m.sleutel))
    .map((m) => kiesMateriaal(m, eenheid, gekozen.aantal, maakId));
  const plek = gekozen.materialen.findIndex(weg);
  const blijft = gekozen.materialen.filter((m) => !weg(m));
  const invoegen =
    plek === -1 ? blijft.length : gekozen.materialen.slice(0, plek).filter((m) => !weg(m)).length;
  return { ...gekozen, materialen: [...blijft.slice(0, invoegen), ...nieuw, ...blijft.slice(invoegen)] };
}

/**
 * De situaties die na een wijziging in de instellingen nog kloppen (OFM-055): alleen materialen die bij de
 * werkzaamheid kiesbaar zijn en met hun tags bij de situatie passen; een situatie zonder materialen
 * verdwijnt. `vervallen` telt de weggevallen materialen (voor de melding in de tab).
 */
export function geldigeSituaties<W extends Pick<Werkzaamheid, 'materialen' | 'situaties'>>(
  werkzaamheden: readonly W[],
  materialen: readonly Pick<Materiaal, 'id' | 'tags'>[],
): { werkzaamheden: W[]; vervallen: number } {
  let vervallen = 0;
  const uit = werkzaamheden.map((w) => {
    const situaties = w.situaties.flatMap((s) => {
      const invoer = { ondergrond: s.ondergrond, nieuweBedekking: s.bedekking };
      const ids = s.materiaalIds.filter((id) => {
        const m = materialen.find((x) => x.id === id);
        return m !== undefined && isKiesbaar(w, id) && pastBijSituatie(m, invoer);
      });
      vervallen += s.materiaalIds.length - ids.length;
      return ids.length > 0 ? [{ ...s, materiaalIds: ids }] : [];
    });
    return { ...w, situaties };
  });
  return { werkzaamheden: uit, vervallen };
}

/** "A", "A en B", "A, B en C" (voor de hint). */
export function opsomming(labels: readonly string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} en ${labels.at(-1)}`;
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
