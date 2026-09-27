import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  maakTestMappen,
  nieuweOfferteTotStap4,
  overslaanWelkom,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';
import { controleerScherm } from '../helpers/toegankelijkheid';

// OFM-060: de tabbalk van Instellingen en de stappenbalk van de wizard blijven bovenaan in beeld bij
// scrollen (op het vensterminimum 1024 × 700, waar de tabbalk op twee regels staat). Met Shift+Tab
// terug omhoog verdwijnt geen veld achter de balk (scroll-padding-top = hoogte van de balk).

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

const w = nl.wizard;
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });
const kop = (page: Page, stap: number) =>
  page.getByRole('heading', { name: `${stap}. ${w.stappen[stap - 1]}` });

/** Vensterminimum; de app maximaliseert zelf bij ready-to-show, dus herhalen tot het past. */
async function klein(app: ElectronApplication, page: Page): Promise<void> {
  await expect
    .poll(async () => {
      await app.evaluate(({ BrowserWindow }) => {
        const venster = BrowserWindow.getAllWindows()[0];
        venster?.unmaximize();
        venster?.setContentSize(1024, 700);
      });
      // Op een scherm met schaalfactor kan het een paar pixels afwijken.
      return page.evaluate('window.innerHeight');
    })
    .toBeLessThanOrEqual(720);
}

const scrollNaarOnder = (page: Page) =>
  page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
const scrollY = (page: Page) => page.evaluate('window.scrollY');

/** Plek in viewport-pixels (boven- en onderkant). */
async function plek(el: Locator): Promise<{ boven: number; onder: number }> {
  const vak = await el.boundingBox();
  if (!vak) throw new Error('Element niet zichtbaar');
  return { boven: vak.y, onder: vak.y + vak.height };
}

test('tabbalk van Instellingen blijft in beeld; Shift+Tab verstopt geen veld achter de balk', async () => {
  gestart = await startApp(mappen);
  const { page, app } = gestart;
  await overslaanWelkom(page);
  await klein(app, page);
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.werkzaamheden).click();
  await knop(page, nl.werkzaamheden.allesOpenen).click();

  const tabs = page.getByRole('navigation', { name: nl.instellingen.tabs });
  // Twee regels op 1024 px breed.
  const tabsPlek = await plek(tabs);
  expect(tabsPlek.onder - tabsPlek.boven).toBeGreaterThan(100);
  const balk = page.locator('[class*="sticky"]', { has: tabs });
  await expect(balk).not.toHaveAttribute('data-vast');

  await scrollNaarOnder(page);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(1000);
  await expect(balk).toHaveAttribute('data-vast', 'true');
  const keuzelijsten = knop(page, nl.instellingen.tab.keuzelijsten);
  await expect(keuzelijsten).toBeInViewport();
  expect((await plek(tabs)).boven).toBeGreaterThanOrEqual(0);
  await controleerScherm(page, 'Instellingen Werkzaamheden gescrold met vaste tabbalk', []);

  // Van onderaf met Shift+Tab omhoog: elk gefocust element buiten de balk staat eronder.
  await page.locator('main').locator('button, input, select').last().focus();
  const onder = (await plek(balk)).onder;
  let gecontroleerd = 0;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Shift+Tab');
    if ((await balk.locator(':focus').count()) > 0) continue;
    const focus = page.locator(':focus');
    if ((await focus.count()) === 0) continue;
    expect((await plek(focus)).boven).toBeGreaterThanOrEqual(onder - 1);
    gecontroleerd++;
  }
  expect(gecontroleerd).toBeGreaterThan(20);

  // Een tab kiezen in het zichtbare gebied.
  await keuzelijsten.click();
  await expect(keuzelijsten).toHaveAttribute('aria-pressed', 'true');
});

test('stappenbalk van de wizard blijft in beeld; stap 1 kiezen na scrollen in stap 3', async () => {
  gestart = await startApp(mappen);
  const { page, app } = gestart;
  await overslaanWelkom(page);
  await klein(app, page);
  await nieuweOfferteTotStap4(page, { achternaam: 'Vast', plaats: 'Eindhoven' });

  const stappen = page.getByRole('navigation', { name: nl.componenten.stappen });
  await stappen.getByRole('button', { name: new RegExp(w.stappen[2] ?? '') }).click();
  await expect(kop(page, 3)).toBeVisible();
  await scrollNaarOnder(page);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(100);
  // De titel van de stap scrolt mee, de stappenbalk niet.
  await expect(kop(page, 3)).not.toBeInViewport();
  await expect(stappen).toBeInViewport();
  await controleerScherm(page, 'Wizard stap 3 gescrold met vaste stappenbalk', []);

  await stappen.getByRole('button', { name: new RegExp(w.stappen[0] ?? '') }).click();
  await expect(kop(page, 1)).toBeVisible();
});
