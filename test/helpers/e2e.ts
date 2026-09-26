import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import type { Api, OfferteLijstItem } from '../../src/shared/types';
import { nl } from '../../src/renderer/src/teksten/nl';
import { KEUZE_STARTSET } from '../../src/shared/keuzelijsten';

// E2E-hulp (OFM-027, TDO §15.4): start de gebouwde app (`out/`, na `pnpm build`) via Playwright
// `_electron` met eigen data- en documentenmap (eigen single-instance-lock, OFM-002), de nep-CLI
// (§15.2) en testhaken (§3). Testhaken werken alleen in de niet-verpakte app (OFM-026).

export const REPO = resolve(import.meta.dirname, '..', '..');
export const NEP_CLAUDE = join(REPO, 'test', 'fake-claude', 'fake-claude.mjs');
export const TEST_VANDAAG = '2026-09-25';

export interface TestMappen {
  root: string;
  data: string;
  docs: string;
  /** FAKE_CLAUDE_LOG: één JSON-regel per aanroep van de nep-CLI. */
  claudeLog: string;
  opruimen: () => void;
}

export function maakTestMappen(): TestMappen {
  const root = mkdtempSync(join(tmpdir(), 'ofm-e2e-'));
  return {
    root,
    data: join(root, 'data'),
    docs: join(root, 'docs'),
    claudeLog: join(root, 'nep-claude.jsonl'),
    opruimen: () => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
  };
}

/** Poort 9 (discard) op de eigen pc: de verbinding wordt meteen geweigerd. */
export const GEEN_PDOK = 'http://127.0.0.1:9/pdok';

export interface NepPdok {
  url: string;
  /** Ontvangen zoekopdrachten (alleen de `fq`-parameters). */
  verzoeken: string[][];
  stop: () => Promise<void>;
}

/**
 * Nep-PDOK voor E2E (OFM-031): een lokale HTTP-server die antwoordt als de Locatieserver. `adressen`
 * gaat van `postcode:1234AB huisnummer:12` naar straat en plaats; al het andere is "geen treffer".
 */
