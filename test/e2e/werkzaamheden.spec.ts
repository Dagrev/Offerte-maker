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

// OFM-048 (was OFM-043), sinds OFM-056 in twee tabs: Instellingen › Materialen en prijzen (alfabetisch,
// zoekbalk, Overige prijzen) en › Werkzaamheden (inklapbare kaarten, Alles openen/sluiten). Een materiaal
// en een werkzaamheid met een optie toevoegen, prijs per eenheid en per uur invullen, koppelen aan een
// soort werk en een materiaal; na herladen terugzien. Daarna in de wizard die werkzaamheid per uur
// rekenen, zonder Claude maken en de regel met eenheid "uur" op de PDF terugzien. Axe 0 op beide tabs.

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
const tw = nl.wizard.werk;
const w = nl.wizard;
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });
const WERK = 'Dakkapel bekleden';
const OPTIE = 'Steiger huren';

async function naarTab(page: Page, tab: 'materialen' | 'werkzaamheden'): Promise<void> {
  const tabKnop = knop(page, nl.instellingen.tab[tab]);
  if ((await tabKnop.count()) === 0) await knop(page, nl.overzicht.instellingen).click();
  await tabKnop.click();
  const kop = tab === 'materialen' ? t.materialen : t.werkzaamheden;
  await expect(page.getByRole('heading', { name: kop, level: 2, exact: true })).toBeVisible();
}

/** De namen in een lijst van naamvelden, in schermvolgorde. */
async function namen(page: Page, lijst: string): Promise<string[]> {
  const velden = await page
    .getByRole('list', { name: lijst, exact: true })
    .getByRole('textbox', { name: /^Naam van/ })
    .all();
  return Promise.all(velden.map((v) => v.inputValue()));
}

/** De namen (aria-label) van de kaarten in een lijst, in schermvolgorde. */
async function kaartNamenVan(page: Page, lijst: string): Promise<string[]> {
  const kaarten = await page.getByRole('list', { name: lijst, exact: true }).locator(':scope > li').all();
  return Promise.all(kaarten.map(async (k) => (await k.getAttribute('aria-label')) ?? ''));
}
const abc = (lijst: string[]) =>
  [...lijst].sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));

async function vul(page: Page, label: string, waarde: string): Promise<void> {
  const veld = page.getByLabel(label, { exact: true });
  await veld.fill(waarde);
  await veld.blur();
}

