import { expect, test } from '@playwright/test';
import { KEUZE_STARTSET } from '../../src/shared/keuzelijsten';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  maakTestMappen,
  overslaanWelkom,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// GetalVeld (OFM-032): bij focus alles selecteren, leegmaken kan, plakken met duizendtallen.

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

test('getalveld: overschrijven bij focus, leegmaken en plakken', async () => {
  const w = nl.wizard;
  gestart = await startApp(mappen);
  const page = gestart.page;
  await overslaanWelkom(page);

  await page.getByRole('button', { name: nl.overzicht.nieuweOfferte }).click();
  await page.getByLabel(w.klant.achternaam, { exact: true }).fill('Getal');
  await page.getByLabel(nl.componenten.adres.plaats, { exact: true }).fill('Veldhoven');
  await expect(page.getByRole('heading', { name: `1. ${w.stappen[0]}` })).toBeVisible();
  await page.getByRole('button', { name: w.volgende, exact: true }).click();
  const platLabel = KEUZE_STARTSET.soortDak[0]?.label ?? '';
  const plat = platLabel.charAt(0).toUpperCase() + platLabel.slice(1);
  await page.getByRole('button', { name: plat, exact: true }).click();

  const lengte = page.getByLabel(w.dak.lengte, { exact: true });
  const breedte = page.getByLabel(w.dak.breedte, { exact: true });
  await expect(lengte).toHaveAttribute('placeholder', '0');
  await expect(lengte).toHaveAttribute('inputmode', 'decimal');

  // Toetsenbord: terug naar het veld met Shift+Tab selecteert alles; typen vervangt de waarde.
  await lengte.click();
  await page.keyboard.type('8');
  await page.keyboard.press('Tab');
  await expect(breedte).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.type('12');
  await expect(lengte).toHaveValue('12');

  // Muis: klikken selecteert ook alles.
  await breedte.click();
  await lengte.click();
  await page.keyboard.type('3');
  await expect(lengte).toHaveValue('3');

  // Leegmaken kan; het veld blijft leeg na verlaten (placeholder 0), er komt geen 0 terug.
  await page.keyboard.press('Backspace');
  await expect(lengte).toHaveValue('');
  await page.keyboard.press('Tab');
  await expect(lengte).toHaveValue('');

  // Plakken met duizendtallen; bij verlaten genormaliseerd zonder scheidingsteken.
  await lengte.click();
  await page.keyboard.insertText('1.234,50');
  await expect(lengte).toHaveValue('1234,50');
  await page.keyboard.press('Tab');
  await expect(lengte).toHaveValue('1234,5');
  await lengte.click();
  await page.keyboard.insertText('1234.50');
  await page.keyboard.press('Tab');
  await expect(lengte).toHaveValue('1234,5');

  // Een minteken wordt geweigerd.
  await lengte.click();
  await page.keyboard.type('-4');
  await expect(lengte).toHaveValue('4');
  expect(gestart.paginaFouten).toEqual([]);
});
