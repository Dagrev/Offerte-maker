import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { FOUTMELDINGEN } from '../../src/shared/teksten/fouten';
import { nl } from '../../src/renderer/src/teksten/nl';
import type { InstellingenTab } from '../../src/renderer/src/stores/navigatie';
import {
  apiData,
  maakTestMappen,
  REPO,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';
import { controleerScherm, type Schermuitkomst } from '../helpers/toegankelijkheid';

// NFE-005 (OFM-027, V-24): axe-core en de stijlcontrole op elk scherm: Welkom, Overzicht, alle
// wizardstappen (stap 4 ook met "Maak zonder Claude", OFM-025), Bezig, Detail (met modalen),
// Bewerken, alle instellingen-tabs inclusief alle subtabs van Geavanceerd, Voorbeelden-review en
// Prullenbak. Het iframe met het PDF-voorbeeld valt erbuiten (`exclude('iframe')`).

const uitkomsten: Schermuitkomst[] = [];
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
test.afterAll(() => {
  // Samenvatting voor het werklog.
  const regels = uitkomsten.map(
    (u) =>
      `${u.scherm.padEnd(48)} axe ${u.axe.length}  contrast ${u.contrastfouten}  font ${u.basisfontPx}px  ` +
      `klikbaar ${u.aantalKlikbaar} (te klein ${u.teKlein.length})`,
  );
  console.log(`\nToegankelijkheid per scherm (${uitkomsten.length} schermen):\n${regels.join('\n')}`);
});

const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });

async function dialoog(page: Page, openKnop: string, sluitKnop: string, scherm: string) {
  await knop(page, openKnop).click();
  const venster = page.getByRole('dialog');
  await expect(venster).toBeVisible();
  await controleerScherm(page, scherm, uitkomsten);
  await venster.getByRole('button', { name: sluitKnop, exact: true }).click();
  await expect(venster).toBeHidden();
}

