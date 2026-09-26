import { expect, test, type Page } from '@playwright/test';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  maakTestMappen,
  nieuweOfferteTotStap4,
  overslaanWelkom,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';
import { controleerScherm, type Schermuitkomst } from '../helpers/toegankelijkheid';

// OFM-052: contextmenu op een offerte in het overzicht. Status op Verstuurd via het menu, uitgeschakelde
// items bij een concept (met reden), toetsenbord (Shift+F10, End, Escape met focus terug), het menu in
// de zoekweergave, verwijderen via het menu en terugzetten uit de prullenbak; axe met open menu.

let mappen: TestMappen;
let gestart: GestarteApp | undefined;
const uitkomsten: Schermuitkomst[] = [];

test.beforeEach(() => {
  mappen = maakTestMappen();
});
test.afterEach(async () => {
  if (gestart) await sluitApp(gestart.app);
  gestart = undefined;
  mappen.opruimen();
});

const w = nl.wizard;
const d = nl.detail;
const o = nl.overzicht;
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });
const rij = (page: Page, naam: string) => page.getByRole('button', { name: new RegExp(naam) });
const menu = (page: Page) => page.getByRole('menu');

test('contextmenu: status, uitgeschakelde items, toetsenbord, zoeken, verwijderen en terugzetten', async () => {
  gestart = await startApp(mappen, { modus: 'niet-ingelogd' });
  const { page } = gestart;
  await overslaanWelkom(page);

  // Een definitieve offerte (Menuman) en een concept dat nog niet gemaakt is (Klaasen).
  const id = await nieuweOfferteTotStap4(page, { achternaam: 'Menuman', plaats: 'Eindhoven' });
  await knop(page, w.maakZonderClaude).click();
  await expect(knop(page, d.maakDefinitief)).toBeVisible({ timeout: 15_000 });
  await knop(page, d.maakDefinitief).click();
  await expect(knop(page, d.openPdf)).toBeVisible({ timeout: 20_000 });
  await knop(page, d.terugNaarOverzicht).click();
  const conceptId = await nieuweOfferteTotStap4(page, { achternaam: 'Klaasen', plaats: 'Veldhoven' });
  await knop(page, w.terugNaarOverzicht).click();
  await expect(rij(page, 'Klaasen')).toBeVisible();

  // Rechtermuisknop op de definitieve offerte: menu met de status gemarkeerd; axe met open menu.
  await rij(page, 'Menuman').click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole('menuitemradio', { name: 'Klaar' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(menu(page).getByRole('menuitem', { name: d.verstuurPerMail })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await controleerScherm(page, 'Overzicht met contextmenu', uitkomsten);

  // Status op Verstuurd: menu dicht, lijst ververst (statuslabel), periode blijft.
  const periode = await page.locator('h2[aria-live]').textContent();
  await menu(page).getByRole('menuitemradio', { name: nl.componenten.status.verstuurd }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect(rij(page, 'Menuman')).toContainText(nl.componenten.status.verstuurd);
  expect((await apiData(page, 'offerteHaal', { id })).status).toBe('verstuurd');
  await expect(page.locator('h2[aria-live]')).toHaveText(periode ?? '');

  // Toetsenbord op het concept: Shift+F10 opent, de eerste regel heeft de focus; e-mail, map,
  // afdrukken en de status zijn uitgeschakeld met de reden; End → Verwijderen; Escape → focus op de rij.
  await rij(page, 'Klaasen').focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole('menuitemradio', { name: nl.componenten.status.concept })).toBeFocused();
  for (const naam of [d.verstuurPerMail, d.toonInMap, d.afdrukken]) {
    const item = menu(page).getByRole('menuitem', { name: naam });
    await expect(item).toHaveAttribute('aria-disabled', 'true');
    await expect(item).toHaveAccessibleDescription(o.menu.nietDefinitief);
  }
  await expect(menu(page).getByRole('menuitemradio', { name: 'Akkoord' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  // Een uitgeschakeld item doet niets en laat het menu open.
  await menu(page).getByRole('menuitem', { name: d.afdrukken }).click({ force: true });
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('End');
  await expect(menu(page).getByRole('menuitem', { name: d.verwijderen })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(menu(page).getByRole('menuitemradio', { name: nl.componenten.status.concept })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(rij(page, 'Klaasen')).toBeFocused();

  // Klik erbuiten sluit; maar één menu tegelijk.
  // Links op de ene rij en rechts op de andere, zodat het eerste menu de tweede klik niet afvangt.
  await rij(page, 'Klaasen').click({ button: 'right', position: { x: 20, y: 20 } });
  await rij(page, 'Menuman').click({ button: 'right', position: { x: 900, y: 20 } });
  await expect(menu(page)).toHaveCount(1);
  await expect(menu(page)).toHaveAccessibleName(o.menu.label('Dhr. J. Menuman'));
  await page.getByRole('heading', { name: nl.algemeen.appNaam }).click();
  await expect(menu(page)).toHaveCount(0);

  // Ook in de zoekweergave; verwijderen via het menu met dezelfde bevestiging als op Detail.
  await page.getByLabel(o.zoeken, { exact: true }).fill('Klaasen');
  await expect(page.getByText(o.zoekResultaten(1))).toBeVisible();
  await rij(page, 'Klaasen').click({ button: 'right' });
  await menu(page).getByRole('menuitem', { name: d.verwijderen }).click();
  const dialoog = page.getByRole('dialog');
  await expect(dialoog).toBeVisible();
  await dialoog.getByRole('button', { name: d.jaVerwijderen, exact: true }).click();
  await expect(page.getByText(o.geenTreffers)).toBeVisible();
  // De zoektekst blijft staan.
  await expect(page.getByLabel(o.zoeken, { exact: true })).toHaveValue('Klaasen');

  // Terugzetten uit de prullenbak.
  await page.getByRole('button', { name: o.prullenbak }).click();
  await page.getByRole('button', { name: nl.prullenbak.terugzettenVan('Dhr. J. Klaasen') }).click();
  await expect(page.getByText(nl.prullenbak.teruggezet('Dhr. J. Klaasen'))).toBeVisible();
  const lijst = await apiData(page, 'overzichtZoek', { tekst: 'Klaasen' });
  expect(lijst.map((x) => x.id)).toEqual([conceptId]);
});
