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

// OFM-043: onder Instellingen › Werkzaamheden een soort werk toevoegen, een werkzaamheid toevoegen en
// eraan koppelen, een materiaal toevoegen en aan de werkzaamheid koppelen (als standaard), en dat na
// herladen terugzien; de prijs staat ook in de tab Prijzen.

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
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });
const WERK = 'Dakkapel bekleden';

async function naarTab(page: Page): Promise<void> {
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.werkzaamheden).click();
  await expect(page.getByRole('heading', { name: t.soorten, level: 2 })).toBeVisible();
}

test('soort werk, werkzaamheid en materiaal toevoegen en koppelen; blijft na herladen', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  await naarTab(page);

  // De startset staat er: Slopen hoort bij Dak vervangen.
  await expect(page.getByRole('group', { name: 'Dak vervangen' }).getByLabel('Slopen')).toBeChecked();

  // 1. Soort werk toevoegen (de keuzelijst soortWerk).
  await page.getByLabel(nl.keuzelijsten.nieuw, { exact: true }).fill('Dakkapel');
  await page.getByLabel(nl.keuzelijsten.nieuw, { exact: true }).press('Enter');
  const dakkapel = page.getByRole('group', { name: 'Dakkapel', exact: true });
  await expect(dakkapel).toBeVisible();

  // 2. Werkzaamheid toevoegen, prijs invullen en aan de nieuwe soort werk koppelen.
  await page.getByLabel(t.nieuwWerk, { exact: true }).fill(WERK);
  await page.getByLabel(t.nieuwWerk, { exact: true }).press('Enter');
  await expect(page.getByLabel(t.werkNaam(WERK), { exact: true })).toHaveValue(WERK);
  await page.getByLabel(t.werkEenheid(WERK), { exact: true }).selectOption('m¹');
  const prijs = page.getByLabel(t.werkPrijs(WERK), { exact: true });
  await prijs.fill('85');
  await prijs.blur();
  await dakkapel.getByLabel(WERK, { exact: true }).check();

  // 3. Materiaal toevoegen en bij de werkzaamheid kiesbaar maken, als standaard.
  await page.getByLabel(t.nieuwMateriaal, { exact: true }).fill('Zink');
  await page.getByLabel(t.nieuwMateriaal, { exact: true }).press('Enter');
  await expect(page.getByLabel(t.materiaalNaam('Zink'), { exact: true })).toHaveValue('Zink');
  await knop(page, t.details(WERK)).click();
  await page
    .getByRole('group', { name: t.kiesbareMaterialen(WERK) })
    .getByLabel('Zink', { exact: true })
    .check();
  await page.getByLabel(t.standaardMateriaal(WERK), { exact: true }).selectOption({ label: 'Zink' });
  // Een optie erbij.
  await page.getByLabel(t.nieuweOptie(WERK), { exact: true }).fill('Steiger');
  await page.getByLabel(t.nieuweOptie(WERK), { exact: true }).press('Enter');
  await expect(page.getByLabel(t.optieNaam('Steiger', WERK), { exact: true })).toBeVisible();
  await expect(page.getByText(nl.componenten.bewaard).first()).toBeVisible();

  // Bewaard in main (de laatste bewaaractie kan nog onderweg zijn).
  await expect
    .poll(async () => {
      const set = await apiData(page, 'werkzaamhedenHaal');
      const werk = set.werkzaamheden.find((w) => w.label === WERK);
      const zink = set.materialen.find((m) => m.label === 'Zink');
      return {
        werk: werk && {
          sleutel: werk.sleutel,
          eenheid: werk.eenheid,
          prijsCent: werk.prijsCent,
          soortenWerk: werk.soortenWerk,
          opties: werk.opties.map((o) => o.sleutel),
          materialen: werk.materialen.map((m) => ({ ...m, materiaalId: m.materiaalId === zink?.id })),
        },
        soort: set.soortenWerk.find((s) => s.label === 'Dakkapel')?.werkzaamheden.includes(werk?.id ?? ''),
      };
    })
    .toEqual({
      werk: {
        sleutel: 'dakkapel_bekleden',
        eenheid: 'm¹',
        prijsCent: 8500,
        soortenWerk: ['dakkapel'],
        opties: ['steiger'],
        materialen: [{ materiaalId: true, standaard: true }],
      },
      soort: true,
    });

  // Herladen: alles staat er nog.
  await page.reload();
  await naarTab(page);
  await expect(
    page.getByRole('group', { name: 'Dakkapel', exact: true }).getByLabel(WERK, { exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel(t.werkPrijs(WERK), { exact: true })).toHaveValue('85');
  await expect(page.getByLabel(t.werkEenheid(WERK), { exact: true })).toHaveValue('m¹');
  await knop(page, t.details(WERK)).click();
  await expect(
    page.getByRole('group', { name: t.kiesbareMaterialen(WERK) }).getByLabel('Zink', { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel(t.standaardMateriaal(WERK), { exact: true }).locator('option:checked'),
  ).toHaveText('Zink');
  await expect(page.getByLabel(t.optieNaam('Steiger', WERK), { exact: true })).toHaveValue('Steiger');
  // Toegankelijkheid met een uitgeklapte werkzaamheid (de tab zelf zit ook in toegankelijkheid.spec).
  await controleerScherm(page, 'Instellingen Werkzaamheden uitgeklapt', []);

  // De prijs staat ook in de tab Prijzen, onder Werkzaamheden (naam en eenheid alleen-lezen).
  await knop(page, nl.instellingen.tab.prijzen).click();
  const tabel = page.getByRole('table', { name: nl.instellingen.prijzen.groep.werk, exact: true });
  await expect(tabel.getByRole('row').filter({ hasText: WERK })).toBeVisible();
  await expect(
    tabel.getByLabel(nl.instellingen.prijzen.rijLabel(WERK, nl.instellingen.prijzen.prijs), { exact: true }),
  ).toHaveValue('85');
  await expect(knop(page, nl.instellingen.prijzen.verwijder(WERK))).toHaveCount(0);

  expect(gestart.paginaFouten).toEqual([]);
});
