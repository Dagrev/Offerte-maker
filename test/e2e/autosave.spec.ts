import { expect, test } from '@playwright/test';
import { KEUZE_STARTSET } from '../../src/shared/keuzelijsten';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  killHard,
  maakTestMappen,
  offerteIdVan,
  overslaanWelkom,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// Autosave-kill-test (NFE-011, FE-025): invoer, 1,5 s wachten, het proces hard beëindigen, herstarten.
// De invoer is er nog en het concept opent op de juiste stap.

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

test('invoer overleeft een harde kill en het concept opent op stap 2', async () => {
  const w = nl.wizard;
  gestart = await startApp(mappen);
  let page = gestart.page;
  await overslaanWelkom(page);

  await page.getByRole('button', { name: nl.overzicht.nieuweOfferte }).click();
  await page.getByLabel(w.klant.naam, { exact: true }).fill('Bakker');
  await page.getByLabel(nl.componenten.adres.plaats, { exact: true }).fill('Veldhoven');
  await page.getByRole('button', { name: w.volgende, exact: true }).click();
  await expect(page.getByRole('heading', { name: `2. ${w.stappen[1]}` })).toBeVisible();
  const platLabel = KEUZE_STARTSET.soortDak[0]?.label ?? '';
  const plat = platLabel.charAt(0).toUpperCase() + platLabel.slice(1);
  await page.getByRole('button', { name: plat, exact: true }).click();
  await page.getByLabel(w.dak.lengte, { exact: true }).fill('8');
  await page.getByLabel(w.dak.breedte, { exact: true }).fill('5');

  // 1,5 s wachten en dan hard stoppen: geen before-quit, geen nette afsluiting.
  await page.waitForTimeout(1_500);
  await killHard(gestart.app);
  gestart = undefined;

  gestart = await startApp(mappen);
  page = gestart.page;
  const rij = page.getByRole('listitem').filter({ hasText: 'Bakker' });
  await expect(rij).toContainText(nl.overzicht.concept);
  await rij.click();
  await expect(page.getByRole('heading', { name: `2. ${w.stappen[1]}` })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^${plat}`) })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel(w.dak.lengte, { exact: true })).toHaveValue('8');
  await expect(page.getByLabel(w.dak.breedte, { exact: true })).toHaveValue('5');

  const detail = await apiData(page, 'offerteHaal', { id: await offerteIdVan(page, 'Bakker') });
  expect(detail.klant.naam).toBe('Bakker');
  expect(detail.klant.adres.plaats).toBe('Veldhoven');
  expect(detail.wizardStap).toBe(2);
  expect(detail.invoer.soortDak).toBe('plat');
  expect(gestart.paginaFouten).toEqual([]);
});