test('materiaal en werkzaamheid met optie en uurprijs in twee tabs; per uur in de wizard en op de PDF', async () => {
  // Statusfout (niet ingelogd): dan kan Maak zonder Claude in stap 4.
  gestart = await startApp(mappen, { modus: 'niet-ingelogd' });
  const { page } = gestart;
  await overslaanWelkom(page);
  await naarTab(page, 'materialen');

  // Tab Materialen en prijzen: materialen en overige prijzen, geen werkzaamheden; oude tabs bestaan niet.
  await expect(page.getByRole('button', { name: 'Prijzen', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Werkzaamheden en prijzen', exact: true })).toHaveCount(0);
  for (const kop of [t.materialen, t.overig]) {
    await expect(page.getByRole('heading', { name: kop, level: 2, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: t.werkzaamheden, level: 2, exact: true })).toHaveCount(0);
  await controleerScherm(page, 'Instellingen Materialen en prijzen', []);

  // 1. Materialen alfabetisch; een nieuw materiaal komt op zijn plek en krijgt de focus.
  const voor = await namen(page, t.materialen);
  expect(voor.length).toBeGreaterThan(2);
  expect(voor).toEqual(abc(voor));
  await page.getByLabel(t.nieuwMateriaal, { exact: true }).fill('Zink');
  await knop(page, t.materiaalToevoegen).click();
  await expect(page.getByLabel(t.materiaalNaam('Zink'), { exact: true })).toHaveValue('Zink');
  await expect(page.getByLabel(t.materiaalNaam('Zink'), { exact: true })).toBeFocused();
  await page.getByLabel(t.nieuwMateriaal, { exact: true }).fill('Afdekkap');
  await knop(page, t.materiaalToevoegen).click();
  await expect(page.getByLabel(t.materiaalNaam('Afdekkap'), { exact: true })).toBeFocused();
  const na = await namen(page, t.materialen);
  expect(na).toEqual(abc([...voor, 'Zink', 'Afdekkap']));
  expect(na[0]).toBe('Afdekkap');
  await vul(page, t.materiaalPrijs('Zink'), '12,50');
  await page.getByLabel(t.materiaalBtw('Zink'), { exact: true }).selectOption('9');

  // Zoeken: deel van het woord, zonder hoofdletters; niets gevonden; leeg = alles.
  await page.getByLabel(t.nieuwMateriaal, { exact: true }).fill('Houtschroef 5 x 50');
  await knop(page, t.materiaalToevoegen).click();
  await expect(page.getByLabel(t.materiaalNaam('Houtschroef 5 x 50'), { exact: true })).toBeFocused();
  const zoek = page.getByRole('searchbox', { name: t.zoekMateriaal });
  await zoek.fill('SCHROEF');
  expect(await namen(page, t.materialen)).toEqual(['Houtschroef 5 x 50']);
  await zoek.fill('xyz');
  await expect(page.getByText(t.geenMaterialenGevonden)).toBeVisible();
  await controleerScherm(page, 'Materialen en prijzen zonder zoekresultaat', []);
  await zoek.fill('');
  expect(await namen(page, t.materialen)).toHaveLength(na.length + 1);

  // Overige prijzen: voorrijkosten.
  await vul(page, t.postPrijs('Voorrijkosten'), '45');
  await expect(page.getByText(nl.componenten.bewaard).first()).toBeVisible();

  // 2. Tab Werkzaamheden: alle kaarten dicht en alfabetisch.
  await naarTab(page, 'werkzaamheden');
  await expect(page.getByRole('heading', { name: t.materialen, level: 2, exact: true })).toHaveCount(0);
  const kaartNamen = await kaartNamenVan(page, t.werkzaamheden);
  expect(kaartNamen.length).toBeGreaterThan(2);
  expect(kaartNamen).toEqual(abc(kaartNamen));
  const open = page.locator('button[aria-expanded="true"]');
  await expect(page.locator('button[aria-expanded="false"]')).toHaveCount(kaartNamen.length);
  await expect(open).toHaveCount(0);
  await controleerScherm(page, 'Instellingen Werkzaamheden dicht', []);

  // Werkzaamheid toevoegen: komt open op zijn plek, focus op het naamveld; eenheid, prijzen, hoort bij,
  // materiaal, optie.
  await page.getByLabel(t.nieuwWerk, { exact: true }).fill(WERK);
  await knop(page, t.werkToevoegen).click();
  await expect(page.getByLabel(t.werkNaam(WERK), { exact: true })).toHaveValue(WERK);
  await expect(page.getByLabel(t.werkNaam(WERK), { exact: true })).toBeFocused();
  const kaart = page.getByRole('listitem', { name: WERK, exact: true });
  const kaartKnop = kaart.getByRole('button', { name: WERK, exact: true });
  await expect(kaartKnop).toHaveAttribute('aria-expanded', 'true');
  expect(await kaartNamenVan(page, t.werkzaamheden)).toEqual(abc([...kaartNamen, WERK]));
  await expect(kaart.getByText(t.hoortBijNiets)).toBeVisible();
  await page.getByLabel(t.werkEenheid(WERK), { exact: true }).selectOption('m¹');
  await vul(page, t.werkPrijs(WERK), '85');
  await vul(page, t.werkUurprijs(WERK), '55');
  await kaart
    .getByRole('group', { name: t.hoortBij(WERK) })
    .getByLabel('Dak vervangen', { exact: true })
    .check();
  await kaart
    .getByRole('group', { name: t.kiesbareMaterialen(WERK) })
    .getByLabel('Zink', { exact: true })
    .check();
  await page.getByLabel(t.standaardMateriaal(WERK), { exact: true }).selectOption({ label: 'Zink' });
  await page.getByLabel(t.nieuweOptie(WERK), { exact: true }).fill(OPTIE);
  await kaart.getByRole('button', { name: t.optieToevoegen, exact: true }).click();
  await vul(page, t.optiePrijs(OPTIE, WERK), '150');

  await expect(page.getByText(nl.componenten.bewaard).first()).toBeVisible();

  // Kaart sluiten en openen; de stand blijft bij een wissel van tab.
  await kaartKnop.click();
  await expect(kaartKnop).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel(t.werkNaam(WERK), { exact: true })).toHaveCount(0);
  await expect(kaart).toContainText('€ 85,00 per eenheid');
  await expect(kaart).toContainText('€ 55,00 per uur');
  await expect(kaart).toContainText('1 optie');
  await expect(kaart).toContainText('1 materiaal');
  await kaartKnop.click();
  await expect(page.getByLabel(t.werkNaam(WERK), { exact: true })).toBeVisible();
  await naarTab(page, 'materialen');
  await naarTab(page, 'werkzaamheden');
  await expect(kaartKnop).toHaveAttribute('aria-expanded', 'true');
  await expect(open).toHaveCount(1);
  // Alles openen en sluiten.
  await knop(page, t.allesOpenen).click();
  await expect(open).toHaveCount(kaartNamen.length + 1);
  await controleerScherm(page, 'Instellingen Werkzaamheden open', []);
  await knop(page, t.allesSluiten).click();
  await expect(open).toHaveCount(0);

  // Bewaard in main (de laatste bewaaractie kan nog onderweg zijn).
  await expect
    .poll(async () => {
      const set = await apiData(page, 'werkzaamhedenHaal');
      const werk = set.werkzaamheden.find((x) => x.label === WERK);
      const zink = set.materialen.find((m) => m.label === 'Zink');
      const posten = await apiData(page, 'prijzenLijst');
      return {
        werk: werk && {
          sleutel: werk.sleutel,
          eenheid: werk.eenheid,
          prijsCent: werk.prijsCent,
          uurprijsCent: werk.uurprijsCent,
          soortenWerk: werk.soortenWerk,
          opties: werk.opties.map((o) => [o.sleutel, o.prijsCent]),
          materialen: werk.materialen.map((m) => ({ ...m, materiaalId: m.materiaalId === zink?.id })),
        },
        zink: zink && [zink.prijsCent, zink.btwTarief],
        uurpost: posten.find((p) => p.sleutel === 'werk:dakkapel_bekleden:uur')?.prijsCent,
        voorrijkosten: posten.find((p) => p.sleutel === 'voorrijkosten')?.prijsCent,
      };
    })
    .toEqual({
      werk: {
        sleutel: 'dakkapel_bekleden',
        eenheid: 'm¹',
        prijsCent: 8500,
        uurprijsCent: 5500,
        soortenWerk: ['dak_vervangen'],
        opties: [['steiger_huren', 15000]],
        materialen: [{ materiaalId: true, standaard: true }],
      },
      zink: [1250, 9],
      uurpost: 5500,
      voorrijkosten: 4500,
    });

  // De soorten werk zelf staan onder Keuzelijsten; de knop gaat erheen.
  await knop(page, t.naarKeuzelijsten).click();
  await expect(knop(page, nl.instellingen.tab.keuzelijsten)).toHaveAttribute('aria-pressed', 'true');

  // Herladen: alles staat er nog.
  await page.reload();
  await naarTab(page, 'materialen');
  await expect(page.getByLabel(t.materiaalBtw('Zink'), { exact: true })).toHaveValue('9');
  await naarTab(page, 'werkzaamheden');
  await page
    .getByRole('listitem', { name: WERK, exact: true })
    .getByRole('button', { name: WERK, exact: true })
    .click();
  await expect(page.getByLabel(t.werkUurprijs(WERK), { exact: true })).toHaveValue('55');
  await expect(page.getByLabel(t.werkPrijs(WERK), { exact: true })).toHaveValue('85');
  await expect(page.getByLabel(t.optieNaam(OPTIE, WERK), { exact: true })).toHaveValue(OPTIE);
  await expect(
    page
      .getByRole('listitem', { name: WERK, exact: true })
      .getByRole('group', { name: t.hoortBij(WERK) })
      .getByLabel('Dak vervangen', { exact: true }),
  ).toBeChecked();
  await controleerScherm(page, 'Instellingen Werkzaamheden ingevuld', []);

  // 4. Wizard: de werkzaamheid per uur.
  await knop(page, nl.instellingen.terug).click();
  await knop(page, nl.overzicht.nieuweOfferte).click();
  await vulKlantIn(page, { achternaam: 'Uurman', plaats: 'Eindhoven' });
  await knop(page, w.volgende).click();
  await vulDakIn(page);
  await knop(page, w.volgende).click();
  await knop(page, 'Dak vervangen').click();
  await knop(page, WERK).click();
  const regio = page.getByRole('region', { name: WERK });
  await expect(page.getByLabel(tw.prijsVan(WERK), { exact: true })).toHaveValue('85');
  await regio.getByLabel(tw.perUur, { exact: true }).check();
  await expect(page.getByLabel(tw.urenVan(WERK), { exact: true })).toHaveValue('1');
  await expect(page.getByLabel(tw.uurprijsVan(WERK), { exact: true })).toHaveValue('55');
  await page.getByLabel(tw.urenVan(WERK), { exact: true }).fill('6');
  await expect(regio.getByText(`${tw.subtotaal}: € 342,50`)).toBeVisible();

  // Een werkzaamheid zonder uurprijs: melding, en de prijs is met de hand in te vullen.
  await knop(page, 'Slopen').click();
  const slopen = page.getByRole('region', { name: 'Slopen' });
  await slopen.getByLabel(tw.perUur, { exact: true }).check();
  await expect(slopen.getByText(tw.geenUurprijs)).toBeVisible();
  await controleerScherm(page, 'Wizard 3 per uur', []);
  // Weer uitzetten (een gekozen tegel heet 'Slopen' plus 'gekozen').
  await page
    .getByRole('button', { name: /^Slopen/ })
    .first()
    .click();
  await expect(slopen).toHaveCount(0);

  await knop(page, w.volgende).click();
  await knop(page, w.maakZonderClaude).click();
  // Alle prijzen ingevuld: geen gele balk, meteen het detailscherm.
  await expect(knop(page, nl.detail.maakDefinitief)).toBeVisible({ timeout: 15_000 });
  const id = await offerteIdVan(page, 'Uurman');
  const detail = await apiData(page, 'offerteHaal', { id });
  const regels = detail.inhoud?.regels ?? [];
  expect(
    regels.slice(0, 2).map((r) => [r.omschrijving, r.aantalHonderdsten, r.eenheid, r.prijsCent, r.prijsbron]),
  ).toEqual([
    [WERK, 600, 'uur', 5500, 'prijslijst'],
    // Zink (m²) bij een werkzaamheid in m¹: aantal 1 bij het kiezen.
    ['Zink', 100, 'm²', 1250, 'prijslijst'],
  ]);

  // Definitief maken: de regel staat met eenheid uur op de PDF.
  await knop(page, nl.detail.maakDefinitief).click();
  await expect(knop(page, nl.detail.openPdf)).toBeVisible({ timeout: 20_000 });
  const map = join(mappen.docs, '2026');
  const pdf = readdirSync(map).find((n) => n.endsWith('.pdf'));
  expect(pdf).toBeDefined();
  const { text } = await extractText(new Uint8Array(readFileSync(join(map, pdf ?? ''))), {
    mergePages: true,
  });
  expect(text.replace(/\s+/g, ' ')).toMatch(/Dakkapel bekleden 6(,00)? uur € 55,00/);
  expect(gestart.paginaFouten).toEqual([]);
});
