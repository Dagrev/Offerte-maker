import { expect, test, type Page } from '@playwright/test';
import { VALIDATIE_FOUTEN } from '../../src/shared/teksten/validatie';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  maakTestMappen,
  offerteIdVan,
  overslaanWelkom,
  sluitApp,
  startApp,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// OFM-030: per veld één ongeldige en één geldige invoer, in de tab Bedrijf en in wizardstap 1. Een
// ongeldig veld krijgt na verlaten een rode melding, wordt niet bewaard en blokkeert **Volgende**;
// een geldige waarde wordt genormaliseerd (1234 AB, +31…, kleine letters).

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

interface Geval {
  label: string;
  fout: string;
  ongeldig: string;
  geldig: string;
  genormaliseerd: string;
}

/** Ongeldig invullen en verlaten → melding; geldig invullen en verlaten → weg en genormaliseerd. */
async function controleerVeld(page: Page, g: Geval): Promise<void> {
  const veld = page.getByLabel(g.label, { exact: true });
  const melding = page.getByText(g.fout, { exact: true });
  await veld.fill(g.ongeldig);
  await veld.press('Tab');
  await expect(melding).toBeVisible();
  await expect(veld).toHaveAttribute('aria-invalid', 'true');
  await veld.fill(g.geldig);
  await veld.press('Tab');
  await expect(melding).toHaveCount(0);
  await expect(veld).toHaveValue(g.genormaliseerd);
}

test('bedrijfsgegevens: ongeldig wordt gemeld en niet bewaard, geldig wordt genormaliseerd', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  await page.getByRole('button', { name: nl.overzicht.instellingen }).click();
  const b = nl.instellingen.bedrijf;
  const a = nl.componenten.adres;
  await expect(page.getByLabel(b.naam, { exact: true })).toBeVisible();

  // Ongeldig e-mailadres: melding pas na verlaten, en niet bewaard; de andere velden wel.
  await page.getByLabel(b.email, { exact: true }).fill('info@dak');
  await expect(page.getByText(VALIDATIE_FOUTEN.email, { exact: true })).toHaveCount(0);
  await page.getByLabel(b.email, { exact: true }).press('Tab');
  await expect(page.getByText(VALIDATIE_FOUTEN.email, { exact: true })).toBeVisible();
  await page.getByLabel(a.plaats, { exact: true }).fill('Eindhoven');
  await page.getByLabel(a.plaats, { exact: true }).press('Tab');
  await expect.poll(async () => (await apiData(page, 'instellingenHaal')).bedrijf.plaats).toBe('Eindhoven');
  expect((await apiData(page, 'instellingenHaal')).bedrijf.email).toBe('');

  const gevallen: Geval[] = [
    {
      label: a.huisnummer,
      fout: VALIDATIE_FOUTEN.huisnummer,
      ongeldig: 'een',
      geldig: ' 1 ',
      genormaliseerd: '1',
    },
    {
      label: a.postcode,
      fout: VALIDATIE_FOUTEN.postcode,
      ongeldig: '1234 SA',
      geldig: '5600aa',
      genormaliseerd: '5600 AA',
    },
    {
      label: b.telefoon,
      fout: VALIDATIE_FOUTEN.telefoon,
      ongeldig: '040-12345',
      geldig: '040-1234567',
      genormaliseerd: '+31401234567',
    },
    {
      label: b.email,
      fout: VALIDATIE_FOUTEN.email,
      ongeldig: 'info @dak.nl',
      geldig: 'Info@Dak.NL',
      genormaliseerd: 'info@dak.nl',
    },
  ];
  for (const g of gevallen) await controleerVeld(page, g);
  await page.getByLabel(a.straat, { exact: true }).fill('Industrieweg');
  await page.getByLabel(a.straat, { exact: true }).press('Tab');

  await expect
    .poll(async () => (await apiData(page, 'instellingenHaal')).bedrijf)
    .toMatchObject({
      adres: 'Industrieweg 1',
      postcode: '5600 AA',
      plaats: 'Eindhoven',
      telefoon: '+31401234567',
      email: 'info@dak.nl',
    });
  expect(gestart.paginaFouten).toEqual([]);
});

test('wizardstap 1: ongeldig blokkeert Volgende, geldig wordt genormaliseerd bewaard', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  const w = nl.wizard;
  const a = nl.componenten.adres;
  await page.getByRole('button', { name: nl.overzicht.nieuweOfferte }).click();
  await expect(page.getByRole('heading', { name: `1. ${w.stappen[0]}` })).toBeVisible();
  await page.getByLabel(w.klant.naam, { exact: true }).fill('Jansen');
  await page.getByLabel(nl.componenten.adres.plaats, { exact: true }).fill('Eindhoven');

  // Ongeldig telefoonnummer blokkeert Volgende.
  await page.getByLabel(w.klant.telefoon, { exact: true }).fill('06 1234');
  await expect(page.getByText(VALIDATIE_FOUTEN.telefoon, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: w.volgende, exact: true }).click();
  await expect(page.getByText(VALIDATIE_FOUTEN.telefoon, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: `1. ${w.stappen[0]}` })).toBeVisible();

  const gevallen: Geval[] = [
    {
      label: a.huisnummer,
      fout: VALIDATIE_FOUTEN.huisnummer,
      ongeldig: '12 abcde',
      geldig: '12a',
      genormaliseerd: '12A',
    },
    {
      label: a.postcode,
      fout: VALIDATIE_FOUTEN.postcode,
      ongeldig: '12345',
      geldig: '5611ab',
      genormaliseerd: '5611 AB',
    },
    {
      label: w.klant.telefoon,
      fout: VALIDATIE_FOUTEN.telefoon,
      ongeldig: '+32 12',
      geldig: '+32 470 12 34 56',
      genormaliseerd: '+32470123456',
    },
    {
      label: w.klant.email,
      fout: VALIDATIE_FOUTEN.email,
      ongeldig: 'jan@nl',
      geldig: 'Jan@Voorbeeld.NL',
      genormaliseerd: 'jan@voorbeeld.nl',
    },
  ];
  for (const g of gevallen) await controleerVeld(page, g);
  // Huisnummer zonder straat (OFM-031): melding onder Straat tot die is ingevuld.
  await expect(page.getByText(a.straatLeeg, { exact: true })).toBeVisible();
  await page.getByLabel(a.straat, { exact: true }).fill('Dorpsstraat');
  await expect(page.getByText(a.straatLeeg, { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: w.volgende, exact: true }).click();
  await expect(page.getByRole('heading', { name: `2. ${w.stappen[1]}` })).toBeVisible();
  const id = await offerteIdVan(page, 'Jansen');
  await expect
    .poll(async () => (await apiData(page, 'offerteHaal', { id })).klant)
    .toMatchObject({
      adres: { straatHuisnummer: 'Dorpsstraat 12A', postcode: '5611 AB', plaats: 'Eindhoven' },
      telefoon: '+32470123456',
      email: 'jan@voorbeeld.nl',
    });
  expect(gestart.paginaFouten).toEqual([]);
});
