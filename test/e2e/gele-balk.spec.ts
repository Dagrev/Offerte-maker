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

// Inklapbare gele balk op het detailscherm (OFM-036): 1–3 punten uitgeklapt, meer samengevouwen,
// keuze blijft zolang de offerte open is, lijst scrollt zelf en het voorbeeld blijft zichtbaar.

const d = nl.detail;
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

function vensterHoogte(page: Page): Promise<number> {
  return page.evaluate(() => (globalThis as unknown as { innerHeight: number }).innerHeight);
}

function balk(page: Page) {
  return page.getByRole('status').filter({ has: page.getByRole('heading', { name: d.controleerEven }) });
}

test('gele balk: in- en uitklappen, keuze onthouden, voorbeeld zichtbaar op 1024 × 700', async () => {
  gestart = await startApp(mappen);
  const { page, app } = gestart;
  // Vensterminimum (OFM-008): het venster start gemaximaliseerd, dus eerst terugzetten. De app
  // maximaliseert zelf bij ready-to-show; dat kan ná de eerste poging komen, dus herhalen tot het past.
  await expect
    .poll(async () => {
      await app.evaluate(({ BrowserWindow }) => {
        const venster = BrowserWindow.getAllWindows()[0];
        venster?.unmaximize();
        venster?.setContentSize(1024, 700);
      });
      return vensterHoogte(page);
    })
    .toBeLessThanOrEqual(700);
  await overslaanWelkom(page);
  const id = await nieuweOfferteTotStap4(page, { achternaam: 'Balk', plaats: 'Eindhoven' });
  await page.getByRole('button', { name: nl.wizard.maakDeOfferte }).click();

  // Drie punten: standaard uitgeklapt.
  const geleBalk = balk(page);
  await expect(geleBalk).toBeVisible({ timeout: 15_000 });
  await expect(
    geleBalk.getByRole('heading', { name: `${d.controleerEven} ${d.aantalPunten(3)}` }),
  ).toBeVisible();
  const verberg = geleBalk.getByRole('button', { name: d.verbergPunten });
  await expect(verberg).toHaveAttribute('aria-expanded', 'true');
  await expect(geleBalk.getByRole('region', { name: d.controlepunten }).getByRole('listitem')).toHaveCount(3);

  // Inklappen met het toetsenbord; de keuze blijft na Aanpassen en terug.
  await verberg.focus();
  await page.keyboard.press('Enter');
  const toon = geleBalk.getByRole('button', { name: d.toonPunten });
  await expect(toon).toHaveAttribute('aria-expanded', 'false');
  await expect(geleBalk.getByRole('listitem')).toHaveCount(0);
  await page.getByRole('button', { name: d.aanpassen, exact: true }).click();
  // Een controlepunt weghalen in Bewerken: het aantal in de kop loopt mee, de keuze blijft.
  await page.getByRole('button', { name: nl.bewerken.controlepuntVerwijderen(1) }).click();
  await page.getByRole('button', { name: nl.bewerken.klaar, exact: true }).click();
  await expect(
    balk(page).getByRole('heading', { name: `${d.controleerEven} ${d.aantalPunten(2)}` }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(balk(page).getByRole('button', { name: d.toonPunten })).toBeVisible();

  // Twintig controlepunten erbij: na opnieuw openen standaard samengevouwen, aantal loopt mee.
  const detail = await apiData(page, 'offerteHaal', { id });
  if (!detail.inhoud) throw new Error('geen inhoud');
  const extra = Array.from({ length: 20 }, (_, i) => `Controlepunt ${i + 1}: klopt dit?`);
  await apiData(page, 'offerteBewaarInhoud', {
    id,
    inhoud: { ...detail.inhoud, controlepunten: [...detail.inhoud.controlepunten, ...extra] },
  });
  // Herladen: de renderer-cache kent de via de API bewaarde inhoud nog niet.
  await page.reload();
  await page.getByRole('listitem').filter({ hasText: 'Balk' }).click();
  const veel = balk(page);
  await expect(
    veel.getByRole('heading', { name: `${d.controleerEven} ${d.aantalPunten(22)}` }),
  ).toBeVisible();
  await expect(veel.getByRole('button', { name: d.toonPunten })).toHaveAttribute('aria-expanded', 'false');

  // Samengevouwen: het voorbeeld begint hoog in het venster.
  const voorbeeld = page.getByRole('region', { name: nl.componenten.pdfVoorbeeld });
  const hoogte = await vensterHoogte(page);
  const dicht = await voorbeeld.boundingBox();
  expect(dicht && dicht.y).toBeLessThan(hoogte * 0.35);

  // Uitgeklapt: de lijst scrollt zelf (≤ 40 % van het venster) en het voorbeeld blijft zichtbaar.
  await veel.getByRole('button', { name: d.toonPunten }).click();
  const lijst = veel.getByRole('region', { name: d.controlepunten });
  await expect(lijst.getByRole('listitem')).toHaveCount(22);
  const lijstVak = await lijst.boundingBox();
  expect(lijstVak && lijstVak.height).toBeLessThanOrEqual(hoogte * 0.4 + 1);
  expect(
    await lijst.evaluate(
      (el: { scrollHeight: number; clientHeight: number }) => el.scrollHeight > el.clientHeight,
    ),
  ).toBe(true);
  const open = await voorbeeld.boundingBox();
  expect(open).not.toBeNull();
  expect(open!.y + 100).toBeLessThan(hoogte);
  await expect(veel.getByRole('button', { name: d.verbergPunten })).toHaveAttribute('aria-expanded', 'true');
  expect(gestart.paginaFouten).toEqual([]);
});
