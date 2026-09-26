import { expect, test, type Page } from '@playwright/test';
import type { WerkzaamhedenBewaar } from '../../src/shared/types';
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

// OFM-051: Standaardmaterialen per daksysteem. Een werkzaamheid Bevestigen met drie materialen (Schroeven
// als gewone standaard, Houtschroeven, Betonpluggen) wordt via de API klaargezet; de afwijking
// Hout × alle bedekkingen → Houtschroeven wordt in de tab ingesteld. In de wizard staat bij ondergrond
// hout en bedekking EPDM dan Houtschroeven aangevinkt; na het wisselen naar beton blijft dat staan, met
// een gele hint naar de gewone standaard en de knop Gebruik; opnieuw kiezen geeft de gewone standaard.

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

const d = nl.werkzaamheden.daksysteem;
const w = nl.wizard;
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });

/** Bevestigen met Schroeven (standaard), Houtschroeven en Betonpluggen, bij Dak vervangen. */
async function zetBevestigenKlaar(page: Page): Promise<void> {
  const set = await apiData(page, 'werkzaamhedenHaal');
  const materiaal = (id: string, label: string) => ({
    id,
    label,
    eenheid: 'stuk' as const,
    prijsCent: 50,
    verborgen: false,
  });
  const invoer: WerkzaamhedenBewaar = {
    werkzaamheden: [
      ...set.werkzaamheden.map((x) => ({
        id: x.id,
        label: x.label,
        eenheid: x.eenheid,
        prijsCent: x.prijsCent,
        verborgen: x.verborgen,
        soortenWerk: x.soortenWerk,
        opties: x.opties.map(({ id, label, eenheid, prijsCent, verborgen }) => ({
          id,
          label,
          eenheid,
          prijsCent,
          verborgen,
        })),
        materialen: x.materialen,
      })),
      {
        id: 'e2e-bevestigen',
        label: 'Bevestigen',
        eenheid: 'm²',
        prijsCent: 500,
        verborgen: false,
        soortenWerk: ['dak_vervangen'],
        opties: [],
        materialen: [
          { materiaalId: 'e2e-schroeven', standaard: true },
          { materiaalId: 'e2e-houtschroeven', standaard: false },
          { materiaalId: 'e2e-betonpluggen', standaard: false },
        ],
      },
    ],
    materialen: [
      ...set.materialen.map(({ id, label, eenheid, prijsCent, verborgen }) => ({
        id,
        label,
        eenheid,
        prijsCent,
        verborgen,
      })),
      materiaal('e2e-schroeven', 'Schroeven'),
      materiaal('e2e-houtschroeven', 'Houtschroeven'),
      materiaal('e2e-betonpluggen', 'Betonpluggen'),
    ],
  };
  await apiData(page, 'werkzaamhedenBewaar', invoer);
}

