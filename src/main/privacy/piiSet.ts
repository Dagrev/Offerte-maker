import type { Klant } from '@shared/types';
import { VERWIJDERD } from './patronen';

// PII-set per klant (TDO §11.1, V-02). Alles wat het filter (§11.2) en de eindcontrole (§11.3)
// als klantgegeven herkennen, met de plaatshouder die ervoor in de plaats komt.

export type Plaatshouder =
  | '[KLANT_NAAM]'
  | '[KLANT_BEDRIJF]'
  | '[KLANT_ADRES]'
  | '[KLANT_POSTCODE]'
  | '[KLANT_PLAATS]'
  | '[WERK_ADRES]'
  | '[WERK_PLAATS]'
  | typeof VERWIJDERD;

export interface PiiWaarde {
  /** Bij `soort: 'telefoon'` alleen cijfers, met een leidende `+31`/`0031` als `0`. */
  waarde: string;
  plaatshouder: Plaatshouder;
  hoofdlettergevoelig: boolean;
  /** `tekst`: als heel woord zoeken; `telefoon`: als cijferreeks met willekeurige scheidingstekens. */
  soort: 'tekst' | 'telefoon';
}

export const TUSSENVOEGSELS: readonly string[] = [
  'van',
  'de',
  'der',
  'den',
  'het',
  'ten',
  'ter',
  'te',
  'op',
  'in',
  "'t",
  'von',
  'le',
  'la',
  'du',
];

export const BEDRIJFSWOORDEN: readonly string[] = [
  'b.v.',
  'bv',
  'v.o.f.',
  'vof',
  'holding',
  'groep',
  'beheer',
  'bouw',
  'en',
];

/** Vergelijkingssleutel voor de uitzonderingslijsten: kleine letters, zonder punten (`B.V` = `bv`). */
function sleutel(woord: string): string {
  return woord.toLowerCase().replace(/\./g, '');
}

