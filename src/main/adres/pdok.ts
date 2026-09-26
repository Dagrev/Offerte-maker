import { controleerPostcode, ontleedHuisnummer, type Huisnummer } from '@shared/validatie';
import { log } from '../log';

// Adres opzoeken via de PDOK Locatieserver (OFM-031, OFM-040, A-29), in twee richtingen:
// - postcode + huisnummer → straat, plaats (en postcode);
// - straat + huisnummer + plaats → postcode (en straat en plaats zoals PDOK ze schrijft).
// Alleen die adreswaarden verlaten de pc, nooit een naam. De aanroep loopt in main met `fetch`; de
// CSP van de renderer (`connect-src 'none'`) blijft ongewijzigd. Nooit een fout naar de gebruiker:
// geen internet, time-out, een raar antwoord of geen treffer geeft `null`. Het log bevat nooit de
// waarden.

export const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
export const PDOK_TIMEOUT_MS = 5000;

export interface GevondenAdres {
  straat: string;
  plaats: string;
  /** Genormaliseerd `1234 AB`. */
  postcode: string;
}

/** Wat er gezocht wordt: op postcode, of (OFM-040) op straat en plaats. */
export type AdresZoekInvoer =
  { postcode: string; huisnummer: string } | { straat: string; huisnummer: string; plaats: string };

interface PdokDoc {
  straatnaam?: unknown;
  woonplaatsnaam?: unknown;
  postcode?: unknown;
  huisletter?: unknown;
  huisnummertoevoeging?: unknown;
}

/** Basis-URL: `OFFERTE_MAKER_PDOK_URL` (nep-server in tests) of de echte Locatieserver. */
export function pdokUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env['OFFERTE_MAKER_PDOK_URL'] || PDOK_URL;
}

/** Waarde als Solr-frase: tussen aanhalingstekens, `"` en `\` ge-escaped, witruimte samengevoegd. */
export function frase(waarde: string): string {
  return `"${waarde.trim().replace(/\s+/g, ' ').replace(/["\\]/g, '\\$&')}"`;
}

/** Het genormaliseerde zoekverzoek: welke `fq`-filters meegaan, naast `type:adres` en het huisnummer. */
export type Zoekvraag =
  | { soort: 'postcode'; postcode: string; huisnummer: Huisnummer }
  | { soort: 'straat'; straat: string; plaats: string; huisnummer: Huisnummer };

/**
 * Zoek-URL: `fq=type:adres`, dan postcode (zonder spatie) of straatnaam en woonplaatsnaam (als frase,
 * PDOK vergelijkt hoofdletterongevoelig), en het huisnummer zonder toevoeging.
 */
export function zoekUrl(basis: string, vraag: Zoekvraag): string {
  const url = new URL(basis);
  url.searchParams.append('fq', 'type:adres');
  if (vraag.soort === 'postcode') {
    url.searchParams.append('fq', `postcode:${vraag.postcode.replace(' ', '')}`);
  } else {
    url.searchParams.append('fq', `straatnaam:${frase(vraag.straat)}`);
    url.searchParams.append('fq', `woonplaatsnaam:${frase(vraag.plaats)}`);
  }
  url.searchParams.append('fq', `huisnummer:${vraag.huisnummer.nummer}`);
  url.searchParams.set('fl', 'straatnaam woonplaatsnaam postcode huisletter huisnummertoevoeging');
  url.searchParams.set('rows', '20');
  return url.toString();
}

const tekst = (w: unknown): string => (typeof w === 'string' ? w.trim() : '');

/**
 * Kies het document dat bij de toevoeging past: één letter = huisletter (`12A`), anders de
 * huisnummertoevoeging (`12-2`); zonder toevoeging het adres zonder letter en toevoeging. Past niets
 * precies, dan het eerste (straat, plaats en meestal ook de postcode zijn voor alle toevoegingen van
 * één nummer gelijk).
 */
export function kiesDoc(docs: PdokDoc[], toevoeging: string): PdokDoc | undefined {
  const past = (d: PdokDoc) => {
    const letter = tekst(d.huisletter).toUpperCase();
    const toev = tekst(d.huisnummertoevoeging).toUpperCase();
    if (toevoeging === '') return letter === '' && toev === '';
    return /^[A-Z]$/.test(toevoeging)
      ? letter === toevoeging
      : toev === toevoeging || letter + toev === toevoeging;
  };
  return docs.find(past) ?? docs[0];
}

/**
 * Haal straat, plaats en postcode uit het PDOK-antwoord (`response.docs`); `null` bij geen of een
 * onvolledige treffer. Een ontbrekende of ongeldige postcode maakt de treffer onvolledig.
 */
export function leesAntwoord(json: unknown, toevoeging: string): GevondenAdres | null {
  const docs = (json as { response?: { docs?: unknown } } | null)?.response?.docs;
  if (!Array.isArray(docs)) return null;
  const doc = kiesDoc(docs as PdokDoc[], toevoeging);
  const straat = tekst(doc?.straatnaam);
  const plaats = tekst(doc?.woonplaatsnaam);
  const postcode = controleerPostcode(tekst(doc?.postcode));
  if (straat === '' || plaats === '' || !postcode.geldig || postcode.waarde === '') return null;
  return { straat, plaats, postcode: postcode.waarde };
}

/** Invoer → zoekvraag, of `null` als er niets zinnigs te zoeken valt (dan geen aanroep). */
export function zoekvraag(invoer: AdresZoekInvoer): Zoekvraag | null {
  const huisnummer = ontleedHuisnummer(invoer.huisnummer);
  if (!huisnummer) return null;
  if ('postcode' in invoer) {
    const postcode = controleerPostcode(invoer.postcode);
    if (!postcode.geldig || postcode.waarde === '') return null;
    return { soort: 'postcode', postcode: postcode.waarde, huisnummer };
  }
  const straat = invoer.straat.trim();
  const plaats = invoer.plaats.trim();
  if (!/\p{L}/u.test(straat) || !/\p{L}/u.test(plaats)) return null;
  return { soort: 'straat', straat, plaats, huisnummer };
}

type Fetch = typeof fetch;

/** `adres:zoek`. Invoer is al door het IPC-schema gecontroleerd; hier nogmaals, omdat dit de grens naar buiten is. */
export async function zoekAdres(
  invoer: AdresZoekInvoer,
  opties: { haal?: Fetch; basis?: string; timeoutMs?: number; nu?: () => number } = {},
): Promise<GevondenAdres | null> {
  const vraag = zoekvraag(invoer);
  if (!vraag) return null;

  const haal = opties.haal ?? fetch;
  const nu = opties.nu ?? (() => performance.now());
  const start = nu();
  let uitkomst: GevondenAdres | null = null;
  let reden = 'niet gevonden';
  try {
    const antwoord = await haal(zoekUrl(opties.basis ?? pdokUrl(), vraag), {
      signal: AbortSignal.timeout(opties.timeoutMs ?? PDOK_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (antwoord.ok) uitkomst = leesAntwoord(await antwoord.json(), vraag.huisnummer.toevoeging);
    else reden = `niet gevonden (http ${antwoord.status})`;
  } catch (fout) {
    reden =
      fout instanceof Error && (fout.name === 'TimeoutError' || fout.name === 'AbortError')
        ? 'niet gevonden (time-out)'
        : 'niet gevonden (geen verbinding)';
  }
  log.info(
    `adres opgezocht op ${vraag.soort}: ${uitkomst ? 'gevonden' : reden}, ${Math.round(nu() - start)} ms`,
  );
  return uitkomst;
}