test('afwijking Hout × alle: Bevestigen → Houtschroeven; in de wizard voorgeselecteerd, beton → gewone standaard', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  await zetBevestigenKlaar(page);

  // Instellingen › Werkzaamheden en prijzen › Standaardmaterialen per daksysteem.
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.werkzaamheden).click();
  const sectie = page.getByRole('region', { name: d.titel });
  await expect(sectie).toBeVisible();
  // Zonder combinatie: alleen de uitleg.
  await expect(sectie.getByText(d.kiesCombinatie)).toBeVisible();
  const ondergrond = sectie.getByRole('group', { name: d.ondergrond });
  const bedekking = sectie.getByRole('group', { name: d.bedekking });
  await expect(
    ondergrond.getByRole('button', { name: new RegExp(`^${d.alleOndergronden}`) }),
  ).toHaveAttribute('aria-pressed', 'true');
  await ondergrond.getByRole('button', { name: /^Hout/ }).click();
  await expect(bedekking.getByRole('button', { name: new RegExp(`^${d.alleBedekkingen}`) })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Alleen werkzaamheden met twee of meer kiesbare materialen (Isoleren wel, Slopen niet).
  const combinatie = d.combinatie('Hout', d.alleBedekkingen);
  const keuze = sectie.getByLabel(d.keuzeLabel('Bevestigen', combinatie), { exact: true });
  await expect(keuze).toHaveValue('');
  await expect(sectie.getByLabel(d.keuzeLabel('Isoleren', combinatie), { exact: true })).toBeVisible();
  await expect(sectie.getByLabel(d.keuzeLabel('Slopen', combinatie), { exact: true })).toHaveCount(0);
  const rij = sectie
    .getByRole('listitem')
    .filter({ has: page.getByLabel(d.keuzeLabel('Bevestigen', combinatie), { exact: true }) });
  await expect(rij).toContainText(`${d.bronGewoon}: Schroeven`);
  await controleerScherm(page, 'Standaardmaterialen per daksysteem, leeg', []);

  await keuze.selectOption({ label: 'Houtschroeven' });
  await expect(sectie.getByText(nl.componenten.bewaard)).toBeVisible();
  await expect(rij).toContainText(d.bronCombinatie);
  await expect(ondergrond.getByRole('button', { name: /^Hout/ })).toContainText('1');
  await expect(ondergrond.getByRole('button', { name: /^Hout/ })).toHaveAccessibleName(/1 afwijking$/);
  const regels = (await apiData(page, 'werkzaamhedenHaal')).daksystemen;
  expect(regels).toEqual([
    {
      werkzaamheidId: 'e2e-bevestigen',
      ondergrond: 'hout',
      bedekking: null,
      materiaalId: 'e2e-houtschroeven',
    },
  ]);
  // Hout × EPDM erft de regel van Hout × alle bedekkingen.
  await bedekking.getByRole('button', { name: /^EPDM/ }).click();
  const erft = sectie.getByLabel(d.keuzeLabel('Bevestigen', d.combinatie('Hout', 'EPDM')), { exact: true });
  await expect(erft).toHaveValue('');
  await expect(
    sectie.getByRole('listitem').filter({
      has: page.getByLabel(d.keuzeLabel('Bevestigen', d.combinatie('Hout', 'EPDM')), { exact: true }),
    }),
  ).toContainText(`${d.bronGeerfd(combinatie)}: Houtschroeven`);
  await controleerScherm(page, 'Standaardmaterialen per daksysteem, met afwijking', []);
  await knop(page, nl.instellingen.terug).click();

  // Nieuwe offerte: ondergrond hout, dak vervangen met EPDM.
  await knop(page, nl.overzicht.nieuweOfferte).click();
  await vulKlantIn(page, { achternaam: 'Schroefman', plaats: 'Best' });
  await knop(page, w.volgende).click();
  await knop(page, 'Plat dak').click();
  await knop(page, 'Bitumen').click();
  await knop(page, 'Hout').click();
  await vulDakIn(page);
  await knop(page, w.volgende).click();
  await knop(page, 'Dak vervangen').click();
  await page
    .getByRole('group', { name: w.werk.nieuweBedekking })
    .getByRole('button', { name: 'EPDM', exact: true })
    .click();
  await page.getByRole('button', { name: /^Bevestigen/ }).click();
  const kaart = page.getByRole('region', { name: 'Bevestigen' });
  await expect(kaart.getByLabel('Houtschroeven', { exact: true })).toBeChecked();
  await expect(kaart.getByLabel('Schroeven', { exact: true })).not.toBeChecked();
  await expect(kaart.getByText(w.werk.daksysteemHint('Schroeven'))).toHaveCount(0);

  // Terug naar stap 2, ondergrond beton: de materialen blijven staan, met een hint en Gebruik.
  await knop(page, w.vorige).click();
  await knop(page, 'Beton').click();
  await knop(page, w.volgende).click();
  await expect(kaart.getByLabel('Houtschroeven', { exact: true })).toBeChecked();
  await expect(kaart.getByText(w.werk.daksysteemHint('Schroeven'))).toBeVisible();
  await controleerScherm(page, 'Wizard 3 met daksysteem-hint', []);
  await kaart.getByRole('button', { name: w.werk.daksysteemGebruik('Schroeven', 'Bevestigen') }).click();
  await expect(kaart.getByLabel('Schroeven', { exact: true })).toBeChecked();
  await expect(kaart.getByLabel('Houtschroeven', { exact: true })).not.toBeChecked();
  await expect(kaart.getByText(w.werk.daksysteemHint('Schroeven'))).toHaveCount(0);

  // Opnieuw kiezen bij beton: de gewone standaard.
  await page.getByRole('button', { name: /^Bevestigen/ }).click();
  await expect(kaart).toHaveCount(0);
  await page.getByRole('button', { name: /^Bevestigen/ }).click();
  await expect(kaart.getByLabel('Schroeven', { exact: true })).toBeChecked();
  await expect(kaart.getByLabel('Houtschroeven', { exact: true })).not.toBeChecked();

  const id = await offerteIdVan(page, 'Schroefman');
  // Na de autosave van de wizard.
  await expect
    .poll(async () => {
      const invoer = (await apiData(page, 'offerteHaal', { id })).invoer;
      return [
        invoer.ondergrond,
        invoer.werkzaamheden.find((x) => x.sleutel === 'bevestigen')?.materialen.map((m) => m.sleutel),
      ];
    })
    .toEqual(['beton', ['schroeven']]);
  expect(gestart.paginaFouten).toEqual([]);
});
