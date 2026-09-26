import type { KlusInvoer } from './types';

// Instelbare keuzelijsten van de wizard (OFM-034, TDO §4.2 `keuzeopties`, §9.1). De startset hieronder
// is de enige bron van de standaardopties: `migreer()` voegt hem direct na migratie 002 in (zoals de
// prijslijst-startset, V-13). Sleutels zijn stabiel (kleine letters, cijfers en `_`); bij hernoemen
// verandert alleen het label. Puur (geen Node of DOM): main, renderer en de PDF gebruiken dit.

// OFM-045: de lijsten bedekking, isolatie, extra's en afwerking van de oude wizardstap Extra's zijn
// vervallen (migratie 005); werkzaamheden en materialen nemen hun plaats in (`werkzaamheden.ts`).
// OFM-050: `nieuweBedekking` (stap 3, onder soort werk) sinds migratie 009; na soort werk omdat de tab
// Keuzelijsten de lijsten in deze volgorde toont.
export const KEUZE_LIJSTEN = [
  'soortWerk',
  'nieuweBedekking',
  'soortDak',
  'huidigeBedekking',
  'ondergrond',
  'hoogte',
  'garantie',
] as const;

export type KeuzeLijst = (typeof KEUZE_LIJSTEN)[number];

/** Sleutel van een keuzeoptie: 1–40 tekens `a-z`, `0-9` en `_`. */
export const KEUZE_SLEUTEL_PATROON = /^[a-z0-9_]{1,40}$/;

export interface KeuzeBasis {
  sleutel: string;
  label: string;
  /** OFM-050: "Zin in de offerte" over de beginsituatie (alleen `ZIN_LIJSTEN`); leeg of ontbrekend = geen. */
  zin?: string;
  /** OFM-050: alleen bij soort werk: de wizard vraagt dan om een nieuwe dakbedekking. */
  vraagtBedekking?: boolean;
}

/** Opties per lijst in de ingestelde volgorde (ook verborgen opties): de bron voor alle labels. */
export type Keuzes = Record<KeuzeLijst, readonly KeuzeBasis[]>;

const o = (sleutel: string, label: string): KeuzeBasis => ({ sleutel, label });

/** Startset: de vaste opties en labels van vóór OFM-034 (§9.1), in deze volgorde. */
export const KEUZE_STARTSET: Keuzes = {
  soortWerk: [
    o('nieuw_dak', 'Nieuw dak'),
    o('dak_vervangen', 'Dak vervangen'),
    o('reparatie', 'Reparatie'),
    o('dakgoten', 'Dakgoten'),
    o('isolatie', 'Isolatie'),
    o('onderhoud', 'Onderhoud'),
  ],
  // OFM-050: dezelfde sleutels als de materialen van de werkzaamheid Nieuwe bedekking (§9.6), zodat dat
  // materiaal vanzelf wordt voorgeselecteerd.
  nieuweBedekking: [o('bitumen', 'Bitumen'), o('epdm', 'EPDM'), o('pvc', 'PVC')],
  // Kleine letter: het label staat ook in lopende tekst ("Offerte nieuw dak plat dak").
  soortDak: [o('plat', 'plat dak'), o('hellend', 'hellend dak')],
  huidigeBedekking: [
    o('bitumen', 'Bitumen'),
    o('epdm', 'EPDM'),
    o('grind_op_bitumen', 'Grind op bitumen'),
    o('onbekend', 'Weet ik niet'),
  ],
  ondergrond: [o('hout', 'Hout'), o('beton', 'Beton'), o('staal', 'Staal'), o('onbekend', 'Weet ik niet')],
  hoogte: [o('1', 'Begane grond / 1 bouwlaag'), o('2', '2 bouwlagen'), o('3plus', '3 of meer bouwlagen')],
  garantie: [o('10', '10 jaar'), o('20', '20 jaar verzekerde garantie')],
};

// ---------- Beginsituatie en nieuwe dakbedekking (OFM-050) ----------

/** De lijsten van stap 2 (het huidige dak) met een zin per optie, in de volgorde van de beginsituatie. */
export const ZIN_LIJSTEN = ['soortDak', 'huidigeBedekking', 'ondergrond', 'hoogte'] as const;
export type ZinLijst = (typeof ZIN_LIJSTEN)[number];

/**
 * Startzinnen: wat migratie 009 invult en **Herstel standaardlijst** terugzet. "Weet ik niet" heeft geen
 * zin: daar valt niets over te zeggen.
 */
export const ZIN_STARTSET: Record<ZinLijst, Readonly<Record<string, string>>> = {
  soortDak: {
    plat: 'Het betreft een plat dak.',
    hellend: 'Het betreft een hellend dak.',
  },
  huidigeBedekking: {
    bitumen: 'Het dak is nu bedekt met bitumen.',
    epdm: 'Het dak is nu bedekt met EPDM.',
    grind_op_bitumen: 'Het dak is nu bedekt met bitumen met een grindlaag.',
  },
  ondergrond: {
    hout: 'Het dak heeft een houten dakbeschot.',
    beton: 'Het dak heeft een betonnen ondergrond.',
    staal: 'Het dak heeft een ondergrond van staalplaat.',
  },
  hoogte: {
    '1': 'Het dak ligt op de begane grond of de eerste bouwlaag.',
    '2': 'Het dak ligt op de tweede bouwlaag.',
    '3plus': 'Het dak ligt op de derde bouwlaag of hoger.',
  },
};

