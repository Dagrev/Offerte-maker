import type { Bedrijf } from '@shared/types';
import { EMAIL, IBAN, TELEFOON_NL, VERWIJDERD, vervangGeneriekePatronen, vervangPostcodes } from './patronen';
import { telefoonCijfers, zoekpatroon } from './piiSet';

// Voorbeeldredactie (TDO §11.5, V-16, FO §8.3, FE-081). Zes stappen, in deze volgorde. Altijd
// opnieuw uitvoeren vanaf de brontekst (opnieuw geëxtraheerd uit de BLOB in `bestanden`), zodat
// nieuwe handmatige redacties of gewijzigde bedrijfsgegevens consistent doorwerken.

export const BEDRIJF = '[BEDRIJF]';

/** Stap 3: straat + huisnummer (letterlijk §11.5). */
export const STRAAT_HUISNUMMER =
  /\b\p{Lu}[\p{L}'.-]*(?:straat|laan|weg|plein|singel|gracht|dijk|kade|hof|park|pad|dreef|steeg|markt|ring|baan|veld|berg|wal|erf|akker|donk|hoek|voort)\s+\d+\s?[a-zA-Z]?(?:[-/]\d+)?\b/gu;

/** Stap 4: aanhefwoorden (letterlijk §11.5), hoofdletterongevoelig. */
export const AANHEF_WOORDEN =
  /(Dhr\.?|Mevr\.?|Mw\.?|Fam\.?|Familie|De heer|Mevrouw|T\.a\.v\.?|Geachte(?: heer| mevrouw| familie)?|Beste)/i;

/** Aanhefwoord als los woord, gevolgd door de rest van de regel tot een komma. */
const AANHEF = new RegExp(`(?<![\\p{L}\\p{N}])${AANHEF_WOORDEN.source}(?!\\p{L})([ \\t]*)([^\\n,]*)`, 'giu');

/** Stap 5: zoveel niet-lege regels bovenaan gelden als mogelijk adresblok. */
const ADRESBLOK_REGELS = 15;

function escape(tekst: string): string {
  return tekst.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** Alleen letters en cijfers, hoofdletters (V-16). */
function normaliseer(tekst: string): string {
  return tekst.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
}

/** Een genormaliseerde waarde terugvinden met willekeurige spaties, punten of streepjes ertussen. */
function genormaliseerdPatroon(genormaliseerd: string): RegExp {
  const kern = [...genormaliseerd].map(escape).join('[\\s.\\-]*');
  return new RegExp(`(?<![\\p{L}\\p{N}])${kern}(?![\\p{L}\\p{N}])`, 'giu');
}

function heelWoordPatroon(waarde: string): RegExp {
  return zoekpatroon({ waarde, plaatshouder: VERWIJDERD, hoofdlettergevoelig: false, soort: 'tekst' });
}

/** Stap 1: eigen bedrijfsgegevens → `[BEDRIJF]`, langste waarde eerst. */
function bedrijfsPatronen(bedrijf: Bedrijf): RegExp[] {
  const patronen: { lengte: number; regex: RegExp }[] = [];
  const tekst = (waarde: string) => {
    const w = waarde.trim();
    if (w.length >= 3) patronen.push({ lengte: w.length, regex: heelWoordPatroon(w) });
  };
  const genormaliseerd = (waarde: string) => {
    const n = normaliseer(waarde);
    if (n.length >= 3) patronen.push({ lengte: n.length, regex: genormaliseerdPatroon(n) });
  };

  for (const veld of [bedrijf.naam, bedrijf.contactpersoon, bedrijf.adres, bedrijf.plaats]) tekst(veld);
  for (const veld of [bedrijf.email, bedrijf.website]) tekst(veld);
  // Genormaliseerd vergeleken (V-16): IBAN, KvK, btw-nummer, en ook de postcode.
  for (const veld of [bedrijf.iban, bedrijf.kvk, bedrijf.btwNummer, bedrijf.postcode]) genormaliseerd(veld);
  // Telefoon: zoals ingevuld en als cijferreeks (0 ↔ +31/0031).
  tekst(bedrijf.telefoon);
  const cijfers = telefoonCijfers(bedrijf.telefoon);
  if (cijfers.length >= 8) {
    patronen.push({
      lengte: cijfers.length,
      regex: zoekpatroon({
        waarde: cijfers,
        plaatshouder: VERWIJDERD,
        hoofdlettergevoelig: false,
        soort: 'telefoon',
      }),
    });
  }
  return patronen.sort((a, b) => b.lengte - a.lengte).map((p) => p.regex);
}

/**
 * Stap 1 vervangen, behalve binnen een langer e-mailadres, IBAN of telefoonnummer van iemand
 * anders: het eigen KvK-nummer `12345678` mag van `06-12345678` geen `06-[BEDRIJF]` maken. Zo'n
 * reeks valt daarna in stap 2 als geheel onder `[VERWIJDERD]`.
 */
function vervangBuitenGeneriek(tekst: string, regex: RegExp): string {
  const reeksen = [EMAIL, IBAN, TELEFOON_NL].flatMap((p) =>
    [...tekst.matchAll(p)].map((m) => ({ van: m.index, tot: m.index + m[0].length })),
  );
  return tekst.replace(regex, (treffer: string, ...args: unknown[]) => {
    const van = args.find((a) => typeof a === 'number') ?? 0;
    const tot = van + treffer.length;
    const binnenLanger = reeksen.some((r) => r.van <= van && r.tot >= tot && r.tot - r.van > treffer.length);
    return binnenLanger ? treffer : BEDRIJF;
  });
}

/** Stap 4: na een aanhefwoord de rest van de regel (tot een komma, of een punt aan het regeleinde). */
function redigeerAanhef(tekst: string): string {
  return tekst.replace(AANHEF, (heel: string, woord: string, spatie: string, rest: string) => {
    const zonderEind = rest.replace(/[ \t]+$/, '');
    const achter = rest.slice(zonderEind.length);
    const punt = zonderEind.endsWith('.') ? '.' : '';
    const naam = punt ? zonderEind.slice(0, -1) : zonderEind;
    if (naam.trim() === '' || /^\[[A-Z_]+\]$/.test(naam.trim())) return heel;
    return `${woord}${spatie}${VERWIJDERD}${punt}${achter}`;
  });
}

function aantalWoorden(regel: string): number {
  return regel.trim().split(/\s+/).length;
}

/** Stap 5: adresblok in de eerste 15 niet-lege regels. */
function redigeerAdresblok(tekst: string): string {
  const regels = tekst.split('\n');
  const teRedigeren = new Set<number>();
  let nietLeeg = 0;
  for (let i = 0; i < regels.length && nietLeeg < ADRESBLOK_REGELS; i++) {
    const regel = regels[i] ?? '';
    if (regel.trim() === '') continue;
    nietLeeg++;
    if (!regel.includes(VERWIJDERD)) continue;
    teRedigeren.add(i);
    const boven = regels[i - 1] ?? '';
    if (boven.trim() !== '' && aantalWoorden(boven) <= 5 && !/\d/.test(boven) && !boven.includes(':')) {
      teRedigeren.add(i - 1);
    }
  }
  return regels.map((r, i) => (teRedigeren.has(i) ? VERWIJDERD : r)).join('\n');
}

/** Stap 6: handmatige redacties, letterlijk, overal, hoofdletterongevoelig; langste eerst. */
function redigeerHandmatig(tekst: string, handmatigeRedacties: readonly string[]): string {
  return [...handmatigeRedacties]
    .filter((r) => r.trim() !== '')
    .sort((a, b) => b.length - a.length)
    .reduce((uit, r) => uit.replace(new RegExp(escape(r), 'giu'), VERWIJDERD), tekst);
}

export function redigeerVoorbeeld(
  tekst: string,
  bedrijf: Bedrijf,
  handmatigeRedacties: readonly string[],
): string {
  // 1. eigen bedrijfsgegevens (vóór de generieke patronen, zodat die [BEDRIJF] worden)
  let uit = bedrijfsPatronen(bedrijf).reduce((t, regex) => vervangBuitenGeneriek(t, regex), tekst);
  // 2. generieke patronen (§11.2 stap 1) en postcodes (FO §8.3)
  uit = vervangPostcodes(vervangGeneriekePatronen(uit));
  // 3. straat + huisnummer
  uit = uit.replace(STRAAT_HUISNUMMER, VERWIJDERD);
  // 4. namen na een aanhefwoord
  uit = redigeerAanhef(uit);
  // 5. adresblok
  uit = redigeerAdresblok(uit);
  // 6. handmatige redacties
  return redigeerHandmatig(uit, handmatigeRedacties);
}
