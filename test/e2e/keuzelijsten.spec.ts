import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { extractText } from 'unpdf';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  api,
  apiData,
  maakTestMappen,
  offerteIdVan,
  overslaanWelkom,
  sluitApp,
  startApp,
  nieuweOfferteTotStap4,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// OFM-034: een keuze toevoegen, hernoemen en verbergen onder Instellingen › Keuzelijsten, en dat
// terugzien in de wizard, de lijst en op de PDF (via "Maak zonder Claude": titel en garantie).
// OFM-049: de standaardkeuze per lijst instellen en terugzien in een nieuwe offerte.

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

async function kiesLijst(page: Page, lijst: keyof typeof k.lijst): Promise<void> {
  await knop(page, k.lijst[lijst]).click();
  await expect(page.getByRole('heading', { name: k.lijst[lijst], level: 2 })).toBeVisible();
}

async function voegToe(page: Page, label: string): Promise<void> {
  await page.getByLabel(k.nieuw, { exact: true }).fill(label);
  await knop(page, k.toevoegen).click();
  await expect(page.getByLabel(k.naamVan(label), { exact: true })).toBeVisible();
}

test('toevoegen, hernoemen en verbergen: zichtbaar in wizard, lijst en PDF', async () => {
  // Statusfout (niet ingelogd): dan staat "Maak zonder Claude" in stap 4 (V-09).
  gestart = await startApp(mappen, { modus: 'niet-ingelogd' });
  const { page } = gestart;
  await overslaanWelkom(page);

  // Instellingen › Keuzelijsten.
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.keuzelijsten).click();
  await expect(page.getByRole('heading', { name: k.lijst.soortWerk, level: 2 })).toBeVisible();
  // OFM-044/045: de lijsten van de oude stap Extra's bestaan niet meer.
  await expect(knop(page, "Extra's")).toHaveCount(0);

  // Hernoemen (soort werk): bewaart vanzelf.
  const nieuwDak = page.getByLabel(k.naamVan('Nieuw dak'), { exact: true });
  await nieuwDak.fill('Compleet nieuw dak');
  await expect(page.getByText(nl.componenten.bewaard)).toBeVisible();

  // Verbergen (soort werk Onderhoud); toevoegen (garantie).
  await knop(page, k.verberg('Onderhoud')).click();
  await expect(knop(page, k.toon('Onderhoud'))).toBeVisible();
  await kiesLijst(page, 'garantie');
  await voegToe(page, '15 jaar');
  // De standaardkeuze (10 jaar) kan niet verborgen of verwijderd worden: melding (OFM-049).
  await knop(page, k.verberg('10 jaar')).click();
  await expect(page.getByRole('alert')).toHaveText(k.standaardNietWeg('10 jaar'));

  const lijsten = await apiData(page, 'keuzelijstenHaal');
  expect(lijsten.garantie.find((o) => o.label === '15 jaar')).toMatchObject({ sleutel: '15_jaar' });
  expect(lijsten.soortWerk.find((o) => o.sleutel === 'onderhoud')?.verborgen).toBe(true);

  // Wizard: soort werk staat sinds OFM-044 in stap 3.
  await knop(page, nl.instellingen.terug).click();
  await nieuweOfferteTotStap4(page, { achternaam: 'Bakker', plaats: 'Veldhoven' });
  await page
    .getByRole('navigation', { name: nl.componenten.stappen })
    .getByRole('button', { name: new RegExp(w.stappen[2]) })
    .click();
  await expect(page.getByRole('heading', { name: `3. ${w.stappen[2]}` })).toBeVisible();
  await expect(knop(page, 'Onderhoud')).toHaveCount(0);
  await expect(knop(page, 'Nieuw dak')).toHaveCount(0);
  await knop(page, 'Compleet nieuw dak').click();
  await knop(page, '15 jaar').click();
  await knop(page, w.volgende).click();
  await expect(page.getByRole('heading', { name: `4. ${w.stappen[3]}` })).toBeVisible();
  const samenvatting = page.locator('dl');
  await expect(samenvatting).toContainText('Compleet nieuw dak');
  await expect(samenvatting).toContainText('15 jaar');

  // Maak zonder Claude → detail → definitief.
  await knop(page, w.maakZonderClaude).click();
  await expect(page.getByRole('heading', { name: nl.detail.controleerEven })).toBeVisible({
    timeout: 15_000,
  });
  const id = await offerteIdVan(page, 'Bakker');
  const detail = await apiData(page, 'offerteHaal', { id });
  expect(detail.inhoud?.titel).toBe('Offerte compleet nieuw dak');
  await knop(page, nl.detail.maakDefinitief).click();
  await expect(knop(page, nl.detail.openPdf)).toBeVisible({ timeout: 20_000 });

  const map = join(mappen.docs, '2026');
  const pdf = readdirSync(map).find((n) => n.endsWith('.pdf'));
  expect(pdf).toBeDefined();
  const { text } = await extractText(new Uint8Array(readFileSync(join(map, pdf ?? ''))), {
    mergePages: true,
  });
  const tekst = text.replace(/\s+/g, ' ');
  expect(tekst).toContain('Offerte compleet nieuw dak');
  expect(tekst).toContain('Op de uitgevoerde werkzaamheden geven wij garantie: 15 jaar.');

  // Hernoemen werkt ook achteraf door in de lijst (korte omschrijving).
  await apiData(page, 'keuzelijstenBewaar', {
    lijst: 'soortWerk',
    opties: (await apiData(page, 'keuzelijstenHaal')).soortWerk.map((o) => ({
      id: o.id,
      label: o.sleutel === 'nieuw_dak' ? 'Nieuwbouw' : o.label,
      verborgen: o.verborgen,
      standaardkeuze: o.standaardkeuze,
    })),
  });
  const [item] = await apiData(page, 'overzichtZoek', { tekst: 'Bakker' });
  expect(item?.omschrijvingKort).toBe('Nieuwbouw · 40 m²');

  expect(gestart.paginaFouten).toEqual([]);
});

