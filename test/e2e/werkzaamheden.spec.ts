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

// OFM-048 (was OFM-043): Instellingen › Werkzaamheden en prijzen. Een materiaal en een werkzaamheid met
// een optie toevoegen, prijs per eenheid en per uur invullen, koppelen aan een soort werk en een
// materiaal; na herladen terugzien. Daarna in de wizard die werkzaamheid per uur rekenen, zonder
// Claude maken en de regel met eenheid "uur" op de PDF terugzien. Axe 0 op de tab.

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

async function naarTab(page: Page): Promise<void> {
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.werkzaamheden).click();
  await expect(page.getByRole('heading', { name: t.werkzaamheden, level: 2 })).toBeVisible();
}

async function vul(page: Page, label: string, waarde: string): Promise<void> {
  const veld = page.getByLabel(label, { exact: true });
  await veld.fill(waarde);
  await veld.blur();
}

test('materiaal en werkzaamheid met optie en uurprijs in één tab; per uur in de wizard en op de PDF', async () => {
  // Statusfout (niet ingelogd): dan kan Maak zonder Claude in stap 4.
  gestart = await startApp(mappen, { modus: 'niet-ingelogd' });
  const { page } = gestart;
  await overslaanWelkom(page);
  await naarTab(page);

  // Eén tab: Prijzen bestaat niet meer; drie secties.
  await expect(page.getByRole('button', { name: 'Prijzen', exact: true })).toHaveCount(0);
  for (const kop of [t.materialen, t.werkzaamheden, t.overig]) {
    await expect(page.getByRole('heading', { name: kop, level: 2 })).toBeVisible();
  }
  await controleerScherm(page, 'Instellingen Werkzaamheden en prijzen', []);

  // 1. Materiaal toevoegen met prijs en btw.
  await page.getByLabel(t.nieuwMateriaal, { exact: true }).fill('Zink');
  await knop(page, t.materiaalToevoegen).click();
  await expect(page.getByLabel(t.materiaalNaam('Zink'), { exact: true })).toHaveValue('Zink');
  await vul(page, t.materiaalPrijs('Zink'), '12,50');
  await page.getByLabel(t.materiaalBtw('Zink'), { exact: true }).selectOption('9');

  // 2. Werkzaamheid toevoegen: eenheid, prijs per eenheid en per uur, hoort bij, materiaal, optie.
  await page.getByLabel(t.nieuwWerk, { exact: true }).fill(WERK);
  await knop(page, t.werkToevoegen).click();
  await expect(page.getByLabel(t.werkNaam(WERK), { exact: true })).toHaveValue(WERK);
  const kaart = page.getByRole('listitem', { name: WERK, exact: true });
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

  // 3. Overige prijzen: voorrijkosten.
  await vul(page, t.postPrijs('Voorrijkosten'), '45');
  await expect(page.getByText(nl.componenten.bewaard).first()).toBeVisible();

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
  await naarTab(page);
  await expect(page.getByLabel(t.werkUurprijs(WERK), { exact: true })).toHaveValue('55');
  await expect(page.getByLabel(t.werkPrijs(WERK), { exact: true })).toHaveValue('85');
  await expect(page.getByLabel(t.materiaalBtw('Zink'), { exact: true })).toHaveValue('9');
  await expect(page.getByLabel(t.optieNaam(OPTIE, WERK), { exact: true })).toHaveValue(OPTIE);
  await expect(
    page
      .getByRole('listitem', { name: WERK, exact: true })
      .getByRole('group', { name: t.hoortBij(WERK) })
      .getByLabel('Dak vervangen', { exact: true }),
  ).toBeChecked();
  await controleerScherm(page, 'Instellingen Werkzaamheden en prijzen ingevuld', []);

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
