import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  appOmgeving,
  maakTestMappen,
  overslaanWelkom,
  REPO,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// Prestaties met de seed-gegevens (5.000 offertes, `pnpm seed`), gemeten op de ontwikkel-pc (V-24):
// - NFE-003: starten tot een bruikbaar hoofdscherm gemiddeld ≤ 5 s over 5 koude starts.
// - NFE-004: wisselen van periode, tab of zoekopdracht toont het resultaat binnen 300 ms (p95 over 50).
// De cijfers staan in het werklog van OFM-027.

const MAX_START_MS = 5_000;
const MAX_WISSEL_P95_MS = 300;
const AANTAL_WISSELS = 50;

let mappen: TestMappen;
let gestart: GestarteApp | undefined;
const metingen: Record<string, number[]> = {};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(120_000);
  mappen = maakTestMappen();
  // Eerste start: database aanmaken en het welkomstscherm afronden.
  const eerste = await startApp(mappen);
  await overslaanWelkom(eerste.page);
  await sluitApp(eerste.app);
  // `pnpm seed` in dezelfde datamap (de app draait dan niet).
  const uit = execSync('pnpm seed', { cwd: REPO, env: appOmgeving(mappen), encoding: 'utf8' });
  expect(uit).toContain('5000 offertes');
});

test.afterEach(async () => {
  if (gestart) await sluitApp(gestart.app);
  gestart = undefined;
});

test.afterAll(() => {
  mappen.opruimen();
  const regels = Object.entries(metingen).map(([naam, lijst]) => `${naam.padEnd(34)} ${samenvatting(lijst)}`);
  console.log(`\nPrestaties (ms):\n${regels.join('\n')}`);
});

function percentiel(lijst: number[], p: number): number {
  const gesorteerd = [...lijst].sort((a, b) => a - b);
  const index = Math.min(gesorteerd.length - 1, Math.ceil((p / 100) * gesorteerd.length) - 1);
  return gesorteerd[Math.max(0, index)] ?? NaN;
}

function samenvatting(lijst: number[]): string {
  const gem = lijst.reduce((a, b) => a + b, 0) / lijst.length;
  const r = (x: number) => Math.round(x);
  return (
    `n=${lijst.length} gem=${r(gem)} mediaan=${r(percentiel(lijst, 50))} p95=${r(percentiel(lijst, 95))} ` +
    `max=${r(Math.max(...lijst))}`
  );
}

function bewaar(naam: string, lijst: number[]): void {
  metingen[naam] = lijst;
  test.info().annotations.push({ type: naam, description: samenvatting(lijst) });
}

/** Van `_electron.launch` tot een hoofdscherm met geladen lijst (niet meer `aria-busy`). */
async function meetStart(vandaag: string): Promise<number> {
  const begin = performance.now();
  gestart = await startApp(mappen, { haken: [`vandaag=${vandaag}`] });
  await gestart.page
    .locator('[data-lijst="periode"][aria-busy="false"] li')
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await expect(gestart.page.getByRole('button', { name: nl.overzicht.nieuweOfferte })).toBeEnabled();
  const duur = performance.now() - begin;
  await sluitApp(gestart.app);
  gestart = undefined;
  return duur;
}

test('NFE-003: opstarttijd met 5.000 offertes', async () => {
  test.setTimeout(240_000);
  // Met dagelijkse back-up: elke start een nieuwe dag, dus §14.1 stap 4 maakt een back-up.
  const metBackup: number[] = [];
  for (let dag = 2; dag <= 6; dag++) metBackup.push(await meetStart(`2026-03-0${dag}`));
  const dagelijks = readdirSync(join(mappen.docs, 'Back-ups')).filter((n) => n.endsWith('-dagelijks.sqlite'));
  expect(dagelijks.length).toBeGreaterThanOrEqual(5);
  // Zonder: dezelfde dag als de laatste start, de back-up van vandaag bestaat al.
  const zonderBackup: number[] = [];
  for (let i = 0; i < 5; i++) zonderBackup.push(await meetStart('2026-03-06'));
  bewaar('start met dagelijkse back-up', metBackup);
  bewaar('start zonder back-up', zonderBackup);
  const gemiddeld = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
  expect(gemiddeld(metBackup)).toBeLessThanOrEqual(MAX_START_MS);
  expect(gemiddeld(zonderBackup)).toBeLessThanOrEqual(MAX_START_MS);
});

