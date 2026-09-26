import type { KlusInvoer } from './types';

// Instelbare keuzelijsten van de wizard (OFM-034, TDO §4.2 `keuzeopties`, §9.1). De startset hieronder
// is de enige bron van de standaardopties: `migreer()` voegt hem direct na migratie 002 in (zoals de
// prijslijst-startset, V-13). Sleutels zijn stabiel (kleine letters, cijfers en `_`); bij hernoemen
// verandert alleen het label. Puur (geen Node of DOM): main, renderer en de PDF gebruiken dit.

// OFM-045: de lijsten bedekking, isolatie, extra's en afwerking van de oude wizardstap Extra's zijn
// vervallen (migratie 005); werkzaamheden en materialen nemen hun plaats in (`werkzaamheden.ts`).
export const KEUZE_LIJSTEN = [
  'soortWerk',
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

/**
 * De standaardkeuze van een nieuwe offerte (§5, lege KlusInvoer). Die optie kan niet verborgen of
 * verwijderd worden, alleen hernoemd: anders zou elke nieuwe offerte met een onzichtbare keuze starten.
 */
export const VASTE_KEUZES: Partial<Record<KeuzeLijst, string>> = {
  hoogte: '1',
  garantie: '10',
};

export function isVasteKeuze(lijst: KeuzeLijst, sleutel: string): boolean {
  return VASTE_KEUZES[lijst] === sleutel;
}

// ---------- Labels en sleutels ----------

/** Label van een optie; een onbekende (verwijderde) sleutel toont zichzelf, zodat niets verdwijnt. */
export function keuzeLabel(keuzes: Partial<Keuzes>, lijst: KeuzeLijst, sleutel: string): string {
  return keuzes[lijst]?.find((k) => k.sleutel === sleutel)?.label ?? sleutel;
}

/** Keuzes met alleen sleutel en label (bijv. uit de IPC-uitvoer met extra velden). */
export function alsKeuzes(lijsten: Record<KeuzeLijst, readonly KeuzeBasis[]>): Keuzes {
  return Object.fromEntries(
    KEUZE_LIJSTEN.map((lijst) => [lijst, lijsten[lijst].map(({ sleutel, label }) => ({ sleutel, label }))]),
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
    soortDak: een(invoer.soortDak),
    huidigeBedekking: een(invoer.huidigeBedekking),
    ondergrond: een(invoer.ondergrond),
    hoogte: [invoer.hoogte],
    garantie: [invoer.garantieJaren],
  };
}
