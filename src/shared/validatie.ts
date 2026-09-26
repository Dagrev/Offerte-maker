import type { Bedrijf, Klant } from './types';

// Validatie en normalisatie van adres, e-mail en telefoon (OFM-030). Puur: geen DOM, geen database,
// geen tekst voor de gebruiker (die staat in `teksten/validatie.ts`). Gebruikt door de wizard (stap 1),
// de tab Bedrijf en main (`offerte:bewaarInvoer`, `instellingen:bewaar`). OFM-031 en OFM-035 bouwen
// hierop voort (`ontleedHuisnummer`, `splitsStraatHuisnummer`, `ongeldigeKlantVelden`).
//
// Regel voor alle `controleer…`-functies: een leeg veld (alleen witruimte) is geldig en wordt ''.
// Of een veld verplicht is, bepaalt de aanroeper (bijv. `wizardControle.ts`), niet deze module.

/** Wat er mis is met een waarde; de melding hoort bij de soort (`teksten/validatie.ts`). */
export type ValidatieFout = 'postcode' | 'huisnummer' | 'straatHuisnummer' | 'email' | 'telefoon';

export type Controle = { geldig: true; waarde: string } | { geldig: false; fout: ValidatieFout };

const geldig = (waarde: string): Controle => ({ geldig: true, waarde });
const ongeldig = (fout: ValidatieFout): Controle => ({ geldig: false, fout });

// ---------- Postcode ----------

/** Postcodes met deze letters worden niet uitgegeven (PostNL). */
const VERBODEN_POSTCODELETTERS = new Set(['SA', 'SD', 'SS']);

/** NL-postcode: 4 cijfers (niet met 0 beginnend) en 2 letters, spatie optioneel → `1234 AB`. */
export function controleerPostcode(invoer: string): Controle {
  const p = invoer.trim().toUpperCase();
  if (p === '') return geldig('');
  const m = /^([1-9]\d{3})\s*([A-Z]{2})$/.exec(p);
  if (!m || VERBODEN_POSTCODELETTERS.has(String(m[2]))) return ongeldig('postcode');
  return geldig(`${m[1]} ${m[2]}`);
}

// ---------- Huisnummer ----------

/**
 * Nummer (1–99999) met een optionele toevoeging van 1–4 letters/cijfers, gescheiden door een spatie,
 * `-` of `/`; een toevoeging die met een letter begint mag er ook direct achter (`12A`).
 */
const HUISNUMMER = /^([1-9]\d{0,4})(?:(?:\s*[-/]\s*|\s+|(?=[A-Za-z]))([A-Za-z0-9]{1,4}))?$/;

export interface Huisnummer {
  nummer: number;
  /** Hoofdletters; '' zonder toevoeging. Eén letter is een huisletter (`12A`), anders een toevoeging (`12-2`). */
  toevoeging: string;
}

/** Huisnummer ontleden voor opzoeken (OFM-031); `null` als het geen geldig huisnummer is. */
export function ontleedHuisnummer(invoer: string): Huisnummer | null {
  const m = HUISNUMMER.exec(invoer.trim());
  if (!m) return null;
  return { nummer: Number(m[1]), toevoeging: (m[2] ?? '').toUpperCase() };
}

function huisnummerTekst({ nummer, toevoeging }: Huisnummer): string {
  if (toevoeging === '') return String(nummer);
  return /^[A-Z]$/.test(toevoeging) ? `${nummer}${toevoeging}` : `${nummer}-${toevoeging}`;
}

/** Huisnummer los: `12`, `12a` → `12A`, `12 - 2` → `12-2`, `12 bis` → `12-BIS`. */
export function controleerHuisnummer(invoer: string): Controle {
  if (invoer.trim() === '') return geldig('');
  const h = ontleedHuisnummer(invoer);
  return h ? geldig(huisnummerTekst(h)) : ongeldig('huisnummer');
}

/**
 * "Straat en huisnummer" in één veld (klantadres, werkadres, bedrijfsadres): straat met minstens één
 * letter, dan het huisnummer als laatste deel. Straatnamen met cijfers (`Laan 1940-1945 3`) kunnen.
 */
export function splitsStraatHuisnummer(invoer: string): { straat: string; huisnummer: Huisnummer } | null {
  const tekst = invoer.trim().replace(/\s+/g, ' ');
  // Kortste straat eerst; het eerste achterstuk dat een huisnummer is, wint.
  for (let i = tekst.indexOf(' '); i !== -1; i = tekst.indexOf(' ', i + 1)) {
    const straat = tekst.slice(0, i);
    const huisnummer = ontleedHuisnummer(tekst.slice(i + 1));
    if (huisnummer && /\p{L}/u.test(straat)) return { straat, huisnummer };
  }
  return null;
}

/**
 * Straat met huisnummer; zonder huisnummer is het ongeldig. Alleen witruimte wordt genormaliseerd
 * (`Kerkstraat  12 bis` → `Kerkstraat 12 bis`): de schrijfwijze van de toevoeging blijft van de gebruiker.
 */
