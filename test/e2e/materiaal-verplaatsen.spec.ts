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
import { controleerScherm } from '../helpers/toegankelijkheid';

// OFM-059: een materiaal naar een andere categorie verplaatsen in Instellingen › Materialen en prijzen.
// Via het contextmenu (rechtermuisknop op de rij, Shift+F10 in een veld, of een klik op de sleepgreep):
// groep Plaats bij met de huidige categorie aangevinkt en uitgeschakeld; kiezen bewaart direct, de
// doelgroep gaat open en de sleepgreep krijgt de focus; de keuze blijft na een herstart. Via slepen: de
// sleepgreep naar een (ingeklapte) andere groep. Ook tijdens het zoeken, met de melding "Verplaatst naar".

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

const t = nl.werkzaamheden;
const tc = t.categorie;
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });
const groep = (page: Page, naam: string) => page.getByRole('region', { name: tc.groep(naam), exact: true });
const groepKnop = (page: Page, naam: string) => groep(page, naam).locator('h3 button');
const naamVeld = (page: Page, categorie: string, materiaal: string) =>
  groep(page, categorie).getByLabel(t.materiaalNaam(materiaal), { exact: true });
const menu = (page: Page, materiaal: string) => page.getByRole('menu', { name: tc.menu(materiaal) });
const keuze = (page: Page, categorie: string) =>
  page.getByRole('menuitemradio', { name: categorie, exact: true });

async function naarMaterialen(page: Page): Promise<void> {
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.materialen).click();
  await expect(groepKnop(page, 'Isolatie')).toBeVisible();
}

async function categorieVan(page: Page, materiaal: string): Promise<string | undefined> {
  const set = await apiData(page, 'werkzaamhedenHaal');
  const m = set.materialen.find((x) => x.label === materiaal);
  return m?.categorieId === null ? 'Overig' : set.categorieen.find((c) => c.id === m?.categorieId)?.naam;
}

test('materiaal verplaatsen via het contextmenu, ook met het toetsenbord en tijdens zoeken; blijft na herstart', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  await naarMaterialen(page);

  // Kappen dichtklappen: het menu klapt de doelgroep weer open.
  await groepKnop(page, 'Kappen').click();
  await expect(groepKnop(page, 'Kappen')).toHaveAttribute('aria-expanded', 'false');

  // Rechtermuisknop op de rij van EPS (in de lege ruimte naast de tags, niet in een veld).
  const rij = groep(page, 'Isolatie').locator('li', {
    has: page.getByLabel(t.materiaalNaam('EPS'), { exact: true }),
  });
  await rij.click({ button: 'right', position: { x: 4, y: 4 } });
  await expect(menu(page, 'EPS')).toBeVisible();
  await expect(page.getByRole('group', { name: tc.plaatsBij })).toBeVisible();
  await expect(keuze(page, 'Isolatie')).toHaveAttribute('aria-checked', 'true');
  await expect(keuze(page, 'Isolatie')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menuitem', { name: tc.menuVerberg, exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: tc.menuVerwijder, exact: true })).toBeVisible();
  await controleerScherm(page, 'Materialen en prijzen met het menu van een materiaal', []);

  // Plaats bij Kappen: groep gaat open, EPS staat erin, de sleepgreep heeft de focus, melding.
  await keuze(page, 'Kappen').click();
  await expect(menu(page, 'EPS')).toHaveCount(0);
  await expect(groepKnop(page, 'Kappen')).toHaveAttribute('aria-expanded', 'true');
  await expect(naamVeld(page, 'Kappen', 'EPS')).toHaveValue('EPS');
  await expect(naamVeld(page, 'Isolatie', 'EPS')).toHaveCount(0);
  await expect(groep(page, 'Kappen').getByRole('button', { name: tc.greep('EPS') })).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: tc.verplaatst('Kappen') })).toBeVisible();
  await expect.poll(() => categorieVan(page, 'EPS')).toBe('Kappen');

  // Toetsenbord: Shift+F10 in het naamveld, Escape zet de focus terug; daarna via de pijltjes naar Isolatie.
  // De muis weg van waar het menu opengaat, anders maakt hij de regel eronder actief.
  await page.mouse.move(1, 1);
  await naamVeld(page, 'Kappen', 'EPS').focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu(page, 'EPS')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page, 'EPS')).toHaveCount(0);
  await expect(naamVeld(page, 'Kappen', 'EPS')).toBeFocused();
  await page.keyboard.press('Shift+F10');
  await expect(keuze(page, 'Dakbedekking')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(keuze(page, 'Isolatie')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(naamVeld(page, 'Isolatie', 'EPS')).toHaveValue('EPS');
  await expect.poll(() => categorieVan(page, 'EPS')).toBe('Isolatie');

  // Tijdens zoeken: een klik op de sleepgreep opent ook het menu; PIR 80 naar Overig (Isolatie heeft dan
  // geen treffers meer en verdwijnt).
  const zoek = page.getByRole('searchbox', { name: t.zoekMateriaal });
  await zoek.fill('pir 80');
  await expect(groep(page, 'Kappen')).toHaveCount(0);
  await groep(page, 'Isolatie')
    .getByRole('button', { name: tc.greep('PIR 80 mm') })
    .click();
  await keuze(page, 'Overig').click();
  await expect(naamVeld(page, 'Overig', 'PIR 80 mm')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: tc.verplaatst('Overig') })).toBeVisible();
  await expect(groep(page, 'Isolatie')).toHaveCount(0);
  await expect.poll(() => categorieVan(page, 'PIR 80 mm')).toBe('Overig');
  await zoek.fill('');

  // Na een herstart staan EPS en PIR nog op hun nieuwe plek.
  await sluitApp(gestart.app);
  gestart = await startApp(mappen);
  await naarMaterialen(gestart.page);
  await expect(naamVeld(gestart.page, 'Isolatie', 'EPS')).toHaveValue('EPS');
  await expect(naamVeld(gestart.page, 'Overig', 'PIR 80 mm')).toHaveValue('PIR 80 mm');
});

