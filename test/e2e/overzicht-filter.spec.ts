import { execSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  appOmgeving,
  maakTestMappen,
  overslaanWelkom,
  REPO,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// OFM-053: filter op status en ordening op nummer in het hoofdscherm, met de seed (5.000 offertes,
// 2022–2026, 10 % concept). Filter en ordening gelden voor periode en zoeken en blijven staan.

const t = nl.overzicht;
const s = nl.componenten.status;
let mappen: TestMappen;
let gestart: GestarteApp | undefined;

test.beforeEach(async () => {
  test.setTimeout(120_000);
  mappen = maakTestMappen();
  const eerste = await startApp(mappen);
  await overslaanWelkom(eerste.page);
  await sluitApp(eerste.app);
  execSync('pnpm seed', { cwd: REPO, env: appOmgeving(mappen), encoding: 'utf8' });
});
test.afterEach(async () => {
  if (gestart) await sluitApp(gestart.app);
  gestart = undefined;
  mappen.opruimen();
});

const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });
const lijstKlaar = (page: Page) => page.locator('[data-lijst="periode"][aria-busy="false"]');
const rijen = (page: Page) => page.getByRole('list', { name: t.titel }).getByRole('listitem');

/** De tekst van de samenvatting onderaan ("12 offertes · …"). */
async function aantalInSamenvatting(page: Page): Promise<number> {
  const tekst = (await lijstKlaar(page).locator('footer p').textContent()) ?? '';
  return Number(/^(\d+)/.exec(tekst)?.[1]);
}

test('filter op Concept, ordening op nummer, blijft staan na periodewissel en geldt bij zoeken', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await lijstKlaar(page).locator('li').first().waitFor();
  const status = page.getByRole('group', { name: new RegExp(`^${t.filter.status}`) });
  await expect(status.getByRole('button', { name: t.filter.alle })).toHaveAttribute('aria-pressed', 'true');
  await expect(knop(page, t.filter.ordeningen.datum)).toHaveAttribute('aria-pressed', 'true');

  // Jaarweergave: genoeg concepten en genummerde offertes.
  await knop(page, t.weergave.jaar).click();
  await lijstKlaar(page).locator('li').first().waitFor();

  // Filter Concept: alleen concepten, telling klopt met de lijst en met main.
  await status.getByRole('button', { name: s.concept }).click();
  await expect(status.getByRole('button', { name: s.concept })).toHaveAttribute('aria-pressed', 'true');
  await expect(status.getByRole('button', { name: t.filter.alle })).toHaveAttribute('aria-pressed', 'false');
  await expect(status).toHaveAccessibleName(`${t.filter.status}: ${t.filter.statusAantal(1)}`);
  await expect(lijstKlaar(page)).toHaveCount(1);
  const aantal = await rijen(page).count();
  expect(aantal).toBeGreaterThan(0);
  await expect(rijen(page).filter({ hasText: s.concept })).toHaveCount(aantal);
  expect(await aantalInSamenvatting(page)).toBe(aantal);
  const label = await page.locator('h2[aria-live]').textContent();
  const jaar = /\d{4}/.exec(label ?? '')?.[0] ?? '2026';
  const main = await apiData(page, 'overzichtLijst', {
    weergave: 'jaar',
    datum: `${jaar}-01-01`,
    statussen: ['concept'],
  });
  expect(main.items.every((i) => i.status === 'concept')).toBe(true);
  expect(main.samenvatting.aantal).toBe(aantal);

  // Na een periodewissel staat het filter er nog.
  await knop(page, t.vorige).click();
  await expect(page.locator('h2[aria-live]')).not.toHaveText(label ?? '');
  await lijstKlaar(page).locator('li').first().waitFor();
  await expect(status.getByRole('button', { name: s.concept })).toHaveAttribute('aria-pressed', 'true');
  const nuAantal = await rijen(page).count();
  await expect(rijen(page).filter({ hasText: s.concept })).toHaveCount(nuAantal);
  expect(await aantalInSamenvatting(page)).toBe(nuAantal);

  // Filter weer uit (Alle), ordening Nummer oplopend: laagste nummer eerst, concepten onderaan.
  await status.getByRole('button', { name: t.filter.alle }).click();
  await knop(page, t.filter.ordeningen.nummer_op).click();
  await expect(knop(page, t.filter.ordeningen.nummer_op)).toHaveAttribute('aria-pressed', 'true');
  await expect(knop(page, t.filter.ordeningen.datum)).toHaveAttribute('aria-pressed', 'false');
  await expect(lijstKlaar(page)).toHaveCount(1);
  const vorigJaar = String(Number(jaar) - 1);
  const opNummer = await apiData(page, 'overzichtLijst', {
    weergave: 'jaar',
    datum: `${vorigJaar}-01-01`,
    ordening: 'nummer_op',
  });
  const genummerd = opNummer.items.filter((i) => i.nummer !== null);
  const concepten = opNummer.items.filter((i) => i.nummer === null);
  expect(genummerd.length).toBeGreaterThan(1);
  expect(concepten.length).toBeGreaterThan(0);
  // Concepten staan onderaan.
  expect(opNummer.items.slice(genummerd.length).every((i) => i.nummer === null)).toBe(true);
  // Genummerd oplopend (volgnummer per jaar = laatste deel van het nummer).
  const volg = genummerd.map((i) => Number(/(\d+)[a-z]?$/.exec(i.nummer ?? '')?.[1]));
  expect(volg).toEqual([...volg].sort((a, b) => a - b));
  // De app toont dezelfde volgorde: de eerste rij heeft het laagste nummer, de laatste is een concept.
  await expect(rijen(page).first()).toContainText(genummerd[0]?.nummer ?? '');
  await expect(rijen(page).last()).toContainText(t.concept);
  // Op nummer: geen maandgroepen in de jaarweergave.
  await expect(page.getByRole('list', { name: t.titel })).toHaveCount(1);

  // Zoeken volgt filter en ordening.
  await status.getByRole('button', { name: s.akkoord }).click();
  await page.getByRole('searchbox', { name: t.zoeken }).fill('Jansen');
  const zoek = page.locator('[data-lijst="zoek"][aria-busy="false"]');
  await expect(zoek).toHaveCount(1);
  const treffers = await zoek.getByRole('listitem').count();
  expect(treffers).toBeGreaterThan(0);
  await expect(zoek.getByRole('listitem').filter({ hasText: s.akkoord })).toHaveCount(treffers);
  expect(gestart.paginaFouten).toEqual([]);
});
