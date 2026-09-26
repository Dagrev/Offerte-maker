import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { extractText } from 'unpdf';
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

// OFM-029: het welkomstscherm heeft geen verplichte velden (V-20). Leeg doorlopen, dan een offerte
// maken en definitief maken; de PDF laat de lege bedrijfsregels weg, het opmaakvoorbeeld valt terug op
// het voorbeeldbedrijf (V-22) en het hoofdscherm toont een hint zolang de bedrijfsnaam leeg is.

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

test('welkomstscherm leeg doorlopen en daarna een offerte definitief maken', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  const w = nl.welkom;
  const b = nl.instellingen.bedrijf;
  const hint = nl.overzicht.bedrijfHint;

  // Stap 1 leeg: Volgende werkt, in stap 2 staat de gele, niet-blokkerende melding.
  await expect(page.getByRole('heading', { name: w.titel, level: 1 })).toBeVisible();
  await page.getByRole('button', { name: w.volgende, exact: true }).click();
  await expect(page.getByRole('heading', { name: w.stapKop(2, w.stappen[1] ?? '') })).toBeVisible();
  const melding = page
    .getByRole('status')
    .filter({ has: page.getByRole('heading', { name: w.nogNietIngevuld }) });
  await expect(melding).toBeVisible();
  await expect(melding).toContainText(w.laterInvullen);
  await expect(melding.getByRole('listitem')).toHaveText([b.naam, b.adres, b.kvk, b.btwNummer, b.iban]);

  // Stap 3 en Klaar, zonder iets in te vullen.
  await page.getByRole('button', { name: w.volgende, exact: true }).click();
  await expect(page.getByRole('heading', { name: w.stapKop(3, w.stappen[2] ?? '') })).toBeVisible();
  await expect(melding).toBeVisible();
  await page.getByRole('button', { name: w.klaar, exact: true }).click();

  // Hoofdscherm met de hint; welkomVoltooid staat op true met lege bedrijfsgegevens.
  await expect(page.getByRole('button', { name: nl.overzicht.nieuweOfferte })).toBeVisible();
  const hintBalk = page.getByRole('status').filter({ has: page.getByRole('heading', { name: hint.titel }) });
  await expect(hintBalk).toBeVisible();
  expect(await apiData(page, 'appInfo')).toMatchObject({ welkomVoltooid: true });
  const instellingen = await apiData(page, 'instellingenHaal');
  expect(instellingen.bedrijf.naam).toBe('');

  // Knop naar Instellingen › Bedrijf; na een herstart van de renderer is de hint terug, dan wegklikken.
  await hintBalk.getByRole('button', { name: hint.naarInstellingen }).click();
  await expect(page.getByLabel(b.naam, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: nl.overzicht.nieuweOfferte })).toBeVisible();
  await expect(page.getByRole('heading', { name: w.titel, level: 1 })).toHaveCount(0);
  await expect(hintBalk).toBeVisible();
  await hintBalk.getByRole('button', { name: hint.verberg }).click();
  await expect(hintBalk).toHaveCount(0);

  // Opmaakvoorbeeld valt terug op het voorbeeldbedrijf (V-22).
  const { html } = await apiData(page, 'instellingenOpmaakVoorbeeld', { opmaak: instellingen.opmaak });
  expect(html).toContain('Dakdekkersbedrijf Voorbeeld');

  // Offerte maken (nep-CLI) en definitief maken.
  await nieuweOfferteTotStap4(page, { naam: 'Pietersen', plaats: 'Tilburg' });
  await page.getByRole('button', { name: nl.wizard.maakDeOfferte }).click();
  const d = nl.detail;
  await expect(page.getByRole('heading', { name: d.concept, level: 1 })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: d.maakDefinitief }).click();
  await expect(page.getByRole('button', { name: d.openPdf })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: '2026-09-25-001', level: 1 })).toBeVisible();

  // De PDF laat de lege bedrijfsregels weg.
  const map = join(mappen.docs, '2026');
  const pdfs = readdirSync(map).filter((n) => n.endsWith('.pdf'));
  expect(pdfs).toEqual(['2026-09-25-001 Pietersen.pdf']);
  const { text } = await extractText(new Uint8Array(readFileSync(join(map, pdfs[0] ?? ''))), {
    mergePages: true,
  });
  const tekst = text.replace(/\s+/g, ' ');
  expect(tekst).toContain('Offertenummer 2026-09-25-001');
  expect(tekst).toContain('Met vriendelijke groet,');
  expect(tekst).toMatch(/pagina 1 van \d/);
  expect(tekst).not.toMatch(/KvK|IBAN|btw NL|undefined|Dakdekkersbedrijf Voorbeeld/);
  expect(gestart.paginaFouten).toEqual([]);
});
