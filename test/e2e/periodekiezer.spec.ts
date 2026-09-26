import { expect, test, type Page } from '@playwright/test';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  maakTestMappen,
  overslaanWelkom,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';
import { controleerScherm, type Schermuitkomst } from '../helpers/toegankelijkheid';

// OFM-037: de periodekiezer op het hoofdscherm. Per weergave één keuze (muis of toetsenbord) en de
// lijst ziet veranderen; Escape en klikken buiten sluiten zonder wijziging; Vandaag in de kiezer;
// axe en de stijlcontrole op elke variant van de kiezer. Vandaag is 2026-09-25 (testhaak).

const t = nl.overzicht;
const k = t.kiezer;
const uitkomsten: Schermuitkomst[] = [];
let mappen: TestMappen;
let gestart: GestarteApp | undefined;

test.beforeEach(() => {
  mappen = maakTestMappen();
});
test.afterEach(async () => {
  if (gestart) await sluitApp(gestart.app);
  gestart = undefined;
  mappen.opruimen();
});

/** Een concept met klantnaam en offertedatum, direct via de API. */
async function offerteOp(page: Page, naam: string, offertedatum: string): Promise<void> {
  const { id } = await apiData(page, 'offerteNieuw', {});
  const { klant } = await apiData(page, 'offerteHaal', { id });
  await apiData(page, 'offerteBewaarInvoer', {
    id,
    klant: { ...klant, naam, adres: { ...klant.adres, plaats: 'Eindhoven' } },
    offertedatum,
  });
}

const periodeLabel = (page: Page) => page.locator('h2[aria-live]');
const lijst = (page: Page) => page.locator('[data-lijst="periode"][aria-busy="false"]');
const kiezer = (page: Page) => page.getByRole('dialog');

async function verwachtLijst(page: Page, label: RegExp | string, namen: string[]): Promise<void> {
  await expect(periodeLabel(page)).toHaveText(label);
  if (namen.length === 0) {
    await expect(page.getByText(t.leeg)).toBeVisible();
    return;
  }
  await expect(lijst(page).getByRole('listitem')).toHaveCount(namen.length);
  for (const naam of namen)
    await expect(lijst(page).getByRole('listitem').filter({ hasText: naam })).toHaveCount(1);
}

async function kiesWeergave(page: Page, naam: string): Promise<void> {
  await page.getByRole('button', { name: naam, exact: true }).click();
}

