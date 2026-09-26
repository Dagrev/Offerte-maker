import { expect, test, type Page } from '@playwright/test';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  maakTestMappen,
  overslaanWelkom,
  sluitApp,
  startApp,
  vulDakIn,
  vulKlantIn,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';
import { controleerScherm } from '../helpers/toegankelijkheid';

// OFM-057: categorieën van materialen. In Instellingen › Materialen en prijzen staan de startcategorieën
// als open groepen. Categorie Lood en zink toevoegen (een dubbele naam kan niet), EPS erin zetten en een
// materiaal in de groep toevoegen, de groep inklappen, zoeken klapt hem weer open en verbergt lege groepen,
// verwijderen zet de materialen in Overig. In de wizard staan de materialen van Isoleren per categorie
// zodra er meer dan één categorie in voorkomt.

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
const w = nl.wizard;
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });
const groep = (page: Page, naam: string) => page.getByRole('region', { name: tc.groep(naam), exact: true });
const groepKnop = (page: Page, naam: string) => groep(page, naam).locator('h3 button');
const LOOD = 'Lood en zink';

test('categorieën: toevoegen, materiaal erin, inklappen, zoeken, verwijderen naar Overig; wizard per categorie', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.materialen).click();

  // Startcategorieën als groepen, alle open; Overig is leeg.
  for (const naam of ['Dakbedekking', 'Isolatie', 'Kappen', 'Afwerkmateriaal', 'Schroeven en toebehoren']) {
    await expect(groepKnop(page, naam)).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(groep(page, 'Overig').getByText(tc.leeg)).toBeVisible();
  await expect(groepKnop(page, 'Isolatie')).toContainText(tc.aantal(4));

  // Blok Categorieën: een dubbele naam kan niet, Lood en zink toevoegen.
  const beheer = page.getByRole('region', { name: tc.beheer, exact: true });
  await beheer.locator('h3 button').click();
  await expect(beheer.locator('h3 button')).toHaveAttribute('aria-expanded', 'true');
  await beheer.getByLabel(tc.nieuw, { exact: true }).fill(' isolatie');
  await expect(beheer.getByText(tc.fout.dubbel)).toBeVisible();
  await expect(knop(page, tc.toevoegen)).toBeDisabled();
  await beheer.getByLabel(tc.nieuw, { exact: true }).fill(LOOD);
  await knop(page, tc.toevoegen).click();
  await expect(groep(page, LOOD).getByText(tc.leeg)).toBeVisible();
  // Overig blijft onderaan; de nieuwe categorie staat erboven.
  await expect(knop(page, t.omlaag(LOOD))).toBeDisabled();
  await controleerScherm(page, 'Materialen en prijzen met categorieën', []);

  // EPS naar Lood en zink, en een materiaal in de groep toevoegen (krijgt die categorie en de focus).
  await page.getByLabel(tc.vanMateriaal('EPS'), { exact: true }).selectOption({ label: LOOD });
  await expect(groep(page, LOOD).getByLabel(t.materiaalNaam('EPS'), { exact: true })).toHaveValue('EPS');
  await expect(groepKnop(page, 'Isolatie')).toContainText(tc.aantal(3));
  await groep(page, LOOD).getByLabel(tc.nieuwIn(LOOD), { exact: true }).fill('Loodslab');
  await knop(page, tc.toevoegenIn(LOOD)).click();
  const loodslab = groep(page, LOOD).getByLabel(t.materiaalNaam('Loodslab'), { exact: true });
  await expect(loodslab).toBeFocused();

  // Inklappen; zoeken klapt de groep met treffers open en verbergt groepen zonder treffers.
  await groepKnop(page, LOOD).click();
  await expect(groepKnop(page, LOOD)).toHaveAttribute('aria-expanded', 'false');
  await expect(loodslab).toHaveCount(0);
  const zoek = page.getByRole('searchbox', { name: t.zoekMateriaal });
  await zoek.fill('LOOD');
  await expect(groepKnop(page, LOOD)).toHaveAttribute('aria-expanded', 'true');
  await expect(loodslab).toBeVisible();
  await expect(groep(page, 'Isolatie')).toHaveCount(0);
  await zoek.fill('');
  await expect(groep(page, 'Isolatie')).toBeVisible();
  // Alles sluiten en openen.
  await knop(page, t.allesSluiten).click();
  await expect(groepKnop(page, 'Isolatie')).toHaveAttribute('aria-expanded', 'false');
  await expect(groepKnop(page, 'Overig')).toHaveAttribute('aria-expanded', 'false');
  await knop(page, t.allesOpenen).click();
  await expect(groepKnop(page, 'Overig')).toHaveAttribute('aria-expanded', 'true');

  await expect
    .poll(async () => {
      const set = await apiData(page, 'werkzaamhedenHaal');
      const lood = set.categorieen.find((c) => c.naam === LOOD);
      return [
        set.categorieen.map((c) => c.naam),
        set.materialen.filter((m) => m.categorieId === lood?.id).map((m) => m.label),
      ];
    })
    .toEqual([
      ['Dakbedekking', 'Isolatie', 'Kappen', 'Afwerkmateriaal', 'Schroeven en toebehoren', LOOD, 'Overig'],
      ['EPS', 'Loodslab'],
    ]);

  // Verwijderen: de bevestiging noemt het aantal; de materialen gaan naar Overig.
  await knop(page, t.verwijder(LOOD)).click();
  const dialoog = page.getByRole('dialog');
  await expect(dialoog.getByText(tc.verwijderTekst(LOOD, 2))).toBeVisible();
  await dialoog.getByRole('button', { name: t.verwijderJa, exact: true }).click();
  await expect(groep(page, LOOD)).toHaveCount(0);
  await expect(groep(page, 'Overig').getByLabel(t.materiaalNaam('EPS'), { exact: true })).toBeVisible();
  await expect(groep(page, 'Overig').getByLabel(t.materiaalNaam('Loodslab'), { exact: true })).toBeVisible();
  await controleerScherm(page, 'Materialen en prijzen na verwijderen categorie', []);

  // PIR 60 mm naar Kappen: in de wizard staan de materialen van Isoleren dan per categorie.
  await page.getByLabel(tc.vanMateriaal('PIR 60 mm'), { exact: true }).selectOption({ label: 'Kappen' });
  await expect(groep(page, 'Kappen').getByLabel(t.materiaalNaam('PIR 60 mm'), { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const set = await apiData(page, 'werkzaamhedenHaal');
      return [
        set.materialen.find((m) => m.label === 'EPS')?.categorieId,
        set.materialen.find((m) => m.label === 'PIR 60 mm')?.categorieId,
      ];
    })
    .toEqual([null, 'cat:kappen']);
  await knop(page, nl.instellingen.terug).click();

  await knop(page, nl.overzicht.nieuweOfferte).click();
  await vulKlantIn(page, { achternaam: 'Categorieman', plaats: 'Best' });
  await knop(page, w.volgende).click();
  await vulDakIn(page);
  await knop(page, w.volgende).click();
  await knop(page, 'Dak vervangen').click();
  await knop(page, 'Isoleren').click();
  const isoleren = page.getByRole('region', { name: 'Isoleren' });
  await expect(
    isoleren.getByRole('group', { name: 'Kappen', exact: true }).getByLabel('PIR 60 mm'),
  ).toBeVisible();
  await expect(
    isoleren.getByRole('group', { name: 'Isolatie', exact: true }).getByLabel('PIR 80 mm', { exact: true }),
  ).toBeChecked();
  await controleerScherm(page, 'Wizard 3 materialen per categorie', []);
  expect(gestart.paginaFouten).toEqual([]);
});