export function isZinLijst(lijst: KeuzeLijst): lijst is ZinLijst {
  return (ZIN_LIJSTEN as readonly string[]).includes(lijst);
}

/** Startzin van een optie, of `''`. */
export function startZin(lijst: KeuzeLijst, sleutel: string): string {
  return isZinLijst(lijst) ? (ZIN_STARTSET[lijst][sleutel] ?? '') : '';
}

/** Soorten werk van de startset die om een nieuwe dakbedekking vragen. */
export const VRAAGT_BEDEKKING_STARTSET: readonly string[] = ['nieuw_dak', 'dak_vervangen'];

/** Vraagt deze soort werk om een nieuwe dakbedekking (vinkje per soort werk)? */
export function vraagtNieuweBedekking(
  keuzes: Partial<Pick<Keuzes, 'soortWerk'>>,
  soortWerk: string | null,
): boolean {
  if (soortWerk === null) return false;
  return keuzes.soortWerk?.find((k) => k.sleutel === soortWerk)?.vraagtBedekking === true;
}

/**
 * De beginsituatie: de ingevulde zinnen van de gekozen opties, in de volgorde soort dak, huidige
 * bedekking, ondergrond, hoogte. Een optie zonder zin of een lege keuze telt niet mee.
 */
export function beginsituatie(invoer: Pick<KlusInvoer, ZinLijst>, keuzes: Partial<Keuzes>): string[] {
  const zinnen: string[] = [];
  for (const lijst of ZIN_LIJSTEN) {
    const sleutel = invoer[lijst];
    if (sleutel === null) continue;
    const zin = keuzes[lijst]?.find((k) => k.sleutel === sleutel)?.zin?.trim() ?? '';
    if (zin !== '') zinnen.push(zin);
  }
  return zinnen;
}

/** Per lijst de sleutel van de standaardkeuze van een nieuwe offerte; ontbreekt = geen standaard. */
export type Standaardkeuzes = Partial<Record<KeuzeLijst, string>>;

/**
 * De standaardkeuzes van de startset (OFM-049): wat migratie 007 invult en wat **Herstel
 * standaardlijst** terugzet. Daarna stelt de gebruiker ze zelf in (kolom `keuzeopties.standaardkeuze`).
 */
export const STANDAARDKEUZE_STARTSET: Standaardkeuzes = {
  hoogte: '1',
  garantie: '10',
};

/**
 * De ingestelde standaardkeuzes uit de lijsten van `keuzelijsten:haal` (of de repository): per lijst de
 * sleutel van de optie met `standaardkeuze`. Die optie is niet te verbergen of te verwijderen, alleen te
 * hernoemen: anders zou een nieuwe offerte met een onzichtbare of onbekende keuze starten.
 */
export function standaardKeuzes(
  lijsten: Partial<Record<KeuzeLijst, readonly { sleutel: string; standaardkeuze: boolean }[]>>,
): Standaardkeuzes {
  const uit: Standaardkeuzes = {};
  for (const lijst of KEUZE_LIJSTEN) {
    const optie = lijsten[lijst]?.find((o) => o.standaardkeuze);
    if (optie) uit[lijst] = optie.sleutel;
  }
  return uit;
}

// ---------- Labels en sleutels ----------

/** Label van een optie; een onbekende (verwijderde) sleutel toont zichzelf, zodat niets verdwijnt. */
export function keuzeLabel(keuzes: Partial<Keuzes>, lijst: KeuzeLijst, sleutel: string): string {
  return keuzes[lijst]?.find((k) => k.sleutel === sleutel)?.label ?? sleutel;
}

/** Keuzes met alleen de velden van `KeuzeBasis` (bijv. uit de IPC-uitvoer met extra velden). */
export function alsKeuzes(lijsten: Record<KeuzeLijst, readonly KeuzeBasis[]>): Keuzes {
  return Object.fromEntries(
    KEUZE_LIJSTEN.map((lijst) => [
      lijst,
      lijsten[lijst].map(({ sleutel, label, zin, vraagtBedekking }) => ({
        sleutel,
        label,
        ...(zin !== undefined && { zin }),
        ...(vraagtBedekking !== undefined && { vraagtBedekking }),
      })),
    ]),
  ) as unknown as Keuzes;
}

/**
 * Nieuwe sleutel uit een label: kleine letters zonder accenten, andere tekens → `_`, maximaal 30
 * tekens; is hij bezet, dan `_2`, `_3`, ….
 */
export function maakSleutel(label: string, bezet: ReadonlySet<string>): string {
  const basis =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30)
      .replace(/_+$/, '') || 'keuze';
  if (!bezet.has(basis)) return basis;
  for (let n = 2; ; n++) {
    const kandidaat = `${basis}_${n}`;
    if (!bezet.has(kandidaat)) return kandidaat;
  }
}

/** Per lijst de sleutels die deze invoer gebruikt. */
export function gebruikteSleutels(invoer: KlusInvoer): Record<KeuzeLijst, string[]> {
  const een = (waarde: string | null): string[] => (waarde === null ? [] : [waarde]);
  return {
    soortWerk: een(invoer.soortWerk),
    // Invoer zonder zod (in gebruik-telling) van vóór migratie 009 mist het veld.
    nieuweBedekking: een(invoer.nieuweBedekking ?? null),
    soortDak: een(invoer.soortDak),
    huidigeBedekking: een(invoer.huidigeBedekking),
    ondergrond: een(invoer.ondergrond),
    hoogte: een(invoer.hoogte),
    garantie: een(invoer.garantieJaren),
  };
}
