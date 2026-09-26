import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  maakTestMappen,
  nieuweOfferteTotStap4,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// Happy flow (TDO §15.4, OFM-027): welkom → bedrijfsgegevens → nieuwe offerte → maken (nep-CLI `ok`)
// → controleren (gele balk: 2 controlepunten + 1 schattingsregel) → definitief → PDF → Akkoord.

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

test('van welkom tot een akkoord-offerte met PDF', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  const w = nl.welkom;

  // Welkom, stap 1: bedrijfsgegevens (geen verplichte velden meer, OFM-029; zie welkom-leeg.spec.ts).
  await expect(page.getByRole('heading', { name: w.titel, level: 1 })).toBeVisible();
  await page.getByLabel(nl.instellingen.bedrijf.naam, { exact: true }).fill('Dakwerken Test');
  await page.getByRole('button', { name: w.volgende, exact: true }).click();
  // Stap 2: Claude-koppeling (nep-CLI: gekoppeld, dus geen gele melding).
  await expect(page.getByRole('heading', { name: w.stapKop(2, w.stappen[1] ?? '') })).toBeVisible();
  await expect(page.getByText(w.nietGekoppeld)).toHaveCount(0);
  await page.getByRole('button', { name: w.volgende, exact: true }).click();
  // Stap 3: voorbeelden, dan Klaar.
  await expect(page.getByRole('heading', { name: w.stapKop(3, w.stappen[2] ?? '') })).toBeVisible();
  await page.getByRole('button', { name: w.klaar, exact: true }).click();

  // Hoofdscherm → wizard → maken.
  await nieuweOfferteTotStap4(page, { naam: 'Jansen', plaats: 'Eindhoven' });
  await page.getByRole('button', { name: nl.wizard.maakDeOfferte }).click();
  await expect(page.getByRole('heading', { name: nl.bezig.kop.maken })).toBeVisible();

  // Detail: gele balk met 3 punten (FE-051, V-05).
  const d = nl.detail;
  const geleBalk = page
    .getByRole('status')
    .filter({ has: page.getByRole('heading', { name: d.controleerEven }) });
  await expect(geleBalk).toBeVisible({ timeout: 15_000 });
  await expect(geleBalk.getByRole('listitem')).toHaveCount(3);
  await expect(geleBalk.getByRole('listitem').filter({ hasText: 'Geschatte prijs' })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: d.concept, level: 1 })).toBeVisible();

  // Definitief → nummer 2026-09-25-001 (OFM-033) en een PDF in <DOCS>\2026\.
  await page.getByRole('button', { name: d.maakDefinitief }).click();
  await expect(page.getByRole('button', { name: d.openPdf })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: '2026-09-25-001', level: 1 })).toBeVisible();
  const pdfs = readdirSync(join(mappen.docs, '2026')).filter((n) => n.endsWith('.pdf'));
  expect(pdfs).toEqual(['2026-09-25-001 Jansen.pdf']);

  // Status Akkoord.
  const akkoord = page.getByRole('button', { name: nl.componenten.status.akkoord });
  await akkoord.click();
  await expect(akkoord).toHaveAttribute('aria-pressed', 'true');

  // Terug in de lijst: groen label Akkoord (#15803d).
  await page.getByRole('button', { name: d.terugNaarOverzicht }).click();
  const rij = page.getByRole('listitem').filter({ hasText: 'Jansen' });
  const label = rij.getByText(nl.componenten.status.akkoord, { exact: true });
  await expect(label).toBeVisible();
  await expect(label).toHaveCSS('background-color', 'rgb(21, 128, 61)');
  await expect(rij).toContainText('2026-09-25-001');

  const lijst = await apiData(page, 'overzichtZoek', { tekst: 'Jansen' });
  expect(lijst.map((o) => o.status)).toEqual(['akkoord']);
  expect(gestart.paginaFouten).toEqual([]);
});