export async function startNepPdok(
  adressen: Record<string, { straat: string; plaats: string }>,
): Promise<NepPdok> {
  const verzoeken: string[][] = [];
  const server = createServer((req, res) => {
    const fq = new URL(req.url ?? '/', 'http://x').searchParams.getAll('fq');
    verzoeken.push(fq);
    const gevonden = adressen[fq.filter((f) => f !== 'type:adres').join(' ')];
    const docs = gevonden ? [{ straatnaam: gevonden.straat, woonplaatsnaam: gevonden.plaats }] : [];
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ response: { numFound: docs.length, docs } }));
  });
  await new Promise<void>((klaar) => server.listen(0, '127.0.0.1', klaar));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/bzk/locatieserver/search/v3/free`,
    verzoeken,
    stop: () =>
      new Promise<void>((klaar) => {
        server.closeAllConnections();
        server.close(() => klaar());
      }),
  };
}

export interface StartOpties {
  /** FAKE_CLAUDE_MODE (standaard `ok`). */
  modus?: string;
  /** Testhaken; standaard alleen `vandaag=2026-09-25`. */
  haken?: string[];
  /** Overschrijft OFFERTE_MAKER_CLAUDE_CMD, bijvoorbeeld met een niet-bestaand bestand. */
  claudeCmd?: string;
  /**
   * OFFERTE_MAKER_PDOK_URL (OFM-031). Standaard een lokaal adres waar niets luistert: geen enkele
   * E2E-test zoekt echt bij PDOK, adressen zijn dan "niet gevonden". Zie `startNepPdok`.
   */
  pdokUrl?: string;
}

export interface GestarteApp {
  app: ElectronApplication;
  page: Page;
  /** Onafgevangen fouten in de renderer (pageerror). */
  paginaFouten: string[];
}

export function appOmgeving(mappen: TestMappen, opties: StartOpties = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  delete env['ELECTRON_RUN_AS_NODE'];
  return {
    ...env,
    OFFERTE_MAKER_DATA: mappen.data,
    OFFERTE_MAKER_DOCS: mappen.docs,
    OFFERTE_MAKER_CLAUDE_CMD: opties.claudeCmd ?? NEP_CLAUDE,
    FAKE_CLAUDE_MODE: opties.modus ?? 'ok',
    FAKE_CLAUDE_LOG: mappen.claudeLog,
    OFFERTE_MAKER_PDOK_URL: opties.pdokUrl ?? GEEN_PDOK,
    OFFERTE_MAKER_TESTHAAK: (opties.haken ?? [`vandaag=${TEST_VANDAAG}`]).join(','),
  };
}

/** Start de gebouwde app (argument `'.'`, zoals OFM-014/015) en wacht op het eerste venster. */
export async function startApp(mappen: TestMappen, opties: StartOpties = {}): Promise<GestarteApp> {
  const app = await _electron.launch({ args: ['.'], cwd: REPO, env: appOmgeving(mappen, opties) });
  const page = await app.firstWindow();
  const paginaFouten: string[] = [];
  page.on('pageerror', (fout) => paginaFouten.push(fout.message));
  await page.waitForLoadState('domcontentloaded');
  return { app, page, paginaFouten };
}

/** Sluit netjes; valt terug op hard stoppen als de app niet binnen 10 s dicht is. */
export async function sluitApp(app: ElectronApplication): Promise<void> {
  const proces = app.process();
  await Promise.race([app.close(), new Promise((klaar) => setTimeout(klaar, 10_000))]).catch(() => undefined);
  if (proces.exitCode === null) proces.kill();
}

/**
 * Hard stoppen (NFE-011): de hele procesboom in één keer, zoals Taakbeheer of stroomuitval. Alleen het
 * hoofdproces killen laat op Windows de GPU- en rendererprocessen nog even leven; die houden de
 * single-instance-lock en de cache van de datamap vast, waardoor een directe herstart stopt.
 */
export async function killHard(app: ElectronApplication): Promise<void> {
  const proces = app.process();
  const weg = new Promise((klaar) => proces.once('exit', klaar));
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(proces.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    proces.kill('SIGKILL');
  }
  await weg;
}

/** Roept een kanaal aan via `window.api` in de renderer (voor voorbereiding en controles). */
export async function api<N extends keyof Api>(
  page: Page,
  naam: N,
  invoer?: Parameters<Api[N]>[0],
): Promise<Awaited<ReturnType<Api[N]>>> {
  return (await page.evaluate(
    ([n, i]) => {
      const venster = globalThis as unknown as { api: Record<string, (x?: unknown) => Promise<unknown>> };
      const functie = venster.api[n];
      if (!functie) throw new Error(`Onbekend kanaal ${n}`);
      return functie(i);
    },
    [naam as string, invoer as unknown] as const,
  )) as Awaited<ReturnType<Api[N]>>;
}

/** Zoals `api`, maar gooit bij `{ ok: false }` en geeft `data` terug. */
export async function apiData<N extends keyof Api>(
  page: Page,
  naam: N,
  invoer?: Parameters<Api[N]>[0],
): Promise<Extract<Awaited<ReturnType<Api[N]>>, { ok: true }>['data']> {
  const uitkomst = (await api(page, naam, invoer)) as
    { ok: true; data: unknown } | { ok: false; fout: { code: string } };
  if (!uitkomst.ok) throw new Error(`${String(naam)} gaf ${uitkomst.fout.code}`);
  return uitkomst.data as Extract<Awaited<ReturnType<Api[N]>>, { ok: true }>['data'];
}

/** Welkomstscherm overslaan (OFM-023) met een bedrijfsnaam, en naar het hoofdscherm. */
export async function overslaanWelkom(page: Page, bedrijfsnaam = 'Dakwerken Test'): Promise<void> {
  const { bedrijf } = await apiData(page, 'instellingenHaal');
  const { logoBestandId, logoDataUri, ...velden } = bedrijf;
  void logoBestandId;
  void logoDataUri;
  await apiData(page, 'instellingenBewaar', {
    sleutel: 'bedrijf',
    waarde: { ...velden, naam: bedrijfsnaam },
  });
  await apiData(page, 'welkomVoltooi');
  await page.reload();
  await expect(page.getByRole('button', { name: nl.overzicht.nieuweOfferte })).toBeVisible();
}

/** Aanroepen van de nep-CLI; `alleenP` telt alleen de echte opdrachten (`-p`), niet versie/status. */
export function nepClaudeAanroepen(
  mappen: TestMappen,
  alleenP = true,
): { args: string[]; stdin: string; pid: number }[] {
  if (!existsSync(mappen.claudeLog)) return [];
  return readFileSync(mappen.claudeLog, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((r) => JSON.parse(r) as { args: string[]; stdin: string; pid: number })
    .filter((a) => !alleenP || a.args.includes('-p'));
}

export interface KlantInvoer {
  naam: string;
  plaats: string;
  overig?: string;
}

/**
 * Hoofdscherm → Maak nieuwe offerte → stap 1 (naam, plaats) → stap 2 (soort werk en een dakvlak, want
 * die zijn sinds OFM-035 nodig om te maken) → stap 4 (optioneel Overig).
 * Geeft het offerte-ID terug.
 */
export async function nieuweOfferteTotStap4(page: Page, klant: KlantInvoer): Promise<string> {
  const w = nl.wizard;
  await page.getByRole('button', { name: nl.overzicht.nieuweOfferte }).click();
  await expect(page.getByRole('heading', { name: `1. ${w.stappen[0]}` })).toBeVisible();
  await page.getByLabel(w.klant.naam, { exact: true }).fill(klant.naam);
  await page.getByLabel(nl.componenten.adres.plaats, { exact: true }).fill(klant.plaats);
  for (let stap = 2; stap <= 4; stap++) {
    await page.getByRole('button', { name: w.volgende, exact: true }).click();
    await expect(page.getByRole('heading', { name: `${stap}. ${w.stappen[stap - 1]}` })).toBeVisible();
    if (stap === 2) await vulDakIn(page);
  }
  if (klant.overig !== undefined) {
    await page.getByLabel(w.overig.vraag, { exact: true }).fill(klant.overig);
  }
  return offerteIdVan(page, klant.naam);
}

/** Stap 2: soort werk "Dak vervangen" en dakvlak 8 × 5 m (het minimum om te mogen maken, OFM-035). */
export async function vulDakIn(page: Page): Promise<void> {
  const soortWerk = KEUZE_STARTSET.soortWerk.find((o) => o.sleutel === 'dak_vervangen')?.label ?? '';
  await page.getByRole('button', { name: soortWerk, exact: true }).click();
  await page.getByLabel(nl.wizard.dak.lengte, { exact: true }).fill('8');
  await page.getByLabel(nl.wizard.dak.breedte, { exact: true }).fill('5');
}

/** ID van de (enige) offerte met deze klantnaam, via `overzicht:zoek`. */
export async function offerteIdVan(page: Page, naam: string): Promise<string> {
  const lijst: OfferteLijstItem[] = await apiData(page, 'overzichtZoek', { tekst: naam });
  const item = lijst.find((o) => o.klantWeergave.includes(naam));
  if (!item) throw new Error(`Geen offerte gevonden voor ${naam}`);
  return item.id;
}

/** Of een proces (nog) bestaat. */
export function procesLeeft(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
