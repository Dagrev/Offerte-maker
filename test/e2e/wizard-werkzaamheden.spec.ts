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

// OFM-044: wizardstap 3 Werkzaamheden. Vervangen kiezen, slopen met afvalcontainer, isoleren met PIR 80
// mm en een aangepaste prijs, een eenmalige werkzaamheid, maken zonder Claude en de regels (met
// ingesprongen subregels en subtotalen) op de PDF terugzien.

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
const t = nl.wizard.werk;
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });

test('werkzaamheden met materiaal, optie, aangepaste prijs en eenmalig; zonder Claude op de PDF', async () => {
  // Statusfout (niet ingelogd): dan staat "Maak zonder Claude" in stap 4 (V-09).
  gestart = await startApp(mappen, { modus: 'niet-ingelogd' });
  const { page } = gestart;
  await overslaanWelkom(page);

  // Prijzen in de prijslijst via de instellingen: slopen € 10, afvalcontainer € 350, PIR 80 € 18.
  const set = await apiData(page, 'werkzaamhedenHaal');
  await apiData(page, 'werkzaamhedenBewaar', {
    werkzaamheden: set.werkzaamheden.map((x) => ({
      id: x.id,
      label: x.label,
      eenheid: x.eenheid,
      prijsCent: x.sleutel === 'slopen' ? 1000 : x.prijsCent,
      verborgen: x.verborgen,
      soortenWerk: x.soortenWerk,
      opties: x.opties.map((o) => ({
        ...o,
        prijsCent: o.sleutel === 'afvalcontainer' ? 35000 : o.prijsCent,
      })),
      materialen: x.materialen,
    })),
    materialen: set.materialen.map((m) => ({ ...m, prijsCent: m.sleutel === 'pir_80' ? 1800 : m.prijsCent })),
  });

  await knop(page, nl.overzicht.nieuweOfferte).click();
  await vulKlantIn(page, { achternaam: 'Werkman', plaats: 'Eindhoven' });
  await knop(page, w.volgende).click();
  await vulDakIn(page);
  await knop(page, w.volgende).click();
  await expect(page.getByRole('heading', { name: `3. ${w.stappen[2]}` })).toBeVisible();

  // Soort werk Vervangen: de gekoppelde werkzaamheden verschijnen als tegels.
  await expect(page.getByText(t.kiesSoortEerst)).toBeVisible();
  await knop(page, 'Dak vervangen').click();
  for (const naam of ['Slopen', 'Isoleren', 'Nieuwe bedekking', 'Dakrand en afwerking', 'Hemelwaterafvoer']) {
    await expect(knop(page, naam)).toBeVisible();
  }
  await expect(knop(page, 'Lekkage opsporen')).toHaveCount(0);

  // Slopen: 40 m² (het dak), prijs uit de prijslijst; afvalcontainer aan.
  await knop(page, 'Slopen').click();
  await expect(page.getByLabel(t.aantalVan('Slopen'), { exact: true })).toHaveValue('40');
  await expect(page.getByLabel(t.prijsVan('Slopen'), { exact: true })).toHaveValue('10');
  const slopen = page.getByRole('region', { name: 'Slopen' });
  await slopen.getByLabel('Afvalcontainer', { exact: true }).check();
  await expect(page.getByLabel(t.prijsVan('Afvalcontainer'), { exact: true })).toHaveValue('350');

  // Isoleren: PIR 80 mm staat al aan (standaard); eigen prijs 15 per m², en Standaardprijs zet hem terug.
  await knop(page, 'Isoleren').click();
  const isoleren = page.getByRole('region', { name: 'Isoleren' });
  await expect(isoleren.getByLabel('PIR 80 mm', { exact: true })).toBeChecked();
  const prijsIso = page.getByLabel(t.prijsVan('Isoleren'), { exact: true });
  await prijsIso.fill('12');
  await prijsIso.blur();
  await knop(page, t.standaardPrijsVan('Isoleren')).click();
  await expect(prijsIso).toHaveValue('');
  await prijsIso.fill('15');
  await prijsIso.blur();
  await expect(isoleren.getByText(`${t.subtotaal}: € 1.320,00`)).toBeVisible();

  // Eenmalige werkzaamheid.
  await knop(page, t.andereWerkzaamheid).click();
  await page
    .getByLabel(t.naamVan(t.nieuweWerkzaamheid.toLowerCase()), { exact: true })
    .fill('Dakkapel bekleden');
  const eenmalig = page.getByRole('region', { name: 'Dakkapel bekleden' });
  await eenmalig.getByLabel(t.eenheid, { exact: true }).selectOption('post');
  await page.getByLabel(t.aantalVan('Dakkapel bekleden'), { exact: true }).fill('1');
  await page.getByLabel(t.prijsVan('Dakkapel bekleden'), { exact: true }).fill('650');
  await expect(eenmalig.getByText(t.eenmalig, { exact: true })).toBeVisible();
  await controleerScherm(page, 'Wizard 3 werkzaamheden', []);

  // Eenmalig materiaal bij Slopen, en "Ook opslaan in instellingen": daarna een gewoon materiaal.
  await knop(page, t.anderMateriaalBij('Slopen')).click();
  await slopen.getByLabel(t.naamVan(t.nieuwMateriaal.toLowerCase()), { exact: true }).fill('Stofzeil');
  await slopen.getByRole('button', { name: t.opslaanInInstellingen }).click();
  await expect(slopen.getByLabel('Stofzeil', { exact: true })).toBeChecked();
  await expect(slopen.getByText(t.eenmalig, { exact: true })).toHaveCount(0);
  const nu = await apiData(page, 'werkzaamhedenHaal');
  const stofzeil = nu.materialen.find((m) => m.label === 'Stofzeil');
  expect(stofzeil?.sleutel).toBe('stofzeil');
  expect(nu.werkzaamheden.find((x) => x.sleutel === 'slopen')?.materialen).toContainEqual({
    materiaalId: stofzeil?.id,
    standaard: false,
  });

  await knop(page, w.volgende).click();
  await expect(page.getByRole('heading', { name: `4. ${w.stappen[3]}` })).toBeVisible();
  await expect(page.locator('dl')).toContainText('Dakkapel bekleden');

  // Maak zonder Claude.
  await knop(page, w.maakZonderClaude).click();
  await expect(page.getByRole('heading', { name: nl.detail.controleerEven })).toBeVisible({
    timeout: 15_000,
  });
  const id = await offerteIdVan(page, 'Werkman');
  const detail = await apiData(page, 'offerteHaal', { id });
  const regels = detail.inhoud?.regels ?? [];
  expect(
    regels.slice(0, 7).map((r) => [r.omschrijving, r.aantalHonderdsten, r.prijsCent, r.prijsbron]),
  ).toEqual([
    ['Slopen', 4000, 1000, 'prijslijst'],
    ['Stofzeil', 4000, 0, 'schatting'],
    ['Afvalcontainer', 100, 35000, 'prijslijst'],
    ['Isoleren', 4000, 1500, 'handmatig'],
    ['PIR 80 mm', 4000, 1800, 'prijslijst'],
    ['Dakkapel bekleden', 100, 65000, 'handmatig'],
    ['Voorrijkosten', 100, 0, 'schatting'],
  ]);
  expect(regels[1]?.onderdeelVan).toBe(regels[0]?.id);
  expect(regels[2]?.onderdeelVan).toBe(regels[0]?.id);
  expect(regels[4]?.onderdeelVan).toBe(regels[3]?.id);
  expect(regels[5]?.onderdeelVan ?? null).toBeNull();

  // Definitief maken en de PDF-tekst controleren.
  await knop(page, nl.detail.maakDefinitief).click();
  await expect(knop(page, nl.detail.openPdf)).toBeVisible({ timeout: 20_000 });
  const map = join(mappen.docs, '2026');
  const pdf = readdirSync(map).find((n) => n.endsWith('.pdf'));
  expect(pdf).toBeDefined();
  const { text } = await extractText(new Uint8Array(readFileSync(join(map, pdf ?? ''))), {
    mergePages: true,
  });
  const tekst = text.replace(/\s+/g, ' ');
  for (const deel of [
    'Slopen',
    'Afvalcontainer',
    'Subtotaal Slopen € 750,00',
    'PIR 80 mm',
    'Subtotaal Isoleren € 1.320,00',
    'Dakkapel bekleden',
  ]) {
    expect(tekst).toContain(deel);
  }
  expect(tekst).not.toContain('Subtotaal Dakkapel');
  expect(gestart.paginaFouten).toEqual([]);
});
