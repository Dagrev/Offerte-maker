import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { formatEuro } from '../../src/shared/formatteer';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  FIXTURE_SCHEMA3,
  apiData,
  maakTestMappen,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// OFM-045: een database met schemaversie 3 (van vóór OFM-044, `test/fixtures/schema3/maak.ts`) opent,
// migreert naar werkzaamheden en toont een oude definitieve offerte met dezelfde regels en hetzelfde
// totaal; een nieuwe versie (OFM-017) werkt daarna gewoon.

/** Totaal incl. btw van offerte A in de fixture: € 6.190,00 excl. + 21 % btw. */
const TOTAAL_A = 748_990;

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

test('oude database: migratie, oude offerte met gelijk totaal, en een nieuwe versie', async () => {
  test.setTimeout(90_000);
  mkdirSync(mappen.data, { recursive: true });
  copyFileSync(FIXTURE_SCHEMA3, join(mappen.data, 'offerte-maker.sqlite'));
  gestart = await startApp(mappen);
  const { page } = gestart;
  await expect(page.getByRole('button', { name: nl.overzicht.nieuweOfferte })).toBeVisible();

  // Vóór de migratie is een back-up gemaakt (V-12).
  const backups = await apiData(page, 'backupLijst');
  expect(backups.some((b) => b.bestand.endsWith('-voor-migratie.sqlite'))).toBe(true);

  // Offerte A: invoer omgezet, inhoud en totaal gelijk.
  const a = await apiData(page, 'offerteHaal', { id: 'fixture-a' });
  expect(a.invoer).not.toHaveProperty('bedekking');
  expect(a.invoer.werkzaamheden).toHaveLength(6);
  expect(a.inhoud?.regels).toHaveLength(9);
  expect(a.totalen?.totaalCent).toBe(TOTAAL_A);

  // In de app: zoeken, openen, dezelfde regels en hetzelfde totaal.
  await page.getByRole('searchbox', { name: nl.overzicht.zoeken }).fill('Jansen');
  await expect(page.getByText(nl.overzicht.zoekResultaten(1))).toBeVisible();
  await page
    .getByRole('button', { name: /Jansen/ })
    .first()
    .click();
  // Het voorbeeld (iframe) toont de oude regels; het totaal staat ook in de zijbalk.
  const voorbeeld = page.frameLocator('iframe');
  await expect(voorbeeld.getByText('EPDM dakbedekking 1,5 mm').first()).toBeVisible();
  await expect(voorbeeld.getByText(formatEuro(TOTAAL_A)).first()).toBeVisible();
  await expect(page.getByText(formatEuro(TOTAAL_A)).first()).toBeVisible();

  // Offerte B (concept zonder inhoud): Maak zonder Claude met de prijzen uit de oude prijslijst.
  // Telefoon en e-mail zijn sinds OFM-038 standaard verplicht; de oude offerte had ze niet.
  const oudB = await apiData(page, 'offerteHaal', { id: 'fixture-b' });
  const klant = { ...oudB.klant, telefoon: '0612345678', email: 'piet@voorbeeld.nl' };
  await apiData(page, 'offerteBewaarInvoer', { id: 'fixture-b', klant });
  await apiData(page, 'offerteMaakZonderClaude', { id: 'fixture-b' });
  const b = await apiData(page, 'offerteHaal', { id: 'fixture-b' });
  const omschrijvingen = b.inhoud?.regels.map((r) => r.omschrijving) ?? [];
  expect(omschrijvingen).toEqual(
    expect.arrayContaining(['Kunststof dakbedekking', 'Isolatie 90 mm', 'Zonnepaneelbeugel', 'Sedumdak']),
  );
  const beugel = b.inhoud?.regels.find((r) => r.omschrijving === 'Zonnepaneelbeugel');
  expect(beugel).toMatchObject({ aantalHonderdsten: 400, prijsCent: 2500 });

  // Nieuwe versie van de definitieve offerte (OFM-017): aanpassen met de nep-CLI, opnieuw definitief.
  await apiData(page, 'offertePasAanMetClaude', { id: 'fixture-a', instructie: 'Voeg een regel toe.' });
  await apiData(page, 'offerteMaakDefinitief', { id: 'fixture-a' });
  const na = await apiData(page, 'offerteHaal', { id: 'fixture-a' });
  expect(na.pdfs.map((p) => p.versieletter)).toContain('b');
  expect(na.versies.length).toBeGreaterThanOrEqual(2);
  expect(gestart.paginaFouten).toEqual([]);
});