export function controleerStraatHuisnummer(invoer: string): Controle {
  if (invoer.trim() === '') return geldig('');
  return splitsStraatHuisnummer(invoer)
    ? geldig(invoer.trim().replace(/\s+/g, ' '))
    : ongeldig('straatHuisnummer');
}

// ---------- E-mail ----------

/** Eén `@`, iets ervoor, een domein met een punt en een extensie van ≥ 2 letters, geen spaties → kleine letters. */
export function controleerEmail(invoer: string): Controle {
  const e = invoer.trim().toLowerCase();
  if (e === '') return geldig('');
  const delen = e.split('@');
  if (/\s/.test(e) || delen.length !== 2) return ongeldig('email');
  const [lokaal = '', domein = ''] = delen;
  const labels = domein.split('.');
  const labelOk = (l: string) => /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u.test(l);
  if (
    lokaal === '' ||
    labels.length < 2 ||
    !labels.every(labelOk) ||
    !/^\p{L}{2,}$/u.test(String(labels[labels.length - 1]))
  )
    return ongeldig('email');
  return geldig(e);
}

// ---------- Telefoon ----------

/**
 * Telefoonnummer naar E.164. `06 12345678`, `010-1234567` en `+31 (0)6 …` worden `+31…` (NL: 9 cijfers
 * na de 0); een andere landcode mag als het nummer met `+` of `00` begint en daarna 8–15 cijfers heeft.
 * Toegestane scheidingstekens: spatie, `-`, `.`, `/` en haakjes.
 */
export function controleerTelefoon(invoer: string): Controle {
  const t = invoer.trim();
  if (t === '') return geldig('');
  if (/[^\d\s+\-()./]/.test(t)) return ongeldig('telefoon');
  let c = t.replace(/\(0\)/g, '').replace(/[\s\-()./]/g, '');
  if (c.startsWith('00')) c = '+' + c.slice(2);
  if (c.lastIndexOf('+') > 0) return ongeldig('telefoon');
  if (c.startsWith('+31')) {
    const nationaal = c.slice(3).replace(/^0/, '');
    return /^[1-9]\d{8}$/.test(nationaal) ? geldig(`+31${nationaal}`) : ongeldig('telefoon');
  }
  if (c.startsWith('+')) return /^[1-9]\d{7,14}$/.test(c.slice(1)) ? geldig(c) : ongeldig('telefoon');
  if (/^0[1-9]\d{8}$/.test(c)) return geldig(`+31${c.slice(1)}`);
  return ongeldig('telefoon');
}

/** Weergave van een E.164-nummer: `+31612345678` → `+31 6 12345678`, overig NL `+31 101234567`; anders ongewijzigd. */
export function telefoonWeergave(nummer: string): string {
  const mobiel = /^\+316(\d{8})$/.exec(nummer);
  if (mobiel) return `+31 6 ${mobiel[1]}`;
  if (/^\+31\d{9}$/.test(nummer)) return `+31 ${nummer.slice(3)}`;
  return nummer;
}

// ---------- Klant en bedrijf ----------

export type KlantVeld =
  | 'adres.straatHuisnummer'
  | 'adres.postcode'
  | 'werkadres.straatHuisnummer'
  | 'werkadres.postcode'
  | 'telefoon'
  | 'email';

export type BedrijfVeld = 'adres' | 'postcode' | 'telefoon' | 'email';

export interface VeldFout<V extends string> {
  veld: V;
  fout: ValidatieFout;
}

type Controleur = (invoer: string) => Controle;

interface VeldDef<T, V extends string> {
  veld: V;
  controleer: Controleur;
  lees: (x: T) => string;
  zet: (x: T, waarde: string) => T;
  /** Alleen controleren als dit waar is (werkadres alleen met `heeftWerkadres`). */
  actief?: (x: T) => boolean;
}

const KLANT_VELDEN: VeldDef<Klant, KlantVeld>[] = [
  {
    veld: 'adres.straatHuisnummer',
    controleer: controleerStraatHuisnummer,
    lees: (k) => k.adres.straatHuisnummer,
    zet: (k, w) => ({ ...k, adres: { ...k.adres, straatHuisnummer: w } }),
  },
  {
    veld: 'adres.postcode',
    controleer: controleerPostcode,
    lees: (k) => k.adres.postcode,
    zet: (k, w) => ({ ...k, adres: { ...k.adres, postcode: w } }),
  },
  {
    veld: 'werkadres.straatHuisnummer',
    controleer: controleerStraatHuisnummer,
    lees: (k) => k.werkadres.straatHuisnummer,
    zet: (k, w) => ({ ...k, werkadres: { ...k.werkadres, straatHuisnummer: w } }),
    actief: (k) => k.heeftWerkadres,
  },
  {
    veld: 'werkadres.postcode',
    controleer: controleerPostcode,
    lees: (k) => k.werkadres.postcode,
    zet: (k, w) => ({ ...k, werkadres: { ...k.werkadres, postcode: w } }),
    actief: (k) => k.heeftWerkadres,
  },
  {
    veld: 'telefoon',
    controleer: controleerTelefoon,
    lees: (k) => k.telefoon,
    zet: (k, w) => ({ ...k, telefoon: w }),
  },
  { veld: 'email', controleer: controleerEmail, lees: (k) => k.email, zet: (k, w) => ({ ...k, email: w }) },
];