test('een verborgen keuze blijft zichtbaar (grijs) in een offerte die hem al had; verwijderen kan dan niet', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  const { id } = await apiData(page, 'offerteNieuw', {});
  const detail = await apiData(page, 'offerteHaal', { id });
  await apiData(page, 'offerteBewaarInvoer', {
    id,
    klant: { ...detail.klant, achternaam: 'De Wit', adres: { ...detail.klant.adres, plaats: 'Best' } },
    invoer: { ...detail.invoer, soortWerk: 'onderhoud' },
    wizardStap: 3,
  });
  const lijsten = await apiData(page, 'keuzelijstenHaal');
  expect(lijsten.soortWerk.find((o) => o.sleutel === 'onderhoud')?.inGebruik).toBe(true);
  await apiData(page, 'keuzelijstenBewaar', {
    lijst: 'soortWerk',
    opties: lijsten.soortWerk.map((o) => ({
      id: o.id,
      label: o.label,
      verborgen: o.sleutel === 'onderhoud',
      standaardkeuze: o.standaardkeuze,
    })),
  });

  // Verwijderen via de tab: melding "staat nog in een offerte" met alleen verbergen.
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.keuzelijsten).click();
  await knop(page, k.verwijder('Onderhoud')).click();
  await expect(page.getByText(k.inGebruik('Onderhoud'))).toBeVisible();
  await knop(page, k.sluiten).click();
  await knop(page, nl.instellingen.terug).click();

  // Wizard van die offerte: Onderhoud staat er nog, gekozen en gemarkeerd.
  await page.reload();
  await page.getByRole('listitem').filter({ hasText: 'De Wit' }).click();
  await expect(page.getByRole('heading', { name: `3. ${w.stappen[2]}` })).toBeVisible();
  const onderhoud = page.getByRole('button', { name: /^Onderhoud/ });
  await expect(onderhoud).toHaveAttribute('aria-pressed', 'true');
  await expect(onderhoud).toContainText(nl.componenten.nietMeerInLijst);
  // Een andere keuze kiezen mag; daarna is Onderhoud weg uit de tegels.
  await knop(page, 'Reparatie').click();
  await expect(page.getByRole('button', { name: /^Onderhoud/ })).toHaveCount(0);
  expect(gestart.paginaFouten).toEqual([]);
});

test('OFM-049: standaard soort dak "hellend" staat voorgeselecteerd in een nieuwe offerte; de standaard verwijderen weigert', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);

  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.keuzelijsten).click();
  await kiesLijst(page, 'soortDak');
  // Startset: soort dak zonder standaard.
  await expect(page.getByRole('radio', { name: k.geenStandaard })).toBeChecked();
  await page.getByRole('radio', { name: `${k.standaard}${k.standaardVoor('hellend dak')}` }).check();
  await expect(page.getByText(nl.componenten.bewaard)).toBeVisible();
  const lijsten = await apiData(page, 'keuzelijstenHaal');
  expect(lijsten.soortDak.map((o) => [o.sleutel, o.standaardkeuze])).toEqual([
    ['plat', false],
    ['hellend', true],
  ]);

  // Verwijderen en verbergen van de standaard: melding, niets gewijzigd.
  await knop(page, k.verwijder('hellend dak')).click();
  await expect(page.getByRole('alert')).toHaveText(k.standaardNietWeg('hellend dak'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await knop(page, k.verberg('hellend dak')).click();
  await expect(page.getByRole('alert')).toHaveText(k.standaardNietWeg('hellend dak'));
  // Ook main weigert het (bijv. een verouderd venster).
  const fout = await api(page, 'keuzelijstenBewaar', {
    lijst: 'soortDak',
    opties: lijsten.soortDak
      .filter((o) => o.sleutel !== 'hellend')
      .map(({ id, label, verborgen, standaardkeuze }) => ({ id, label, verborgen, standaardkeuze })),
  });
  expect(fout).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
  await expect(page.getByLabel(k.naamVan('hellend dak'), { exact: true })).toBeVisible();

  // Nieuwe offerte: stap 2 heeft Hellend dak al gekozen; hoogte staat op de standaard van de startset.
  await knop(page, nl.instellingen.terug).click();
  await page.getByRole('button', { name: nl.overzicht.nieuweOfferte }).click();
  await expect(page.getByRole('heading', { name: `1. ${w.stappen[0]}` })).toBeVisible();
  await knop(page, w.volgende).click();
  await expect(page.getByRole('heading', { name: `2. ${w.stappen[1]}` })).toBeVisible();
  // Een gekozen tegel heet "<label> gekozen".
  const tegel = (naam: string) => page.getByRole('button', { name: new RegExp(`^${naam}`) });
  await expect(tegel('Hellend dak')).toHaveAttribute('aria-pressed', 'true');
  await expect(tegel('Plat dak')).toHaveAttribute('aria-pressed', 'false');
  await expect(tegel('Begane grond')).toHaveAttribute('aria-pressed', 'true');

  expect(gestart.paginaFouten).toEqual([]);
});
