import { expect, test, type Page } from '@playwright/test';
import { WIZARD_PUNT_TEKSTEN } from '../../src/shared/teksten/wizardPunten';
import { VERPLICHT_VELDEN, type Verplicht } from '../../src/shared/verplicht';
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
import { controleerScherm } from '../helpers/toegankelijkheid';

// OFM-042: de oranje markering in de stappenbalk legt uit wat er mist — tooltip bij hover en focus
// (aria-describedby), weg bij Escape, klikken gaat naar de stap, het getal loopt live mee.

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
const c = nl.componenten;
const alleenAchternaam: Verplicht = {
  ...(Object.fromEntries(VERPLICHT_VELDEN.map((v) => [v, false])) as Verplicht),
  achternaam: true,
};
const kop = (page: Page, stap: number) =>
  page.getByRole('heading', { name: `${stap}. ${w.stappen[stap - 1]}` });

test('tooltip bij hover en focus, Escape, klikken en live aantal', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  // Alleen de achternaam verplicht in stap 1 (plus soort werk en dakvlak, altijd).
  await apiData(page, 'instellingenBewaar', { sleutel: 'verplicht', waarde: alleenAchternaam });
  await page.reload();
  await page.getByRole('button', { name: nl.overzicht.nieuweOfferte, exact: true }).click();
  await expect(kop(page, 1)).toBeVisible();

  const balk = page.getByRole('navigation', { name: c.stappen });
  const stap1 = balk.getByRole('button', { name: new RegExp(w.stappen[0] ?? '') });
  const stap2 = balk.getByRole('button', { name: new RegExp(w.stappen[1] ?? '') });
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toHaveCount(0);

  // Hover op stap 2: de punten van die stap, één regel per punt, gekoppeld via aria-describedby.
  await stap2.hover();
  await expect(tooltip).toHaveCount(1);
  await expect(tooltip).toHaveText(`${WIZARD_PUNT_TEKSTEN.soortWerk}${WIZARD_PUNT_TEKSTEN.dakvlak}`);
  await expect(stap2).toHaveAttribute('aria-describedby', (await tooltip.getAttribute('id')) ?? 'x');
  await expect(stap2).toHaveAccessibleDescription(
    new RegExp(`${WIZARD_PUNT_TEKSTEN.soortWerk}.*${WIZARD_PUNT_TEKSTEN.dakvlak}`),
  );
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);

  // Toetsenbordfocus op de huidige stap 1 (met markering een knop): tooltip; Escape: weg.
  await stap1.focus();
  await expect(tooltip).toHaveText(WIZARD_PUNT_TEKSTEN.achternaam);
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  await expect(kop(page, 1)).toBeVisible();

  // axe met de tooltip open (focus op stap 2 met Tab).
  await page.keyboard.press('Tab');
  await expect(stap2).toBeFocused();
  await expect(tooltip).toHaveCount(1);
  const uitkomst = await controleerScherm(page, 'Stappenbalk met tooltip', []);
  expect(uitkomst.axe).toEqual([]);
  expect(uitkomst.contrastfouten).toBe(0);

  // Het getal loopt live mee: achternaam invullen → stap 1 zonder markering (en zonder tooltip).
  await page.getByLabel(w.klant.achternaam, { exact: true }).fill('Jansen');
  await expect(balk.getByText(c.stapPunten(1))).toHaveCount(0);
  await expect(balk.getByText(c.stapPunten(2))).toBeVisible();

  // Klikken op de stap gaat naar die stap.
  await stap2.click();
  await expect(kop(page, 2)).toBeVisible();
  expect(gestart.paginaFouten).toEqual([]);
});