type BedrijfVelden = Pick<Bedrijf, BedrijfVeld>;

const BEDRIJF_VELDEN: VeldDef<BedrijfVelden, BedrijfVeld>[] = (
  [
    ['adres', controleerStraatHuisnummer],
    ['postcode', controleerPostcode],
    ['telefoon', controleerTelefoon],
    ['email', controleerEmail],
  ] as const
).map(([veld, controleer]) => ({
  veld,
  controleer,
  lees: (b: BedrijfVelden) => b[veld],
  zet: (b: BedrijfVelden, w: string) => ({ ...b, [veld]: w }),
}));

export interface Uitkomst<T, V extends string> {
  /** Geldige velden genormaliseerd; ongeldige ongewijzigd. */
  waarde: T;
  fouten: VeldFout<V>[];
}

/**
 * Controleert en normaliseert alle velden. Met `vorige` (de opgeslagen stand) telt een ongeldige
 * waarde die gelijk is aan de opgeslagen waarde niet als fout: een oude offerte of oude
 * bedrijfsgegevens blijven zo te bewerken zolang het veld niet wordt aangeraakt.
 */
function controleerVelden<T, V extends string>(defs: VeldDef<T, V>[], invoer: T, vorige?: T): Uitkomst<T, V> {
  let waarde = invoer;
  const fouten: VeldFout<V>[] = [];
  for (const def of defs) {
    if (def.actief && !def.actief(invoer)) continue;
    const huidig = def.lees(invoer);
    const c = def.controleer(huidig);
    if (c.geldig) waarde = def.zet(waarde, c.waarde);
    else if (vorige === undefined || def.lees(vorige) !== huidig)
      fouten.push({ veld: def.veld, fout: c.fout });
  }
  return { waarde, fouten };
}

/** Klantvelden van wizardstap 1; het werkadres alleen met `heeftWerkadres`. */
export function controleerKlantVelden(klant: Klant, vorige?: Klant): Uitkomst<Klant, KlantVeld> {
  return controleerVelden(KLANT_VELDEN, klant, vorige);
}

/** Bedrijfsgegevens: adres (straat en huisnummer), postcode, telefoon en e-mail. */
export function controleerBedrijfVelden<T extends BedrijfVelden>(
  bedrijf: T,
  vorige?: BedrijfVelden,
): Uitkomst<T, BedrijfVeld> {
  return controleerVelden(BEDRIJF_VELDEN as unknown as VeldDef<T, BedrijfVeld>[], bedrijf, vorige as T);
}

/** Alleen de fouten, per veld (voor de meldingen onder de velden). */
export function ongeldigeKlantVelden(klant: Klant): Partial<Record<KlantVeld, ValidatieFout>> {
  return Object.fromEntries(controleerKlantVelden(klant).fouten.map((f) => [f.veld, f.fout]));
}

export function ongeldigeBedrijfVelden(bedrijf: BedrijfVelden): Partial<Record<BedrijfVeld, ValidatieFout>> {
  return Object.fromEntries(controleerBedrijfVelden(bedrijf).fouten.map((f) => [f.veld, f.fout]));
}

/**
 * Wat de renderer bewaart (autosave): een ongeldig veld krijgt de waarde uit `basis` (de laatst
 * bewaarde stand), de rest gaat zoals ingevuld. Zo bewaart autosave de geldige velden wel en weigert
 * main nooit een autosave (de basiswaarde was al geldig of stond al zo opgeslagen).
 */
function bewaarbaar<T, V extends string>(defs: VeldDef<T, V>[], invoer: T, basis: T): T {
  let waarde = invoer;
  for (const def of defs) {
    if (def.actief && !def.actief(invoer)) continue;
    if (!def.controleer(def.lees(invoer)).geldig && def.lees(basis) !== def.lees(invoer))
      waarde = def.zet(waarde, def.lees(basis));
  }
  return waarde;
}

export function bewaarbareKlant(klant: Klant, basis: Klant): Klant {
  return bewaarbaar(KLANT_VELDEN, klant, basis);
}

export function bewaarbaarBedrijf<T extends BedrijfVelden>(bedrijf: T, basis: T): T {
  return bewaarbaar(BEDRIJF_VELDEN as unknown as VeldDef<T, BedrijfVeld>[], bedrijf, basis);
}
