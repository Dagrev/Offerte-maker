import type { Eenheid, KlusInvoer } from './types';

// Instelbare keuzelijsten van de wizard (OFM-034, TDO §4.2 `keuzeopties`, §9.1). De startset hieronder
// is de enige bron van de standaardopties: `migreer()` voegt hem direct na migratie 002 in (zoals de
// prijslijst-startset, V-13). Sleutels zijn stabiel (kleine letters, cijfers en `_`); bij hernoemen
// verandert alleen het label. Puur (geen Node of DOM): main, renderer en de PDF gebruiken dit.

export const KEUZE_LIJSTEN = [
  'soortWerk',
  'soortDak',
  'bedekking',
  'huidigeBedekking',
  'ondergrond',
  'isolatie',
  'extras',
  'afwerking',
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
  bedekking: [
    o('epdm_11', 'EPDM 1,1 mm'),
    o('epdm_15', 'EPDM 1,5 mm'),
    o('resitrix', 'Resitrix'),
    o('bitumen', 'Bitumen'),
    o('anders', 'Anders'),
  ],
  huidigeBedekking: [
    o('bitumen', 'Bitumen'),
    o('epdm', 'EPDM'),
    o('grind_op_bitumen', 'Grind op bitumen'),
    o('onbekend', 'Weet ik niet'),
  ],
  ondergrond: [o('hout', 'Hout'), o('beton', 'Beton'), o('staal', 'Staal'), o('onbekend', 'Weet ik niet')],
  isolatie: [
    o('geen', 'Geen'),
    o('80', '80 mm (Rc 3,5)'),
    o('100', '100 mm'),
    o('120', '120 mm'),
    o('anders', 'Anders'),
  ],
  // Sleutels = de prijspost-sleutels (§9.3); de standaard-extra's hebben een eigen veld in KlusInvoer.
  extras: [
    o('daktrim', 'Daktrim en dakranden'),
    o('dakgoot_epdm', 'EPDM-dakgoten'),
    o('hwa', 'Hemelwaterafvoeren'),
    o('noodoverloop', 'Noodoverlopen'),
    o('doorvoer', 'Dakdoorvoeren (pijpen, ventilatie)'),
    o('lichtkoepel', 'Lichtkoepels en dakramen aansluiten'),
  ],
  afwerking: [o('geen', 'Geen'), o('grind', 'Grind'), o('sedum', 'Sedum')],
  hoogte: [o('1', 'Begane grond / 1 bouwlaag'), o('2', '2 bouwlagen'), o('3plus', '3 of meer bouwlagen')],
  garantie: [o('10', '10 jaar'), o('20', '20 jaar verzekerde garantie')],
};

/**
 * De standaardkeuze van een nieuwe offerte (§5, lege KlusInvoer). Die optie kan niet verborgen of
 * verwijderd worden, alleen hernoemd: anders zou elke nieuwe offerte met een onzichtbare keuze starten.
 */
export const VASTE_KEUZES: Partial<Record<KeuzeLijst, string>> = {
  isolatie: 'geen',
  afwerking: 'geen',
  hoogte: '1',
  garantie: '10',
};

export function isVasteKeuze(lijst: KeuzeLijst, sleutel: string): boolean {
  return VASTE_KEUZES[lijst] === sleutel;
}

/** Lijsten waarvan een nieuwe optie automatisch een prijspost zonder prijs krijgt, met deze eenheid. */
export const GEPRIJSDE_LIJSTEN: Partial<Record<KeuzeLijst, Eenheid>> = {
  bedekking: 'm²',
  isolatie: 'm²',
  afwerking: 'm²',
  extras: 'stuk',
};

/** Prijspost-sleutel van een optie: gelijk aan de sleutel, behalve de standaard-isolatiediktes (§9.3). */
export function prijsSleutel(lijst: KeuzeLijst, sleutel: string): string {
  return lijst === 'isolatie' && ['80', '100', '120'].includes(sleutel) ? `isolatie_${sleutel}` : sleutel;
}

/** Omschrijving van de prijspost die bij een nieuwe optie hoort. */
export function prijspostOmschrijving(lijst: KeuzeLijst, label: string): string {
  const tekst = label.trim();
  return lijst === 'isolatie' && !/^isolatie/i.test(tekst) ? `Isolatie ${tekst}` : tekst;
}

