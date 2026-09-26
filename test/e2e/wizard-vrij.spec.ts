import { expect, test, type Page } from '@playwright/test';
import { WIZARD_PUNT_TEKSTEN } from '../../src/shared/teksten/wizardPunten';
import { VERPLICHT_VELDEN, type Verplicht } from '../../src/shared/verplicht';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  api,
  maakTestMappen,
  nepClaudeAanroepen,
  offerteIdVan,
  overslaanWelkom,
  sluitApp,
  startApp,
  vulDakIn,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';
import { controleerScherm, type Schermuitkomst } from '../helpers/toegankelijkheid';

// OFM-035: vrij tussen de wizardstappen bewegen; ontbrekende invoer pas bij Maak de offerte in één
// samenvatting (role="alert") met knoppen "Naar stap n"; dezelfde controle in main.

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
const alleenAchternaam: Verplicht = {
  ...(Object.fromEntries(VERPLICHT_VELDEN.map((v) => [v, false])) as Verplicht),
  achternaam: true,
};
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });
const kop = (page: Page, stap: number) =>
  page.getByRole('heading', { name: `${stap}. ${w.stappen[stap - 1]}` });

test('van stap 1 direct naar stap 4, samenvatting, terugspringen en daarna maken', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  // OFM-038: in stap 1 alleen de achternaam verplicht (de standaard is alles van stap 1; zie
  // verplicht.spec.ts), zodat dit scenario over het vrij navigeren gaat.
  await apiData(page, 'instellingenBewaar', { sleutel: 'verplicht', waarde: alleenAchternaam });
  await page.reload(); // de renderer heeft de instellingen al in zijn cache
  await knop(page, nl.overzicht.nieuweOfferte).click();
  await expect(kop(page, 1)).toBeVisible();

  // Lege stap 1: markeringen in de stappenbalk (1 punt in stap 1, 2 in stap 2).
  const balk = page.getByRole('navigation', { name: nl.componenten.stappen });
  await expect(balk.getByText(nl.componenten.stapPunten(1))).toBeVisible();
  await expect(balk.getByText(nl.componenten.stapPunten(2))).toBeVisible();

  // Stappenbalk: direct naar stap 4, zonder iets in te vullen; Volgende/Vorige blokkeren ook niet.
  await balk.getByRole('button', { name: new RegExp(w.stappen[3]) }).click();
  await expect(kop(page, 4)).toBeVisible();
  await knop(page, w.vorige).click();
  await expect(kop(page, 3)).toBeVisible();
  await knop(page, w.volgende).click();
  await expect(kop(page, 4)).toBeVisible();

  // Maak de offerte: samenvatting in plaats van maken.
  await knop(page, w.maakDeOfferte).click();
  const samenvatting = page.getByRole('alert').filter({ hasText: w.punten.kop });
  await expect(samenvatting).toBeVisible();
  await expect(samenvatting.getByRole('listitem')).toHaveText([
    new RegExp(WIZARD_PUNT_TEKSTEN.achternaam),
    new RegExp(WIZARD_PUNT_TEKSTEN.soortWerk),
    new RegExp(WIZARD_PUNT_TEKSTEN.dakvlak),
  ]);
  await expect(kop(page, 4)).toBeVisible();
  const uitkomsten: Schermuitkomst[] = [];
  await controleerScherm(page, 'Wizard 4 met samenvatting', uitkomsten);

  // Naar stap 1: achternaam invullen; de melding onder het veld staat er (na de poging).
  await samenvatting.getByRole('button', { name: w.punten.naarStap(1) }).click();
  await expect(kop(page, 1)).toBeVisible();
  await expect(page.getByText(w.klant.veldLeeg)).toBeVisible();
  await page.getByLabel(w.klant.achternaam, { exact: true }).fill('Vrij');
  // Main weigert het ook: offerte:maak en offerte:maakZonderClaude geven VALIDATIE met de punten.
  await expect.poll(() => offerteIdVan(page, 'Vrij').catch(() => '')).not.toBe('');
  const offerteId = await offerteIdVan(page, 'Vrij');
  for (const kanaal of ['offerteMaak', 'offerteMaakZonderClaude'] as const) {
    const uit = await api(page, kanaal, { id: offerteId });
    expect(uit).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
    expect(uit.ok ? '' : uit.fout.melding).toContain(WIZARD_PUNT_TEKSTEN.soortWerk);
  }
  expect(nepClaudeAanroepen(mappen)).toEqual([]);

  // Via de stappenbalk naar stap 4: nog twee punten, en een knop naar stap 2.
  await balk.getByRole('button', { name: new RegExp(w.stappen[3]) }).click();
  await expect(samenvatting.getByRole('listitem')).toHaveCount(2);
  await samenvatting
    .getByRole('button', { name: w.punten.naarStap(2) })
    .first()
    .click();
  await expect(kop(page, 2)).toBeVisible();
  await vulDakIn(page);
  await expect(balk.getByText(/punten? nog niet in orde/)).toHaveCount(0);

  // Terug naar stap 4: de samenvatting is weg en de offerte wordt gemaakt.
  await balk.getByRole('button', { name: new RegExp(w.stappen[3]) }).click();
  await expect(kop(page, 4)).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: w.punten.kop })).toHaveCount(0);
  await knop(page, w.maakDeOfferte).click();
  await expect(page.getByRole('heading', { name: nl.detail.controleerEven })).toBeVisible({
    timeout: 15_000,
  });
  expect(nepClaudeAanroepen(mappen)).toHaveLength(1);
  // wizardStap bewaart de laatst geopende stap.
  expect((await apiData(page, 'offerteHaal', { id: offerteId })).wizardStap).toBe(4);
  expect(gestart.paginaFouten).toEqual([]);
});