test('alle schermen: axe zonder fouten, font ≥ 18 px, klikdoelen ≥ 48 px', async () => {
  test.setTimeout(180_000);
  gestart = await startApp(mappen, { modus: 'traag' });
  const { page } = gestart;
  const w = nl.welkom;

  // Welkom (drie stappen).
  await expect(page.getByRole('heading', { name: w.titel, level: 1 })).toBeVisible();
  await controleerScherm(page, 'Welkom 1 bedrijfsgegevens', uitkomsten);
  await page.getByLabel(nl.instellingen.bedrijf.naam, { exact: true }).fill('Dakwerken Test');
  await knop(page, w.volgende).click();
  await expect(page.getByRole('heading', { name: w.stapKop(2, w.stappen[1] ?? '') })).toBeVisible();
  await expect(page.getByText(nl.claudeKoppeling.statusLaden)).toHaveCount(0);
  await controleerScherm(page, 'Welkom 2 Claude koppelen', uitkomsten);
  await knop(page, w.volgende).click();
  await expect(page.getByRole('heading', { name: w.stapKop(3, w.stappen[2] ?? '') })).toBeVisible();
  await controleerScherm(page, 'Welkom 3 voorbeelden', uitkomsten);
  await knop(page, w.klaar).click();

  // Overzicht zonder offertes.
  await expect(page.getByText(nl.overzicht.leeg)).toBeVisible();
  await controleerScherm(page, 'Overzicht leeg', uitkomsten);

  // Wizard, vier stappen.
  const wz = nl.wizard;
  await knop(page, nl.overzicht.nieuweOfferte).click();
  await expect(page.getByRole('heading', { name: `1. ${wz.stappen[0]}` })).toBeVisible();
  await controleerScherm(page, 'Wizard 1 klant', uitkomsten);
  await page.getByLabel(wz.klant.naam, { exact: true }).fill('Jansen');
  await page.getByLabel(wz.klant.plaats, { exact: true }).fill('Eindhoven');
  for (let stap = 2; stap <= 4; stap++) {
    await knop(page, wz.volgende).click();
    await expect(page.getByRole('heading', { name: `${stap}. ${wz.stappen[stap - 1]}` })).toBeVisible();
    await controleerScherm(page, `Wizard ${stap} ${wz.stappen[stap - 1]}`, uitkomsten);
  }

  // Bezig (nep-CLI traag), dan Stoppen: stap 4 met melding en "Maak zonder Claude".
  await knop(page, wz.maakDeOfferte).click();
  await expect(page.getByRole('heading', { name: nl.bezig.kop.maken })).toBeVisible();
  await controleerScherm(page, 'Bezig', uitkomsten);
  await knop(page, nl.bezig.stoppen).click();
  await expect(page.getByRole('alert').filter({ hasText: FOUTMELDINGEN.AGENT_AFGEBROKEN })).toBeVisible();
  await expect(knop(page, wz.maakZonderClaude)).toBeVisible();
  await controleerScherm(page, 'Wizard 4 met fout en Maak zonder Claude', uitkomsten);

  // Detail (concept) via Maak zonder Claude, met de modalen.
  const d = nl.detail;
  await knop(page, wz.maakZonderClaude).click();
  await expect(page.getByRole('heading', { name: d.controleerEven })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('iframe')).toBeVisible();
  await controleerScherm(page, 'Detail concept', uitkomsten);
  await dialoog(page, d.laatClaudeAanpassen, d.annuleren, 'Detail modaal Laat Claude aanpassen');
  await dialoog(page, d.maakKopie, d.annuleren, 'Detail modaal Maak kopie');
  await dialoog(page, d.verwijderen, d.nee, 'Detail modaal Verwijderen');

  // Bewerken.
  await knop(page, d.aanpassen).click();
  await expect(page.getByRole('heading', { name: nl.bewerken.titel, level: 1 })).toBeVisible();
  await controleerScherm(page, 'Bewerken', uitkomsten);
  await knop(page, nl.bewerken.annuleren).click();
  await expect(knop(page, d.maakDefinitief)).toBeVisible();

  // Detail na definitief (statusknoppen aan, PDF-knoppen zichtbaar).
  await knop(page, d.maakDefinitief).click();
  await expect(knop(page, d.openPdf)).toBeVisible({ timeout: 20_000 });
  await controleerScherm(page, 'Detail definitief', uitkomsten);

  // Overzicht met een offerte, en zoekresultaten.
  await knop(page, d.terugNaarOverzicht).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Jansen' })).toBeVisible();
  await controleerScherm(page, 'Overzicht met offerte', uitkomsten);
  await page.getByRole('searchbox', { name: nl.overzicht.zoeken }).fill('Jans');
  await expect(page.getByText(nl.overzicht.zoekResultaten(1))).toBeVisible();
  await controleerScherm(page, 'Overzicht zoekresultaten', uitkomsten);
  await knop(page, nl.overzicht.zoekWissen).click();

  // Instellingen: alle tabs en alle subtabs van Geavanceerd.
  const ti = nl.instellingen;
  await knop(page, nl.overzicht.instellingen).click();
  const hoofdtabs: InstellingenTab[] = ['bedrijf', 'opmaak', 'teksten', 'prijzen', 'voorbeelden'];
  for (const tab of hoofdtabs) {
    await knop(page, ti.tab[tab]).click();
    await expect(knop(page, ti.tab[tab])).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('status').filter({ hasText: nl.algemeen.laden })).toHaveCount(0);
    await controleerScherm(page, `Instellingen ${ti.tab[tab]}`, uitkomsten);
  }
  await knop(page, ti.geavanceerd).click();
  const subtabs: InstellingenTab[] = ['claudeKoppeling', 'privacylog', 'backups', 'over'];
  for (const tab of subtabs) {
    await knop(page, ti.tab[tab]).click();
    await expect(knop(page, ti.tab[tab])).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('status').filter({ hasText: nl.algemeen.laden })).toHaveCount(0);
    await controleerScherm(page, `Geavanceerd ${ti.tab[tab]}`, uitkomsten);
    if (tab === 'privacylog') {
      // Ook de detailweergave van een verzending (de gestopte poging van hierboven).
      await page
        .getByRole('button', { name: new RegExp(nl.privacylog.soort.maken) })
        .first()
        .click();
      await expect(knop(page, nl.privacylog.terug)).toBeVisible();
      await controleerScherm(page, 'Geavanceerd privacylog detail', uitkomsten);
      await knop(page, nl.privacylog.terug).click();
    }
  }

  // Voorbeelden-review: een voorbeeld toevoegen via het kanaal (de knop opent een Windows-dialoog).
  const toegevoegd = await apiData(page, 'voorbeeldenVoegToe', {
    paden: [join(REPO, 'test', 'fixtures', 'voorbeelden', 'offerte.pdf')],
  });
  expect(toegevoegd.toegevoegd).toHaveLength(1);
  await page.reload();
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, ti.tab.voorbeelden).click();
  await page.getByRole('button', { name: nl.voorbeelden.bekijkLabel('offerte.pdf') }).click();
  await expect(page.getByRole('heading', { name: nl.voorbeelden.reviewTitel })).toBeVisible();
  await controleerScherm(page, 'Voorbeelden-review', uitkomsten);

  // Prullenbak: de offerte verwijderen en de prullenbak openen.
  await knop(page, ti.terug).click();
  await page.getByRole('listitem').filter({ hasText: 'Jansen' }).click();
  await knop(page, d.verwijderen).click();
  await page.getByRole('dialog').getByRole('button', { name: d.jaVerwijderen }).click();
  await expect(knop(page, nl.overzicht.nieuweOfferte)).toBeVisible();
  await page.getByRole('button', { name: nl.overzicht.prullenbak }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Jansen' })).toBeVisible();
  await controleerScherm(page, 'Prullenbak', uitkomsten);

  expect(gestart.paginaFouten).toEqual([]);
});
