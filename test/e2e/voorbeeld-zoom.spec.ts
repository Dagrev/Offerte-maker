import { expect, test, type Page } from '@playwright/test';
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

// OFM-054: het voorbeeld op het detailscherm opent Passend (de hele eerste pagina zichtbaar op
// 1024 × 700) en zoomt met −/+, Passend, 100 %, Ctrl+scroll en Ctrl +/−/0; de stand blijft staan.

const z = nl.componenten.zoom;
const A4_BREEDTE = 794;
const A4_HOOGTE = 1123;
/** Het deel van een scrollend element dat de test leest (geen DOM-typen in de testconfig). */
interface Scrollvak {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
  scrollTo: (x: number, y: number) => void;
}

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

const houder = (page: Page) => page.getByRole('group', { name: nl.componenten.pdfVoorbeeld });
const werkbalk = (page: Page) => page.getByRole('toolbar', { name: z.werkbalk });
const knop = (page: Page, naam: string) => werkbalk(page).getByRole('button', { name: naam, exact: true });

async function schaal(page: Page): Promise<number> {
  return Number(await houder(page).getAttribute('data-schaal'));
}

async function percentage(page: Page): Promise<number> {
  const tekst = (await werkbalk(page).locator('[aria-live="polite"]').textContent()) ?? '';
  return Number(/(\d+) %/.exec(tekst)?.[1]);
}

function pixelRatio(page: Page): Promise<number> {
  return page.evaluate(() => (globalThis as unknown as { devicePixelRatio: number }).devicePixelRatio);
}