// ---------- Extra's ----------

/** De standaard-extra's met hun eigen veld in KlusInvoer (§5). Nieuwe extra's staan in `extraAantallen`. */
export const VASTE_EXTRAS = {
  daktrim: 'daktrimM1',
  dakgoot_epdm: 'dakgootM1',
  hwa: 'hwaAantal',
  noodoverloop: 'noodoverloopAantal',
  doorvoer: 'doorvoerAantal',
  lichtkoepel: 'lichtkoepelAantal',
} as const satisfies Record<string, keyof KlusInvoer>;

type VasteExtra = keyof typeof VASTE_EXTRAS;

function isVasteExtra(sleutel: string): sleutel is VasteExtra {
  return Object.hasOwn(VASTE_EXTRAS, sleutel);
}

/** Daktrim en dakgoten tellen in strekkende meters (met decimalen), de rest in stuks. */
export function extraInMeters(sleutel: string): boolean {
  return sleutel === 'daktrim' || sleutel === 'dakgoot_epdm';
}

export function extraAantal(
  invoer: Pick<KlusInvoer, VasteExtraVeld | 'extraAantallen'>,
  sleutel: string,
): number {
  if (isVasteExtra(sleutel)) return invoer[VASTE_EXTRAS[sleutel]];
  return invoer.extraAantallen[sleutel] ?? 0;
}

type VasteExtraVeld = (typeof VASTE_EXTRAS)[VasteExtra];

/** Het deel van KlusInvoer dat verandert als het aantal van een extra verandert. */
export function metExtraAantal(
  invoer: Pick<KlusInvoer, 'extraAantallen'>,
  sleutel: string,
  aantal: number,
): Partial<KlusInvoer> {
  if (isVasteExtra(sleutel)) return { [VASTE_EXTRAS[sleutel]]: aantal };
  const extraAantallen = { ...invoer.extraAantallen };
  if (aantal > 0) extraAantallen[sleutel] = aantal;
  else delete extraAantallen[sleutel];
  return { extraAantallen };
}

/**
 * Extra's met een aantal > 0, in de volgorde van de keuzelijst; daarna extra's die niet (meer) in de
 * lijst staan (verwijderde optie in een oude offerte), zodat er nooit iets wegvalt.
 */
export function extrasMetAantal(
  invoer: Pick<KlusInvoer, VasteExtraVeld | 'extraAantallen'>,
  keuzes: Pick<Keuzes, 'extras'>,
): { sleutel: string; label: string; aantal: number }[] {
  const volgorde = [
    ...keuzes.extras.map((k) => k.sleutel),
    ...Object.keys(VASTE_EXTRAS),
    ...Object.keys(invoer.extraAantallen),
  ];
  const gezien = new Set<string>();
  const uit: { sleutel: string; label: string; aantal: number }[] = [];
  for (const sleutel of volgorde) {
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    const aantal = extraAantal(invoer, sleutel);
    if (aantal > 0) uit.push({ sleutel, label: keuzeLabel(keuzes, 'extras', sleutel), aantal });
  }
  return uit;
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

/** Per lijst de sleutels die deze invoer gebruikt (extra's alleen met een aantal > 0). */
export function gebruikteSleutels(invoer: KlusInvoer): Record<KeuzeLijst, string[]> {
  const een = (waarde: string | null): string[] => (waarde === null ? [] : [waarde]);
  return {
    soortWerk: een(invoer.soortWerk),
    soortDak: een(invoer.soortDak),
    bedekking: een(invoer.bedekking),
    huidigeBedekking: een(invoer.huidigeBedekking),
    ondergrond: een(invoer.ondergrond),
    isolatie: [invoer.isolatie],
    extras: [
      ...Object.keys(VASTE_EXTRAS).filter((s) => extraAantal(invoer, s) > 0),
      ...Object.keys(invoer.extraAantallen).filter((s) => extraAantal(invoer, s) > 0),
    ],
    afwerking: [invoer.afwerking],
    hoogte: [invoer.hoogte],
    garantie: [invoer.garantieJaren],
  };
}