test('materiaal verplaatsen door te slepen, ook naar een ingeklapte groep', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  await naarMaterialen(page);

  const greep = (materiaal: string) => page.getByRole('button', { name: tc.greep(materiaal), exact: true });

  // Compact, zodat bron en doel tegelijk in beeld zijn: Chromium bepaalt het sleepelement pas bij de eerste
  // muisbeweging; scrolt de pagina tussendoor (dragTo scrolt naar het doel), dan pakt het een andere rij.
  await knop(page, t.allesSluiten).click();
  await groepKnop(page, 'Isolatie').click();
  await expect(groepKnop(page, 'Afwerkmateriaal')).toHaveAttribute('aria-expanded', 'false');

  // Naar de kop van een ingeklapte groep: die gaat open en EPS staat erin.
  await greep('EPS').dragTo(groepKnop(page, 'Afwerkmateriaal'));
  await expect(groepKnop(page, 'Afwerkmateriaal')).toHaveAttribute('aria-expanded', 'true');
  await expect(naamVeld(page, 'Afwerkmateriaal', 'EPS')).toHaveValue('EPS');
  await expect(naamVeld(page, 'Isolatie', 'EPS')).toHaveCount(0);
  await expect.poll(() => categorieVan(page, 'EPS')).toBe('Afwerkmateriaal');

  // Loslaten in de eigen groep doet niets.
  await greep('EPS').dragTo(groepKnop(page, 'Afwerkmateriaal'));
  await expect(naamVeld(page, 'Afwerkmateriaal', 'EPS')).toHaveValue('EPS');

  // Naar de inhoud (de lijst) van een open groep.
  await greep('EPS').dragTo(groep(page, 'Isolatie').getByRole('list'));
  await expect(naamVeld(page, 'Isolatie', 'EPS')).toHaveValue('EPS');
  await expect(naamVeld(page, 'Afwerkmateriaal', 'EPS')).toHaveCount(0);
  await expect.poll(() => categorieVan(page, 'EPS')).toBe('Isolatie');
});
