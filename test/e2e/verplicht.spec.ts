import { expect, test, type Page } from '@playwright/test';
import { nl } from '../../src/renderer/src/teksten/nl';
import { WIZARD_PUNT_TEKSTEN } from '../../src/shared/teksten/wizardPunten';
import {
  api,
  apiData,
  maakTestMappen,
  nepClaudeAanroepen,
  nieuweOfferteTotStap4,
  overslaanWelkom,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// OFM-038: instelbare verplichte velden. Standaard is alles van stap 1 verplicht, dus zonder e-mail
// geen offerte; na het uitzetten van E-mail onder Instellingen › Verplichte velden wel.

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
const v = nl.verplicht;
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });

test('zonder e-mail geen offerte; na uitzetten van E-mail in de tab wel', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);

  // Standaard: alles van stap 1 verplicht. Alleen de e-mail blijft leeg.
  const id = await nieuweOfferteTotStap4(page, {
    voornaam: 'Mia',
    achternaam: 'Zondermail',
    plaats: 'Eindhoven',
    email: '',
  });
  await knop(page, w.maakDeOfferte).click();
  const samenvatting = page.getByRole('alert').filter({ hasText: w.punten.kop });
  await expect(samenvatting.getByRole('listitem')).toHaveText([new RegExp(WIZARD_PUNT_TEKSTEN.email)]);
  // Main weigert het ook, met dezelfde tekst.
  const uit = await api(page, 'offerteMaak', { id });
  expect(uit).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
  expect(uit.ok ? '' : uit.fout.melding).toContain(WIZARD_PUNT_TEKSTEN.email);
  expect((await apiData(page, 'offerteHaal', { id })).klant).toMatchObject({
    voornaam: 'Mia',
    achternaam: 'Zondermail',
    email: '',
  });
  expect(nepClaudeAanroepen(mappen)).toEqual([]);

  // Instellingen › Verplichte velden: E-mail uit (direct bewaard); Herstel standaard zet hem terug.
  await knop(page, w.terugNaarOverzicht).click();
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.verplicht).click();
  const email = page.getByLabel(v.veld.email, { exact: true });
  await expect(email).toBeChecked();
  // Soort werk en een dakvlak staan vast aan.
  await expect(page.getByLabel(v.veld.soortWerk, { exact: true })).toBeDisabled();
  await expect(page.getByLabel(v.veld.dakvlak, { exact: true })).toBeChecked();
  await email.uncheck();
  await expect(page.getByText(nl.componenten.bewaard)).toBeVisible();
  await expect.poll(async () => (await apiData(page, 'instellingenHaal')).verplicht.email).toBe(false);
  await knop(page, v.herstel).click();
  await expect(email).toBeChecked();
  await expect.poll(async () => (await apiData(page, 'instellingenHaal')).verplicht.email).toBe(true);
  await email.uncheck();
  await expect.poll(async () => (await apiData(page, 'instellingenHaal')).verplicht.email).toBe(false);

  // Terug naar de offerte: nu kan hij gemaakt worden.
  await knop(page, nl.instellingen.terug).click();
  await page.getByRole('listitem').filter({ hasText: 'Zondermail' }).click();
  await expect(page.getByRole('heading', { name: `4. ${w.stappen[3]}` })).toBeVisible();
  await knop(page, w.maakDeOfferte).click();
  await expect(page.getByRole('heading', { name: nl.detail.controleerEven })).toBeVisible({
    timeout: 15_000,
  });
  expect(nepClaudeAanroepen(mappen)).toHaveLength(1);
  expect(gestart.paginaFouten).toEqual([]);
});
