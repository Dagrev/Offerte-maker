import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { extractText } from 'unpdf';
import type { OfferteLijstItem } from '../../src/shared/types';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  maakTestMappen,
  nieuweOfferteTotStap4,
  offerteIdVan,
  overslaanWelkom,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// OFM-046: tussenvoegsel bij de klantnaam, van wizardstap 1 via de lijst en de zoektekst tot de PDF.

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
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });

test('tussenvoegsel: genormaliseerd, in lijst en zoeken, aanhef en adresblok op de PDF', async () => {
  gestart = await startApp(mappen, { modus: 'niet-ingelogd' });
  const { page } = gestart;
  await overslaanWelkom(page);

  // Getypt met hoofdletters en dubbele spatie; bij verlaten "van der". Aanhef is standaard Dhr.
  await nieuweOfferteTotStap4(page, {
    voornaam: 'Joost',
    tussenvoegsel: ' Van  Der ',
    achternaam: 'Bergh',
    plaats: 'Veldhoven',
  });
  const id = await offerteIdVan(page, 'van der Bergh');
  const detailVoor = await apiData(page, 'offerteHaal', { id });
  expect(detailVoor.klant.tussenvoegsel).toBe('van der');

  // Stap 1 toont drie velden op één rij, het tussenvoegsel klein.
  await page
    .getByRole('navigation', { name: nl.componenten.stappen })
    .getByRole('button', { name: new RegExp(w.stappen[0]) })
    .click();
  await expect(page.getByLabel(w.klant.tussenvoegsel, { exact: true })).toHaveValue('van der');
  await page
    .getByRole('navigation', { name: nl.componenten.stappen })
    .getByRole('button', { name: new RegExp(w.stappen[3]) })
    .click();

  // Maak zonder Claude → detail → definitief.
  await knop(page, w.maakZonderClaude).click();
  await expect(page.getByRole('heading', { name: nl.detail.controleerEven })).toBeVisible({
    timeout: 15_000,
  });
  await knop(page, nl.detail.maakDefinitief).click();
  await expect(knop(page, nl.detail.openPdf)).toBeVisible({ timeout: 20_000 });

  // Lijst en zoeken: "Dhr. J. van der Bergh"; "joost van der bergh" vindt de offerte.
  const gevonden: OfferteLijstItem[] = await apiData(page, 'overzichtZoek', { tekst: 'joost van der bergh' });
  expect(gevonden.map((o) => o.klantWeergave)).toEqual(['Dhr. J. van der Bergh']);

  const map = join(mappen.docs, '2026');
  const pdf = readdirSync(map).find((n) => n.endsWith('.pdf'));
  expect(pdf).toMatch(/ Joost van der Bergh\.pdf$/);
  const { text } = await extractText(new Uint8Array(readFileSync(join(map, pdf ?? ''))), {
    mergePages: true,
  });
  const tekst = text.replace(/\s+/g, ' ');
  expect(tekst).toContain('Dhr. J. van der Bergh');
  expect(tekst).toContain('Geachte heer Van der Bergh,');
});