// Meethulp in de pagina: klikken of typen en het tijdstip vastleggen waarop het nieuwe resultaat in de
// DOM staat (MutationObserver, dus meteen na de React-commit; het schilderen volgt binnen één frame).
// Klaar = de lijst is niet meer `aria-busy` (keepPreviousData) en toont de nieuwe periode, of de
// zoekresultaten voor de nieuwe zoekterm staan er. Bewust geen requestAnimationFrame-polling: in sommige
// runs op de ontwikkel-pc kwamen frames maar eens per 1–2 s (venster zichtbaar en met focus; vermoedelijk
// geen vsync, bijvoorbeeld scherm in slaapstand), waardoor elke meting op 1 of 2 s uitkwam.
const MEETSCRIPT = `
(() => {
  function tot(voorwaarde) {
    return new Promise((klaar, fout) => {
      if (voorwaarde()) return klaar(performance.now());
      const waarnemer = new MutationObserver(() => {
        if (!voorwaarde()) return;
        const tijdstip = performance.now();
        waarnemer.disconnect();
        clearTimeout(wekker);
        klaar(tijdstip);
      });
      const wekker = setTimeout(() => {
        waarnemer.disconnect();
        fout(new Error('meting: time-out'));
      }, 10000);
      waarnemer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    });
  }
  const label = () => document.querySelector('h2[aria-live]')?.textContent ?? null;
  const lijstKlaar = (sel) => document.querySelector(sel)?.getAttribute('aria-busy') === 'false';
  const knopMet = (naam) =>
    Array.from(document.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === naam || b.textContent.trim() === naam,
    );
  window.__ofmMeet = {
    async klik(naam) {
      const oud = label();
      const knop = knopMet(naam);
      if (!knop) throw new Error('knop niet gevonden: ' + naam);
      const begin = performance.now();
      knop.click();
      return (await tot(() => label() !== oud && lijstKlaar('[data-lijst="periode"]'))) - begin;
    },
    async zoek(term) {
      const invoer = document.querySelector('input[type="search"]');
      const zet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      const begin = performance.now();
      zet.call(invoer, term);
      invoer.dispatchEvent(new Event('input', { bubbles: true }));
      return (await tot(() => lijstKlaar('[data-lijst="zoek"]'))) - begin;
    },
    async wis() {
      const invoer = document.querySelector('input[type="search"]');
      const zet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      zet.call(invoer, '');
      invoer.dispatchEvent(new Event('input', { bubbles: true }));
      await tot(() => !document.querySelector('[data-lijst="zoek"]') && lijstKlaar('[data-lijst="periode"]'));
    },
  };
})();
`;

interface Meet {
  __ofmMeet: {
    klik: (naam: string) => Promise<number>;
    zoek: (t: string) => Promise<number>;
    wis: () => Promise<void>;
  };
}

/** Venster naar voren: de meting gaat over de app zoals de gebruiker hem voor zich ziet. */
async function naarVoren(app: GestarteApp['app']): Promise<void> {
  await app.evaluate(({ BrowserWindow }) => {
    const venster = BrowserWindow.getAllWindows()[0];
    venster?.show();
    venster?.moveTop();
    venster?.focus();
  });
}

const klik = (page: Page, naam: string) =>
  page.evaluate((n) => (globalThis as unknown as Meet).__ofmMeet.klik(n), naam);
const zoek = (page: Page, term: string) =>
  page.evaluate((t) => (globalThis as unknown as Meet).__ofmMeet.zoek(t), term);