test('passend op 1024 × 700, zoomknoppen, Ctrl+scroll en Ctrl-toetsen, hele document scrollbaar', async () => {
  gestart = await startApp(mappen);
  const { page, app } = gestart;
  await expect
    .poll(async () => {
      await app.evaluate(({ BrowserWindow }) => {
        const venster = BrowserWindow.getAllWindows()[0];
        venster?.unmaximize();
        venster?.setContentSize(1024, 700);
      });
      return page.evaluate(() => (globalThis as unknown as { innerHeight: number }).innerHeight);
    })
    .toBeLessThanOrEqual(700);
  await overslaanWelkom(page);
  await nieuweOfferteTotStap4(page, { achternaam: 'Zoom', plaats: 'Eindhoven' });
  await page.getByRole('button', { name: nl.wizard.maakDeOfferte }).click();
  await expect(page.getByRole('heading', { name: nl.detail.controleerEven })).toBeVisible({
    timeout: 15_000,
  });
  const iframe = houder(page).locator('iframe');
  await expect(iframe).toBeVisible();
  const ratio = await pixelRatio(page);

  // Passend: schaal < 1, de hele eerste pagina binnen de houder en binnen het venster.
  await expect(knop(page, z.passend)).toHaveAttribute('aria-pressed', 'true');
  const passend = await schaal(page);
  expect(passend).toBeLessThan(1);
  expect(await percentage(page)).toBe(Math.round(passend * 100));
  const vak = await houder(page).boundingBox();
  const pagina = await iframe.boundingBox();
  expect(vak && pagina).toBeTruthy();
  expect(pagina!.y).toBeGreaterThanOrEqual(vak!.y);
  expect(pagina!.x).toBeGreaterThanOrEqual(vak!.x);
  expect(pagina!.y + A4_HOOGTE * passend).toBeLessThanOrEqual(vak!.y + vak!.height + 1);
  expect(pagina!.x + A4_BREEDTE * passend).toBeLessThanOrEqual(vak!.x + vak!.width + 1);
  expect(vak!.y + vak!.height).toBeLessThanOrEqual(700);

  // Gele balk ingeklapt: meer ruimte, Passend groeit mee (en past nog steeds).
  await page.getByRole('button', { name: nl.detail.verbergPunten }).click();
  await expect.poll(() => schaal(page)).toBeGreaterThan(passend);
  const ingeklapt = await schaal(page);
  const vak2 = await houder(page).boundingBox();
  const pagina2 = await iframe.boundingBox();
  expect(pagina2!.y + A4_HOOGTE * ingeklapt).toBeLessThanOrEqual(vak2!.y + vak2!.height + 1);
  expect(ingeklapt).toBeLessThan(1);

  // + verhoogt het percentage naar de volgende stap.
  await knop(page, z.groter).click();
  expect(await percentage(page)).toBeGreaterThan(Math.round(ingeklapt * 100));
  await expect(knop(page, z.passend)).toHaveAttribute('aria-pressed', 'false');

  // 100 %: de iframe op ware grootte; scrollen in beide richtingen, over het hele document.
  await knop(page, z.ware).click();
  expect(await schaal(page)).toBe(1);
  await expect(werkbalk(page)).toContainText('100 %');
  const groot = await iframe.boundingBox();
  expect(Math.round(groot!.width)).toBe(A4_BREEDTE);
  const scroll = await houder(page).evaluate((el: Scrollvak) => ({
    breed: el.scrollWidth > el.clientWidth,
    hoog: el.scrollHeight > el.clientHeight,
    hoogte: el.scrollHeight,
  }));
  expect(scroll.breed).toBe(true);
  expect(scroll.hoog).toBe(true);
  // De iframe is zo hoog als zijn document (niet alleen de eerste A4-hoogte) en past in het scrollvlak.
  const document = await iframe.evaluate((el: unknown) => {
    const f = el as {
      height: string;
      contentDocument: { body: { getBoundingClientRect: () => { bottom: number } } } | null;
    };
    return {
      iframe: f.height,
      inhoud: Math.ceil(f.contentDocument?.body.getBoundingClientRect().bottom ?? 0),
    };
  });
  expect(Number(document.iframe)).toBeGreaterThanOrEqual(document.inhoud);
  expect(scroll.hoogte).toBeGreaterThanOrEqual(Number(document.iframe));
  await houder(page).evaluate((el: Scrollvak) => el.scrollTo(el.scrollWidth, el.scrollHeight));
  expect(
    await houder(page).evaluate((el: Scrollvak) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1),
  ).toBe(true);

  // Ctrl+scroll boven het voorbeeld: groter (125 %), niet de paginazoom van het venster.
  const midden = await houder(page).boundingBox();
  await page.mouse.move(midden!.x + midden!.width / 2, midden!.y + midden!.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect.poll(() => percentage(page)).toBe(125);
  expect(await pixelRatio(page)).toBe(ratio);

  // Ctrl − en Ctrl 0 met de focus op het voorbeeld.
  await houder(page).focus();
  await page.keyboard.press('Control+Minus');
  await expect.poll(() => percentage(page)).toBe(100);
  await page.keyboard.press('Control+0');
  await expect(knop(page, z.passend)).toHaveAttribute('aria-pressed', 'true');
  expect(await schaal(page)).toBeCloseTo(ingeklapt, 5);
  expect(await pixelRatio(page)).toBe(ratio);

  // Einde van het bereik: + uit bij 300 %.
  for (let i = 0; i < 12; i++) {
    if (await knop(page, z.groter).isDisabled()) break;
    await knop(page, z.groter).click();
  }
  expect(await percentage(page)).toBe(300);
  await expect(knop(page, z.groter)).toBeDisabled();

  // De stand blijft staan na terug naar het overzicht en opnieuw openen.
  await knop(page, z.ware).click();
  await page.getByRole('button', { name: nl.detail.terugNaarOverzicht }).click();
  await page.getByRole('listitem').filter({ hasText: 'Zoom' }).click();
  await expect(houder(page).locator('iframe')).toBeVisible();
  expect(await schaal(page)).toBe(1);

  // Passend herstelt.
  await knop(page, z.passend).click();
  expect(await schaal(page)).toBeLessThan(1);
  expect(gestart.paginaFouten).toEqual([]);
});

test('het opmaakvoorbeeld in Instellingen heeft dezelfde werkbalk; de lay-outtegels niet', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  await page.getByRole('button', { name: nl.overzicht.instellingen, exact: true }).click();
  await page.getByRole('button', { name: nl.instellingen.tab.opmaak, exact: true }).click();
  const opmaak = page.getByRole('group', { name: nl.instellingen.opmaak.voorbeeld });
  await expect(opmaak.locator('iframe')).toBeVisible();
  await expect(werkbalk(page)).toHaveCount(1);
  await expect(knop(page, z.passend)).toHaveAttribute('aria-pressed', 'true');
  await knop(page, z.ware).click();
  expect(Number(await opmaak.getAttribute('data-schaal'))).toBe(1);
  await expect(werkbalk(page)).toContainText('100 %');
  expect(gestart.paginaFouten).toEqual([]);
});