test('per weergave een periode kiezen; Escape, buiten klikken en Vandaag', async () => {
  test.setTimeout(120_000);
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  await offerteOp(page, 'Septemberklant', '2026-09-25');
  await offerteOp(page, 'Augustusklant', '2026-08-12');
  await offerteOp(page, 'Maartklant', '2025-03-10');
  await offerteOp(page, 'Oudeklant', '2019-06-01');
  await page.reload();
  await verwachtLijst(page, 'september 2026', ['Septemberklant']);

  // Maand: klikken op het periodelabel opent de kiezer; augustus kiezen.
  await periodeLabel(page).getByRole('button').click();
  await expect(kiezer(page)).toBeVisible();
  await expect(kiezer(page).getByRole('heading', { name: k.titel.maand })).toBeVisible();
  await expect(kiezer(page).getByRole('button', { name: 'september 2026' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await controleerScherm(page, 'Periodekiezer maand', uitkomsten);
  await kiezer(page).getByRole('button', { name: 'augustus 2026' }).click();
  await expect(kiezer(page)).toBeHidden();
  await verwachtLijst(page, 'augustus 2026', ['Augustusklant']);

  // Maand: bladeren naar een ander jaar met de kalenderknop, dan maart 2025.
  await page.getByRole('button', { name: t.kiesPeriode, exact: true }).click();
  await kiezer(page).getByRole('button', { name: k.vorigJaar }).click();
  await expect(kiezer(page).getByText('2025', { exact: true })).toBeVisible();
  await kiezer(page).getByRole('button', { name: 'maart 2025' }).click();
  await verwachtLijst(page, 'maart 2025', ['Maartklant']);

  // Dag: maandkalender; 12 augustus 2026 kiezen via ▶ in de kiezer.
  await kiesWeergave(page, t.weergave.dag);
  await expect(periodeLabel(page)).toHaveText('zaterdag 1 maart 2025');
  await page.getByRole('button', { name: t.kiesPeriode, exact: true }).click();
  await expect(kiezer(page).getByRole('heading', { name: k.titel.dag })).toBeVisible();
  await controleerScherm(page, 'Periodekiezer dag', uitkomsten);
  // Vandaag in de kiezer springt naar vandaag.
  await kiezer(page).getByRole('button', { name: k.vandaag, exact: true }).click();
  await verwachtLijst(page, 'vrijdag 25 september 2026', ['Septemberklant']);
  await page.getByRole('button', { name: t.kiesPeriode, exact: true }).click();
  await kiezer(page).getByRole('button', { name: k.vorigeMaand }).click();
  await kiezer(page).getByRole('button', { name: 'woensdag 12 augustus 2026' }).click();
  await verwachtLijst(page, 'woensdag 12 augustus 2026', ['Augustusklant']);

  // Dag met het toetsenbord: de focus staat op de gekozen dag; ← en Enter kiest 11 augustus.
  await periodeLabel(page).getByRole('button').click();
  await expect(kiezer(page).getByRole('button', { name: 'woensdag 12 augustus 2026' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(kiezer(page).getByRole('button', { name: 'dinsdag 11 augustus 2026' })).toBeFocused();
  await page.keyboard.press('Enter');
  await verwachtLijst(page, 'dinsdag 11 augustus 2026', []);

  // Week: Escape en klikken buiten sluiten zonder wijziging.
  await kiesWeergave(page, t.weergave.week);
  await expect(periodeLabel(page)).toHaveText(/^week 33 · /);
  await page.getByRole('button', { name: t.kiesPeriode, exact: true }).click();
  await expect(kiezer(page).getByRole('heading', { name: k.titel.week })).toBeVisible();
  await controleerScherm(page, 'Periodekiezer week', uitkomsten);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(kiezer(page)).toBeHidden();
  await expect(periodeLabel(page)).toHaveText(/^week 33 · /);
  await page.getByRole('button', { name: t.kiesPeriode, exact: true }).click();
  await expect(kiezer(page)).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(kiezer(page)).toBeHidden();
  await expect(periodeLabel(page)).toHaveText(/^week 33 · /);
  await expect(lijst(page).getByRole('listitem').filter({ hasText: 'Augustusklant' })).toHaveCount(1);

  // Week met het toetsenbord: ↓ ↓ Enter → week 35; dan met de muis week 39 (ISO, ma–zo).
  await page.getByRole('button', { name: t.kiesPeriode, exact: true }).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await verwachtLijst(page, /^week 35 · 24 – 30 aug 2026$/, []);
  await page.getByRole('button', { name: t.kiesPeriode, exact: true }).click();
  await kiezer(page).getByRole('button', { name: k.volgendeMaand }).click();
  await kiezer(page).getByRole('button', { name: 'week 39 · 21 – 27 sep 2026' }).click();
  await verwachtLijst(page, /^week 39 · /, ['Septemberklant']);

  // Jaar: lijst van jaren (tien jaar terug tot volgend jaar); 2019 kiezen.
  await kiesWeergave(page, t.weergave.jaar);
  await expect(periodeLabel(page)).toHaveText('2026');
  await periodeLabel(page).getByRole('button').click();
  await expect(kiezer(page).getByRole('heading', { name: k.titel.jaar })).toBeVisible();
  const jaren = kiezer(page).locator('[data-sleutel]');
  await expect(jaren).toHaveCount(12);
  await expect(jaren.first()).toHaveText('2016');
  await expect(jaren.last()).toHaveText('2027');
  await controleerScherm(page, 'Periodekiezer jaar', uitkomsten);
  await kiezer(page).getByRole('button', { name: '2019', exact: true }).click();
  await verwachtLijst(page, '2019', ['Oudeklant']);

  // Jaar met het toetsenbord: → → Enter → 2021.
  await page.getByRole('button', { name: t.kiesPeriode, exact: true }).click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await verwachtLijst(page, '2021', []);

  expect(gestart.paginaFouten).toEqual([]);
});