const wis = (page: Page) => page.evaluate(() => (globalThis as unknown as Meet).__ofmMeet.wis());

test('NFE-004: wisselen van periode, tab en zoekopdracht', async () => {
  test.setTimeout(240_000);
  gestart = await startApp(mappen);
  const { page } = gestart;
  const t = nl.overzicht;
  await page.locator('[data-lijst="periode"][aria-busy="false"] li').first().waitFor();
  await page.evaluate(MEETSCRIPT);
  await naarVoren(gestart.app);

  // Periode: 50 × vorige maand (sept. 2026 → juli 2022), elke keer een nieuwe periode.
  const periode: number[] = [];
  for (let i = 0; i < AANTAL_WISSELS; i++) periode.push(await klik(page, t.vorige));

  // Tab: 50 wissels Jaar → Dag → Week → Maand → …; vóór elke wissel (behalve vanuit Jaar) één periode
  // terug, zodat elke combinatie van tab en datum nieuw is en niet uit de cache komt.
  await klik(page, t.weergave.dag);
  await page.getByRole('button', { name: t.vandaag }).click();
  await klik(page, t.weergave.maand);
  const volgorde = ['jaar', 'dag', 'week', 'maand'] as const;
  let huidig: (typeof volgorde)[number] = 'maand';
  const tab: number[] = [];
  for (let i = 0; i < AANTAL_WISSELS; i++) {
    const volgende = volgorde[i % volgorde.length] ?? 'jaar';
    if (huidig !== 'jaar') await klik(page, t.vorige);
    tab.push(await klik(page, t.weergave[volgende]));
    huidig = volgende;
  }

  // Zoeken: 50 verschillende zoektermen (achternamen, plaatsen, nummers), telkens vanuit een leeg veld.
  const termen = [
    'Jansen',
    'de Vries',
    'Bakker',
    'Visser',
    'Smit',
    'Meijer',
    'de Boer',
    'Mulder',
    'de Groot',
    'Bos',
    'Vos',
    'Peters',
    'Hendriks',
    'Dekker',
    'Brouwer',
    'de Wit',
    'Dijkstra',
    'Smits',
    'de Graaf',
    'Kok',
    'Jacobs',
    'de Haan',
    'Vermeulen',
    'Schouten',
    'Willems',
    'Hoekstra',
    'Koster',
    'Prins',
    'Maas',
    'Verhoeven',
    'Eindhoven',
    'Veldhoven',
    'Best',
    'Nuenen',
    'Geldrop',
    'Helmond',
    'Tilburg',
    'Breda',
    'Oss',
    'Weert',
    '2022-0',
    '2023-1',
    '2024-05',
    '2025-2',
    '2026-3',
    'J. ',
    'B. Kok',
    'van',
    'Bedrijf',
    'ho',
  ];
  expect(termen).toHaveLength(AANTAL_WISSELS);
  const zoeken: number[] = [];
  await naarVoren(gestart.app);
  for (const term of termen) {
    zoeken.push(await zoek(page, term));
    await wis(page);
  }

  test.info().annotations.push({
    type: 'zoeken per term',
    description: termen.map((term, i) => `${term}=${Math.round(zoeken[i] ?? 0)}`).join(' '),
  });
  bewaar('periode (◀, maandweergave)', periode);
  bewaar('tab (dag/week/maand/jaar)', tab);
  bewaar('zoeken (incl. 200 ms debounce)', zoeken);
  bewaar(
    'zoeken (zonder debounce)',
    zoeken.map((z) => z - 200),
  );
  bewaar('alle 150 wissels', [...periode, ...tab, ...zoeken]);

  expect(percentiel(periode, 95)).toBeLessThanOrEqual(MAX_WISSEL_P95_MS);
  expect(percentiel(tab, 95)).toBeLessThanOrEqual(MAX_WISSEL_P95_MS);
  expect(percentiel(zoeken, 95)).toBeLessThanOrEqual(MAX_WISSEL_P95_MS);
  expect(gestart.paginaFouten).toEqual([]);
});
