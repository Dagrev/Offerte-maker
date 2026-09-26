import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { extractText } from 'unpdf';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  maakTestMappen,
  offerteIdVan,
  overslaanWelkom,
  sluitApp,
  startApp,
  vulDakIn,
  vulKlantIn,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';
import { controleerScherm } from '../helpers/toegankelijkheid';

// OFM-050: stap 2 beschrijft het huidige dak, met per keuze een zin in de offerte (Instellingen ›
// Keuzelijsten); stap 3 begint met soort werk en de nieuwe dakbedekking, die het materiaal bij de
// werkzaamheid Nieuwe bedekking voorselecteert. Maak zonder Claude zet de zinnen als eerste stap
// "Huidige situatie" in de werkomschrijving; die staat daarna op de PDF.

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

const k = nl.keuzelijsten;
const w = nl.wizard;
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });
const EIGEN_ZIN = 'Het dak heeft een dakbeschot van vuren planken.';

test('zin bij ondergrond hout aanpassen, nieuwe bedekking EPDM voorgeselecteerd, zin op de PDF', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);

  // Instellingen › Keuzelijsten › Ondergrond: de startzin aanpassen (bewaart vanzelf).
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.keuzelijsten).click();
  await knop(page, k.lijst.ondergrond).click();
  await expect(page.getByRole('heading', { name: k.lijst.ondergrond, level: 2 })).toBeVisible();
  const zin = page.getByLabel(k.zinVan('Hout'), { exact: true });
  await expect(zin).toHaveValue('Het dak heeft een houten dakbeschot.');
  await zin.fill(EIGEN_ZIN);
  await zin.blur();
  await expect(page.getByText(nl.componenten.bewaard)).toBeVisible();
  await controleerScherm(page, 'Keuzelijsten ondergrond met zinnen', []);
  // Soort werk: het vinkje "Vraagt nieuwe dakbedekking" staat bij dak vervangen, niet bij reparatie.
  await knop(page, k.lijst.soortWerk).click();
  await expect(
    page.getByRole('checkbox', { name: `${k.vraagtBedekking}${k.bijOptie('Dak vervangen')}` }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: `${k.vraagtBedekking}${k.bijOptie('Reparatie')}` }),
  ).not.toBeChecked();
  const lijsten = await apiData(page, 'keuzelijstenHaal');
  expect(lijsten.ondergrond.find((o) => o.sleutel === 'hout')?.zin).toBe(EIGEN_ZIN);
  expect(lijsten.nieuweBedekking.map((o) => o.label)).toEqual(['Bitumen', 'EPDM', 'PVC']);
  await knop(page, nl.instellingen.terug).click();

  // Wizard stap 2 Het huidige dak: huidige bedekking staat er altijd, soort werk niet.
  await knop(page, nl.overzicht.nieuweOfferte).click();
  await vulKlantIn(page, { achternaam: 'Dakman', plaats: 'Best' });
  await knop(page, w.volgende).click();
  await expect(page.getByRole('heading', { name: `2. ${w.stappen[1]}` })).toBeVisible();
  expect(w.stappen[1]).toBe('Het huidige dak');
  await expect(page.getByRole('group', { name: w.dak.huidigeBedekking })).toBeVisible();
  await expect(page.getByRole('group', { name: w.werk.soortWerk })).toHaveCount(0);
  await knop(page, 'Plat dak').click();
  await knop(page, 'Bitumen').click();
  await knop(page, 'Hout').click();
  await vulDakIn(page);
  await controleerScherm(page, 'Wizard 2 het huidige dak', []);

  // Stap 3: soort werk, dan de nieuwe dakbedekking (alleen bij een soort werk die erom vraagt).
  await knop(page, w.volgende).click();
  await expect(page.getByRole('heading', { name: `3. ${w.stappen[2]}` })).toBeVisible();
  const bedekking = page.getByRole('group', { name: w.werk.nieuweBedekking });
  await knop(page, 'Reparatie').click();
  await expect(bedekking).toHaveCount(0);
  await knop(page, 'Dak vervangen').click();
  await expect(bedekking).toBeVisible();
  await bedekking.getByRole('button', { name: 'EPDM', exact: true }).click();
  await expect(bedekking.getByRole('button', { name: /^EPDM/ })).toHaveAttribute('aria-pressed', 'true');

  // Nieuwe bedekking kiezen: EPDM is voorgeselecteerd (niet de standaard Bitumen); wisselen kan.
  await knop(page, 'Nieuwe bedekking').click();
  const kaart = page.getByRole('region', { name: 'Nieuwe bedekking' });
  await expect(kaart.getByLabel('EPDM', { exact: true })).toBeChecked();
  await expect(kaart.getByLabel('Bitumen', { exact: true })).not.toBeChecked();
  await controleerScherm(page, 'Wizard 3 met nieuwe dakbedekking', []);
  // Een andere bedekking kiezen vervangt het materiaal in de al gekozen werkzaamheid.
  await bedekking.getByRole('button', { name: 'PVC', exact: true }).click();
  await expect(kaart.getByLabel('PVC', { exact: true })).toBeChecked();
  await expect(kaart.getByLabel('EPDM', { exact: true })).not.toBeChecked();
  await bedekking.getByRole('button', { name: 'EPDM', exact: true }).click();
  await expect(kaart.getByLabel('EPDM', { exact: true })).toBeChecked();

  // Stap 4: de samenvatting noemt de nieuwe dakbedekking.
  await knop(page, w.volgende).click();
  await expect(page.getByRole('heading', { name: `4. ${w.stappen[3]}` })).toBeVisible();
  await expect(page.locator('dl')).toContainText(w.samenvatting.nieuweBedekking);
  const id = await offerteIdVan(page, 'Dakman');
  const invoer = (await apiData(page, 'offerteHaal', { id })).invoer;
  expect(invoer.nieuweBedekking).toBe('epdm');
  expect(invoer.werkzaamheden[0]?.materialen.map((m) => m.sleutel)).toEqual(['epdm']);

  // Maak zonder Claude → de eerste stap van de werkomschrijving is de huidige situatie.
  await knop(page, w.maakZonderClaude).click();
  await expect(page.getByRole('heading', { name: nl.detail.controleerEven })).toBeVisible({
    timeout: 15_000,
  });
  const detail = await apiData(page, 'offerteHaal', { id });
  expect(detail.inhoud?.werkomschrijving[0]).toBe(
    `Huidige situatie: Het betreft een plat dak. Het dak is nu bedekt met bitumen. ${EIGEN_ZIN} Het dak ligt op de begane grond of de eerste bouwlaag. Het dak is in totaal 40,00 m².`,
  );
  await knop(page, nl.detail.maakDefinitief).click();
  await expect(knop(page, nl.detail.openPdf)).toBeVisible({ timeout: 20_000 });

  const map = join(mappen.docs, '2026');
  const pdf = readdirSync(map).find((n) => n.endsWith('.pdf'));
  expect(pdf).toBeDefined();
  const { text } = await extractText(new Uint8Array(readFileSync(join(map, pdf ?? ''))), {
    mergePages: true,
  });
  const tekst = text.replace(/\s+/g, ' ');
  expect(tekst).toContain('Huidige situatie:');
  expect(tekst).toContain(EIGEN_ZIN);

  expect(gestart.paginaFouten).toEqual([]);
});