/** Woorden van een naam: gesplitst op witruimte en koppeltekens, leestekens eromheen eraf. */
function woorden(tekst: string): string[] {
  return tekst
    .split(/[\s-]+/u)
    .map((w) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((w) => w !== '');
}

/** Cijfers van een telefoonnummer; een leidende `+31` of `0031` telt als `0`. */
export function telefoonCijfers(tekst: string): string {
  const compact = tekst.replace(/[^\d+]/g, '');
  const genormaliseerd = compact.startsWith('+31')
    ? '0' + compact.slice(3)
    : compact.startsWith('0031')
      ? '0' + compact.slice(4)
      : compact;
  return genormaliseerd.replace(/\D/g, '');
}

/** Postcode als `1234AB` en, als hij die vorm heeft, ook `1234 AB`. */
function postcodeVarianten(postcode: string): string[] {
  const compact = postcode.replace(/\s+/g, '').toUpperCase();
  if (compact.length < 6) return [];
  const m = /^([1-9]\d{3})([A-Z]{2})$/.exec(compact);
  return m ? [compact, `${m[1]} ${m[2]}`] : [compact];
}

/** Straatnaam zonder huisnummer: alles vóór het eerste cijfer. */
function straatnaam(straatHuisnummer: string): string {
  const i = straatHuisnummer.search(/\d/);
  return (i === -1 ? straatHuisnummer : straatHuisnummer.slice(0, i)).trim();
}

export function bouwPiiSet(klant: Klant): PiiWaarde[] {
  const set: PiiWaarde[] = [];
  const voegToe = (
    waarde: string,
    plaatshouder: Plaatshouder,
    minLengte: number,
    hoofdlettergevoelig = false,
  ): void => {
    const w = waarde.trim();
    if (w.length >= minLengte) set.push({ waarde: w, plaatshouder, hoofdlettergevoelig, soort: 'tekst' });
  };

  // naam: volledig (≥ 2), elk woord ≥ 3 dat geen tussenvoegsel is
  voegToe(klant.naam, '[KLANT_NAAM]', 2);
  for (const w of woorden(klant.naam)) {
    if (!TUSSENVOEGSELS.includes(w.toLowerCase())) voegToe(w, '[KLANT_NAAM]', 3);
  }

  // bedrijfsnaam: volledig (≥ 2), elk woord ≥ 4 behalve de algemene bedrijfswoorden
  voegToe(klant.bedrijfsnaam, '[KLANT_BEDRIJF]', 2);
  for (const w of woorden(klant.bedrijfsnaam)) {
    if (!BEDRIJFSWOORDEN.map(sleutel).includes(sleutel(w))) voegToe(w, '[KLANT_BEDRIJF]', 4);
  }

  // adres
  voegToe(klant.adres.straatHuisnummer, '[KLANT_ADRES]', 4);
  voegToe(straatnaam(klant.adres.straatHuisnummer), '[KLANT_ADRES]', 4);
  for (const p of postcodeVarianten(klant.adres.postcode)) voegToe(p, '[KLANT_POSTCODE]', 6);
  voegToe(klant.adres.plaats, '[KLANT_PLAATS]', 2, true);

  // werkadres (alleen als dat apart is ingevuld)
  if (klant.heeftWerkadres) {
    voegToe(klant.werkadres.straatHuisnummer, '[WERK_ADRES]', 4);
    voegToe(straatnaam(klant.werkadres.straatHuisnummer), '[WERK_ADRES]', 4);
    for (const p of postcodeVarianten(klant.werkadres.postcode)) voegToe(p, VERWIJDERD, 6);
    voegToe(klant.werkadres.plaats, '[WERK_PLAATS]', 2, true);
  }

  // telefoon: zoals ingevuld en als cijferreeks (≥ 8 cijfers)
  const cijfers = telefoonCijfers(klant.telefoon);
  if (cijfers.length >= 8) {
    voegToe(klant.telefoon, VERWIJDERD, 8);
    set.push({ waarde: cijfers, plaatshouder: VERWIJDERD, hoofdlettergevoelig: false, soort: 'telefoon' });
  }

  // e-mail: volledig en het deel vóór de @ (≥ 4)
  voegToe(klant.email, VERWIJDERD, 4);
  const at = klant.email.indexOf('@');
  if (at > 0) voegToe(klant.email.slice(0, at), VERWIJDERD, 4);

  return uniek(set).sort((a, b) => b.waarde.length - a.waarde.length);
}

/**
 * Dezelfde waarde één keer; de eerste wint. Omdat de klantwaarden vóór het werkadres staan, geldt
 * bij een werkadreswaarde die gelijk is aan de klantwaarde alleen de klantplaatshouder.
 */
function uniek(set: PiiWaarde[]): PiiWaarde[] {
  const gezien = new Set<string>();
  return set.filter((p) => {
    const k = `${p.soort}:${p.waarde.replace(/\s+/g, ' ').toLowerCase()}`;
    if (gezien.has(k)) return false;
    gezien.add(k);
    return true;
  });
}

/** Regex-speciale tekens escapen (geldig met de `u`-vlag). */
function escape(tekst: string): string {
  return tekst.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

const SCHEIDING = '[\\s\\-().]*';

/**
 * Zoekpatroon voor één PII-waarde, zoals filter en eindcontrole het gebruiken (§11.2 stap 2):
 * heel woord, witruimte als `\s+`, hoofdletterongevoelig tenzij anders aangegeven. Telefoon: de
 * cijfers met willekeurige scheidingstekens ertussen, `0` ook als `+31`/`0031`.
 */
export function zoekpatroon(pii: PiiWaarde, globaal = true): RegExp {
  const g = globaal ? 'g' : '';
  if (pii.soort === 'telefoon') {
    const [eerste = '', ...rest] = pii.waarde;
    const begin = eerste === '0' ? `(?:\\+${SCHEIDING}31|0031|0)` : eerste;
    const lijf = rest.map((c) => SCHEIDING + c).join('');
    return new RegExp(`(?<![\\d+])\\(?${begin}${lijf}(?!\\d)`, `${g}u`);
  }
  const kern = pii.waarde.split(/\s+/).map(escape).join('\\s+');
  const vlaggen = `${g}u${pii.hoofdlettergevoelig ? '' : 'i'}`;
  return new RegExp(`(?<![\\p{L}\\p{N}])${kern}(?![\\p{L}\\p{N}])`, vlaggen);
}
