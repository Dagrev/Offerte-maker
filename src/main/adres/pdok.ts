import { controleerPostcode, ontleedHuisnummer, type Huisnummer } from '@shared/validatie';
import { log } from '../log';

// Straat en plaats opzoeken bij postcode en huisnummer via de PDOK Locatieserver (OFM-031, A-29).
// Alleen postcode en huisnummer verlaten de pc. De aanroep loopt in main met `fetch`; de CSP van de
// renderer (`connect-src 'none'`) blijft ongewijzigd. Nooit een fout naar de gebruiker: geen internet,
// time-out, een raar antwoord of geen treffer geeft `null`. Het log bevat nooit de waarden.

export const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
export const PDOK_TIMEOUT_MS = 5000;

export interface GevondenAdres {
  straat: string;
  plaats: string;
}

interface PdokDoc {
  straatnaam?: unknown;
  woonplaatsnaam?: unknown;
  huisletter?: unknown;
  huisnummertoevoeging?: unknown;
}

/** Basis-URL: `OFFERTE_MAKER_PDOK_URL` (nep-server in tests) of de echte Locatieserver. */
export function pdokUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env['OFFERTE_MAKER_PDOK_URL'] || PDOK_URL;
}

/** Zoek-URL: `fq=type:adres`, postcode zonder spatie en het huisnummer (zonder toevoeging). */
export function zoekUrl(basis: string, postcode: string, huisnummer: Huisnummer): string {
  const url = new URL(basis);
  url.searchParams.append('fq', 'type:adres');
  url.searchParams.append('fq', `postcode:${postcode.replace(' ', '')}`);
  url.searchParams.append('fq', `huisnummer:${huisnummer.nummer}`);
  url.searchParams.set('fl', 'straatnaam woonplaatsnaam huisletter huisnummertoevoeging');
  url.searchParams.set('rows', '20');
  return url.toString();
}

const tekst = (w: unknown): string => (typeof w === 'string' ? w.trim() : '');

/**
 * Kies het document dat bij de toevoeging past: één letter = huisletter (`12A`), anders de
 * huisnummertoevoeging (`12-2`); zonder toevoeging het adres zonder letter en toevoeging. Past niets
 * precies, dan het eerste (straat en plaats zijn voor alle toevoegingen van één nummer gelijk).
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

/** Haal straat en plaats uit het PDOK-antwoord (`response.docs`); `null` bij geen of onvolledige treffer. */
export function leesAntwoord(json: unknown, toevoeging: string): GevondenAdres | null {
  const docs = (json as { response?: { docs?: unknown } } | null)?.response?.docs;
  if (!Array.isArray(docs)) return null;
  const doc = kiesDoc(docs as PdokDoc[], toevoeging);
  const straat = tekst(doc?.straatnaam);
  const plaats = tekst(doc?.woonplaatsnaam);
  return straat !== '' && plaats !== '' ? { straat, plaats } : null;
}

type Fetch = typeof fetch;

/** `adres:zoek`. Invoer is al door het IPC-schema gecontroleerd; hier nogmaals, omdat dit de grens naar buiten is. */
export async function zoekAdres(
  invoer: { postcode: string; huisnummer: string },
  opties: { haal?: Fetch; basis?: string; timeoutMs?: number; nu?: () => number } = {},
): Promise<GevondenAdres | null> {
  const postcode = controleerPostcode(invoer.postcode);
  const huisnummer = ontleedHuisnummer(invoer.huisnummer);
  if (!postcode.geldig || postcode.waarde === '' || !huisnummer) return null;

  const haal = opties.haal ?? fetch;
  const nu = opties.nu ?? (() => performance.now());
  const start = nu();
  let uitkomst: GevondenAdres | null = null;
  let reden = 'niet gevonden';
  try {
    const antwoord = await haal(zoekUrl(opties.basis ?? pdokUrl(), postcode.waarde, huisnummer), {
      signal: AbortSignal.timeout(opties.timeoutMs ?? PDOK_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (antwoord.ok) uitkomst = leesAntwoord(await antwoord.json(), huisnummer.toevoeging);
    else reden = `niet gevonden (http ${antwoord.status})`;
  } catch (fout) {
    reden =
      fout instanceof Error && (fout.name === 'TimeoutError' || fout.name === 'AbortError')
        ? 'niet gevonden (time-out)'
        : 'niet gevonden (geen verbinding)';
  }
  log.info(`adres opgezocht: ${uitkomst ? 'gevonden' : reden}, ${Math.round(nu() - start)} ms`);
  return uitkomst;
}
