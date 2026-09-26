import { expect, test } from '@playwright/test';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  maakTestMappen,
  offerteIdVan,
  overslaanWelkom,
  sluitApp,
  startApp,
  startNepPdok,
  type GestarteApp,
  type NepPdok,
  type TestMappen,
} from '../helpers/e2e';

// OFM-031: straat en plaats uit postcode en huisnummer via PDOK, met een nep-PDOK
// (OFFERTE_MAKER_PDOK_URL). Gevonden → ingevuld en daarna nog te wijzigen; niet gevonden → alleen de
// grijze tekst. Alleen postcode en huisnummer gaan mee (A-29).

let mappen: TestMappen;
let pdok: NepPdok;
let gestart: GestarteApp | undefined;

test.beforeEach(async () => {
  mappen = maakTestMappen();
  pdok = await startNepPdok({
    'postcode:5611AB huisnummer:12': { straat: 'Dorpsstraat', plaats: 'Eindhoven' },
    'postcode:5600AA huisnummer:1': { straat: 'Industrieweg', plaats: 'Veldhoven' },
  });
});
test.afterEach(async () => {
  if (gestart) await sluitApp(gestart.app);
  gestart = undefined;
  await pdok.stop();
  mappen.opruimen();
});

const a = nl.componenten.adres;

test('wizardstap 1: gevonden vult straat en plaats in, niet gevonden laat ze leeg', async () => {
  gestart = await startApp(mappen, { pdokUrl: pdok.url });
  const { page } = gestart;
  await overslaanWelkom(page);
  const w = nl.wizard;
  await page.getByRole('button', { name: nl.overzicht.nieuweOfferte }).click();
  await page.getByLabel(w.klant.naam, { exact: true }).fill('Jansen');
  await page.getByLabel(w.klant.telefoon, { exact: true }).fill('0612345678');

  // Gevonden: binnen 2 s ingevuld.
  await page.getByLabel(a.postcode, { exact: true }).fill('5611ab');
  await page.getByLabel(a.huisnummer, { exact: true }).fill('12a');
  await expect(page.getByLabel(a.straat, { exact: true })).toHaveValue('Dorpsstraat', { timeout: 2000 });
  await expect(page.getByLabel(a.plaats, { exact: true })).toHaveValue('Eindhoven');
  // Alleen postcode en huisnummer gingen naar PDOK, niet de naam of het telefoonnummer.
  expect(pdok.verzoeken).toEqual([['type:adres', 'postcode:5611AB', 'huisnummer:12']]);

  // Daarna handmatig te wijzigen, zonder dat het opnieuw wordt opgezocht.
  await page.getByLabel(a.plaats, { exact: true }).fill('Eindhoven-Noord');
  await page.getByRole('button', { name: w.volgende, exact: true }).click();
  await expect(page.getByRole('heading', { name: `2. ${w.stappen[1]}` })).toBeVisible();
  const id = await offerteIdVan(page, 'Jansen');
  await expect
    .poll(async () => (await apiData(page, 'offerteHaal', { id })).klant.adres)
    .toEqual({ straatHuisnummer: 'Dorpsstraat 12A', postcode: '5611 AB', plaats: 'Eindhoven-Noord' });

  // Terug naar stap 1: het opgeslagen adres staat er, zonder nieuwe zoekopdracht.
  await page.getByRole('button', { name: w.vorige, exact: true }).click();
  await expect(page.getByLabel(a.straat, { exact: true })).toHaveValue('Dorpsstraat');
  await expect(page.getByLabel(a.huisnummer, { exact: true })).toHaveValue('12A');
  await page.waitForTimeout(800);
  expect(pdok.verzoeken).toHaveLength(1);

  // Werkadres: niet gevonden → grijze tekst, velden leeg en bewerkbaar.
  await page.getByText(w.klant.anderWerkadres).click();
  const werk = page.getByRole('group', { name: w.klant.werkadres });
  await werk.getByLabel(a.postcode, { exact: true }).fill('9999 ZZ');
  await werk.getByLabel(a.huisnummer, { exact: true }).fill('1');
  await expect(werk.getByText(a.nietGevonden)).toBeVisible({ timeout: 2000 });
  await expect(werk.getByLabel(a.straat, { exact: true })).toHaveValue('');
  await werk.getByLabel(a.straat, { exact: true }).fill('Zelfweg');
  await expect(werk.getByLabel(a.straat, { exact: true })).toHaveValue('Zelfweg');
  expect(gestart.paginaFouten).toEqual([]);
});

test('bedrijfsgegevens: gevonden vult straat en plaats in en bewaart', async () => {
  gestart = await startApp(mappen, { pdokUrl: pdok.url });
  const { page } = gestart;
  await overslaanWelkom(page);
  await page.getByRole('button', { name: nl.overzicht.instellingen }).click();
  await page.getByLabel(a.postcode, { exact: true }).fill('5600 AA');
  await page.getByLabel(a.huisnummer, { exact: true }).fill('1');
  await expect(page.getByLabel(a.straat, { exact: true })).toHaveValue('Industrieweg', { timeout: 2000 });
  await expect(page.getByLabel(a.plaats, { exact: true })).toHaveValue('Veldhoven');
  await expect
    .poll(async () => (await apiData(page, 'instellingenHaal')).bedrijf)
    .toMatchObject({ adres: 'Industrieweg 1', postcode: '5600 AA', plaats: 'Veldhoven' });
  expect(gestart.paginaFouten).toEqual([]);
});

test('geen PDOK bereikbaar: geen foutmelding, alleen "Niet gevonden, vul zelf in"', async () => {
  gestart = await startApp(mappen); // standaard: niets luistert op de PDOK-URL
  const { page } = gestart;
  await overslaanWelkom(page);
  await page.getByRole('button', { name: nl.overzicht.nieuweOfferte }).click();
  await page.getByLabel(a.postcode, { exact: true }).fill('5611 AB');
  await page.getByLabel(a.huisnummer, { exact: true }).fill('12');
  await expect(page.getByText(a.nietGevonden)).toBeVisible({ timeout: 2000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(gestart.paginaFouten).toEqual([]);
});
