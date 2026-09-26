import { readdirSync } from 'node:fs';
import { join } from 'node:path';
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

// OFM-047: een definitieve offerte aanpassen via de wizard (dakvlak groter), Terug naar de offerte
// (gele regel), Maak opnieuw vanaf het detailscherm (mislukt zonder Claude → wizardstap 4), Maak
// opnieuw zonder Claude, versie b definitief maken, totaal en PDF-naam, vorige versie terugzetten.

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
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });

async function naarStap(page: Page, stap: 1 | 2 | 3 | 4): Promise<void> {
  const naam = w.stappen[stap - 1] ?? '';
  await page
    .getByRole('navigation', { name: nl.componenten.stappen })
    .getByRole('button', { name: new RegExp(naam) })
    .click();
  await expect(page.getByRole('heading', { name: `${stap}. ${naam}` })).toBeVisible();
}

test('definitieve offerte aanpassen, opnieuw maken als versie b en de vorige versie terugzetten', async () => {
  gestart = await startApp(mappen, { modus: 'niet-ingelogd' });
  const { page } = gestart;
  await overslaanWelkom(page);

  // Nieuwe offerte: 8 × 5 m, Slopen 40 m² à € 10 (prijs in de offerte), zonder Claude, definitief.
  const id = await nieuweOfferteTotStap4(page, { achternaam: 'Aanpasser', plaats: 'Eindhoven' });
  await naarStap(page, 3);
  await page.getByLabel(w.werk.prijsVan('Slopen'), { exact: true }).fill('10');
  await naarStap(page, 4);
  await knop(page, w.maakZonderClaude).click();
  await expect(knop(page, d.maakDefinitief)).toBeVisible({ timeout: 15_000 });
  await knop(page, d.maakDefinitief).click();
  await expect(knop(page, d.openPdf)).toBeVisible({ timeout: 20_000 });
  const eerst = await apiData(page, 'offerteHaal', { id });
  const totaalA = eerst.totalen?.totaalCent ?? 0;
  expect(totaalA).toBe(48_400); // 40 × € 10 + 21 % btw
  expect(eerst.nummer).not.toBeNull();
  // Aanpassen is de hoofdknop, Regels bewerken staat ernaast.
  await expect(knop(page, d.regelsBewerken)).toBeVisible();

  // Aanpassen → wizard in aanpasmodus met de opgeslagen invoer.
  await knop(page, d.aanpassen).click();
  await expect(page.getByRole('heading', { name: w.titelAanpassen, level: 1 })).toBeVisible();
  await expect(page.getByLabel(w.klant.achternaam, { exact: true })).toHaveValue('Aanpasser');
  await controleerScherm(page, 'Wizard aanpassen stap 1', uitkomsten);
  await naarStap(page, 2);
  await page.getByLabel(w.dak.lengte, { exact: true }).fill('10');
  await naarStap(page, 3);
  await page.getByLabel(w.werk.aantalVan('Slopen'), { exact: true }).fill('50');
  await naarStap(page, 4);
  await expect(knop(page, w.maakOpnieuw)).toBeVisible();
  await expect(knop(page, w.maakOpnieuwZonderClaude)).toBeVisible();
  await expect(knop(page, w.maakDeOfferte)).toHaveCount(0);
  await controleerScherm(page, 'Wizard aanpassen stap 4', uitkomsten);

  // Terug naar de offerte zonder opnieuw maken: invoer bewaard, inhoud gelijk, gele regel.
  await knop(page, w.terugNaarOfferte).last().click();
  await expect(page.getByText(d.invoerGewijzigd)).toBeVisible();
  const tussen = await apiData(page, 'offerteHaal', { id });
  expect(tussen.invoerGewijzigd).toBe(true);
  expect(tussen.totalen?.totaalCent).toBe(totaalA);
  expect(tussen.invoer.dakvlakken[0]?.lengteM).toBe(10);
  await controleerScherm(page, 'Detail met invoer gewijzigd', uitkomsten);

  // Maak opnieuw op het detailscherm: Claude is niet ingelogd → terug naar wizardstap 4 met de fout.
  await knop(page, d.maakOpnieuw).click();
  await expect(page.getByRole('heading', { name: `4. ${w.stappen[3]}` })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: w.titelAanpassen, level: 1 })).toBeVisible();
  await knop(page, w.maakOpnieuwZonderClaude).click();
  await expect(knop(page, d.maakDefinitief)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(d.invoerGewijzigd)).toHaveCount(0);

  const opnieuw = await apiData(page, 'offerteHaal', { id });
  expect(opnieuw.invoerGewijzigd).toBe(false);
  expect(opnieuw.gewijzigdNaDefinitief).toBe(true);
  expect(opnieuw.versies.map((v) => v.bron)).toEqual(['wizard', 'zonder_claude']);
  expect(opnieuw.totalen?.totaalCent).toBe(60_500); // 50 × € 10 + 21 % btw

  // Versie b definitief: tweede PDF met versieletter, de eerste blijft staan.
  await knop(page, d.maakDefinitief).click();
  await expect(knop(page, d.maakDefinitief)).toHaveCount(0, { timeout: 20_000 });
  const nummer = opnieuw.nummer ?? '';
  await expect(page.getByRole('heading', { name: `${nummer}b`, level: 1 })).toBeVisible();
  const pdfs = readdirSync(join(mappen.docs, '2026'))
    .filter((n) => n.endsWith('.pdf'))
    .sort();
  expect(pdfs).toEqual([`${nummer} Jan Aanpasser.pdf`, `${nummer}b Jan Aanpasser.pdf`]);

  // Vorige versie terugzetten: totaal weer als eerst, opnieuw definitief te maken.
  await knop(page, d.terugzettenVersie(1)).click();
  await expect(knop(page, d.maakDefinitief)).toBeVisible();
  const terug = await apiData(page, 'offerteHaal', { id });
  expect(terug.totalen?.totaalCent).toBe(totaalA);
  expect(terug.versies[0]?.bron).toBe('terugzetten');
});
