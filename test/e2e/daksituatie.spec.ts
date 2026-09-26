import { expect, test, type Page } from '@playwright/test';
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

// OFM-058: tags als compacte knoppen met Alle situaties; houtschroeven (tag hout) staan niet in de gewone
// kiesbare lijst van Nieuwe bedekking maar wel in de situaties met hout, en worden kiesbaar door ze daar aan
// te vinken. Een tag uit bij een gewoon kiesbaar materiaal geeft een gele melding.
// OFM-055 (vervangt daksysteem.spec.ts van OFM-051): materiaaltags en materiaal per daksituatie. In de
// tab Materialen en prijzen (OFM-056) krijgen Houtschroeven alleen de tag Hout en de EPDM-ontluchter alleen de
// tag EPDM; in de tab Werkzaamheden worden bij Nieuwe bedekking (vinkje Materiaal per daksituatie staat al aan in de startset) worden bij
// Hout × EPDM EPDM, de ontluchter en de houtschroeven aangevinkt. In de wizard staan ze bij hout + EPDM
// alle drie aangevinkt; na beton geeft de hint met Gebruik de set van beton × EPDM, en bij beton + bitumen
// is alleen bitumen voorgeselecteerd en zijn de ontluchter en de houtschroeven niet kiesbaar.

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

const t = nl.werkzaamheden;
const w = nl.wizard;
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });
const BED = 'Nieuwe bedekking';
const HOUT = 'Houtschroeven';
const ONTL = 'EPDM-ontluchter';

async function voegMateriaalToe(page: Page, naam: string): Promise<void> {
  await page.getByLabel(t.nieuwMateriaal, { exact: true }).fill(naam);
  await knop(page, t.materiaalToevoegen).click();
  await expect(page.getByLabel(t.materiaalNaam(naam), { exact: true })).toHaveValue(naam);
}

test('tags en materiaal per daksituatie: hout × EPDM drie materialen, beton × bitumen alleen bitumen', async () => {
  gestart = await startApp(mappen);
  const { page } = gestart;
  await overslaanWelkom(page);
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.materialen).click();

  // Geen blok Beschikbare tags meer, wel een uitlegregel.
  await expect(page.getByText(t.tags.uitleg)).toBeVisible();
  const tag = (label: string, materiaal: string) =>
    page.getByRole('button', { name: t.tags.tag(label, materiaal), exact: true });
  const alle = (materiaal: string) =>
    page.getByRole('button', { name: t.tags.alleVan(materiaal), exact: true });
  // Startset: bitumen alleen de tag bitumen (losse tags zichtbaar, Alle situaties uit); PIR 80 mm alle.
  await expect(tag('EPDM', 'Bitumen')).toHaveAttribute('aria-pressed', 'false');
  await expect(alle('Bitumen')).toHaveAttribute('aria-pressed', 'false');
  await expect(alle('PIR 80 mm')).toHaveAttribute('aria-pressed', 'true');
  await expect(tag('Hout', 'PIR 80 mm')).toHaveCount(0);
  // Geen "Weet ik niet" als tag.
  await expect(tag('Weet ik niet', 'Bitumen')).toHaveCount(0);

  // Houtschroeven: nieuw = Alle situaties; uitzetten toont de losse tags (alles aan); alleen Hout. De
  // laatste tag kan niet uit.
  await voegMateriaalToe(page, HOUT);
  await expect(alle(HOUT)).toHaveAttribute('aria-pressed', 'true');
  await expect(tag('Beton', HOUT)).toHaveCount(0);
  await alle(HOUT).click();
  await expect(alle(HOUT)).toHaveAttribute('aria-pressed', 'false');
  await expect(tag('Beton', HOUT)).toHaveAttribute('aria-pressed', 'true');
  // Alles weer aan: terug naar Alle situaties.
  await tag('PVC', HOUT).click();
  await expect(tag('PVC', HOUT)).toHaveAttribute('aria-pressed', 'false');
  await tag('PVC', HOUT).click();
  await expect(alle(HOUT)).toHaveAttribute('aria-pressed', 'true');
  await expect(tag('PVC', HOUT)).toHaveCount(0);
  await alle(HOUT).click();
  await tag('Beton', HOUT).click();
  await tag('Staal', HOUT).click();
  await expect(tag('Beton', HOUT)).toHaveAttribute('aria-pressed', 'false');
  await expect(tag('Hout', HOUT)).toBeDisabled();
  // EPDM-ontluchter: alleen EPDM.
  await voegMateriaalToe(page, ONTL);
  await alle(ONTL).click();
  await tag('Bitumen', ONTL).click();
  await tag('PVC', ONTL).click();
  await expect(tag('EPDM', ONTL)).toHaveAttribute('aria-pressed', 'true');

  // Een tag uit bij een materiaal dat gewoon kiesbaar is (PIR 60 mm bij Isoleren): gele melding.
  await alle('PIR 60 mm').click();
  await tag('Staal', 'PIR 60 mm').click();
  await expect(page.getByText(t.kiesbaarVervallen(1))).toBeVisible();
  await controleerScherm(page, 'Materialen en prijzen met tags', []);

  // Tab Werkzaamheden, kaart Nieuwe bedekking openen: houtschroeven en ontluchter staan niet in de gewone
  // kiesbare lijst (eigen tags), wel in de situaties; vinkje staat aan, Hout × EPDM.
  await knop(page, nl.instellingen.tab.werkzaamheden).click();
  const kaart = page.getByRole('listitem', { name: BED, exact: true });
  await kaart.getByRole('button', { name: BED, exact: true }).click();
  const kiesbaar = kaart.getByRole('group', { name: t.kiesbareMaterialen(BED) });
  for (const naam of [HOUT, ONTL, 'EPDM', 'Bitumen']) {
    await expect(kiesbaar.getByLabel(naam, { exact: true })).toHaveCount(0);
  }
  await expect(kiesbaar.getByLabel('PIR 80 mm', { exact: true })).not.toBeChecked();
  await expect(kaart.getByLabel(t.situatie.vinkje, { exact: true })).toBeChecked();
  await expect(kaart.getByLabel(t.standaardMateriaal(BED), { exact: true })).toHaveCount(0);
  const knoppen = kaart.getByRole('group', { name: t.situatie.knoppen(BED) });
  const houtEpdm = knoppen.getByRole('button', { name: /^Hout × EPDM/ });
  await houtEpdm.click();
  await expect(houtEpdm).toHaveAttribute('aria-pressed', 'true');
  await expect(houtEpdm).toHaveAccessibleName(/1 materiaal$/);
  const situatie = kaart.getByRole('group', { name: t.situatie.materialen('Hout × EPDM', BED) });
  await expect(situatie.getByLabel('EPDM', { exact: true })).toBeChecked();
  // Alleen passende materialen: bitumen (tag bitumen) staat er niet.
  await expect(situatie.getByLabel('Bitumen', { exact: true })).toHaveCount(0);
  await situatie.getByLabel(ONTL, { exact: true }).check();
  await situatie.getByLabel(HOUT, { exact: true }).check();
  await expect(houtEpdm).toHaveAccessibleName(/3 materialen$/);
  await expect(page.getByText(nl.componenten.bewaard).first()).toBeVisible();
  // Houtschroeven ook bij Hout × Bitumen te kiezen (niet kiesbaar in de gewone lijst).
  await knoppen.getByRole('button', { name: /^Hout × Bitumen/ }).click();
  const houtBitumen = kaart.getByRole('group', { name: t.situatie.materialen('Hout × Bitumen', BED) });
  await expect(houtBitumen.getByLabel(HOUT, { exact: true })).not.toBeChecked();
  await expect(houtBitumen.getByLabel(ONTL, { exact: true })).toHaveCount(0);
  await expect(kiesbaar.getByLabel(HOUT, { exact: true })).toHaveCount(0);
  // Isoleren: PIR 60 mm (tag staal uit) staat niet meer in de gewone kiesbare lijst.
  const iso = page.getByRole('listitem', { name: 'Isoleren', exact: true });
  await iso.getByRole('button', { name: 'Isoleren', exact: true }).click();
  const isoKiesbaar = iso.getByRole('group', { name: t.kiesbareMaterialen('Isoleren') });
  await expect(isoKiesbaar.getByLabel('PIR 60 mm', { exact: true })).toHaveCount(0);
  await expect(isoKiesbaar.getByLabel('PIR 80 mm', { exact: true })).toBeChecked();
  // Bij beton × EPDM staan de houtschroeven er niet (tag hout).
  await knoppen.getByRole('button', { name: /^Beton × EPDM/ }).click();
  const betonEpdm = kaart.getByRole('group', { name: t.situatie.materialen('Beton × EPDM', BED) });
  await expect(betonEpdm.getByLabel(ONTL, { exact: true })).not.toBeChecked();
  await expect(betonEpdm.getByLabel(HOUT, { exact: true })).toHaveCount(0);
  await controleerScherm(page, 'Werkzaamheden met daksituaties', []);

  await expect
    .poll(async () => {
      const set = await apiData(page, 'werkzaamhedenHaal');
      const naam = (id: string) => set.materialen.find((m) => m.id === id)?.label;
      const bed = set.werkzaamheden.find((x) => x.sleutel === 'nieuwe_bedekking');
      return {
        hout: set.materialen.find((m) => m.label === HOUT)?.tags,
        ontl: set.materialen.find((m) => m.label === ONTL)?.tags,
        perSituatie: bed?.perSituatie,
        houtEpdm: bed?.situaties
          .find((s) => s.ondergrond === 'hout' && s.bedekking === 'epdm')
          ?.materiaalIds.map(naam),
      };
    })
    .toEqual({
      hout: { ondergrond: ['hout'], bedekking: 'alle' },
      ontl: { ondergrond: 'alle', bedekking: ['epdm'] },
      perSituatie: true,
      houtEpdm: ['EPDM', HOUT, ONTL],
    });
  await knop(page, nl.instellingen.terug).click();

  // Nieuwe offerte: hout, dak vervangen met EPDM → alle drie voorgeselecteerd.
  await knop(page, nl.overzicht.nieuweOfferte).click();
  await vulKlantIn(page, { achternaam: 'Situatieman', plaats: 'Best' });
  await knop(page, w.volgende).click();
  await knop(page, 'Plat dak').click();
  await knop(page, 'Bitumen').click();
  await knop(page, 'Hout').click();
  await vulDakIn(page);
  await knop(page, w.volgende).click();
  await knop(page, 'Dak vervangen').click();
  const bedekking = page.getByRole('group', { name: w.werk.nieuweBedekking });
  await bedekking.getByRole('button', { name: 'EPDM', exact: true }).click();
  const tegel = page.getByRole('button', { name: /^Nieuwe bedekking/ });
  await tegel.click();
  const wkaart = page.getByRole('region', { name: BED });
  for (const m of ['EPDM', ONTL, HOUT]) await expect(wkaart.getByLabel(m, { exact: true })).toBeChecked();
  await expect(wkaart.getByLabel('Bitumen', { exact: true })).toHaveCount(0);
  await expect(wkaart.getByText(w.werk.daksysteemHint('EPDM'))).toHaveCount(0);

  // Terug naar stap 2, ondergrond beton: de materialen blijven, met een hint naar de set van beton × EPDM.
  await knop(page, w.vorige).click();
  await knop(page, 'Beton').click();
  await knop(page, w.volgende).click();
  await expect(wkaart.getByLabel(HOUT, { exact: true })).toBeChecked();
  await expect(wkaart.getByText(w.werk.daksysteemHint('EPDM'))).toBeVisible();
  await controleerScherm(page, 'Wizard 3 met hint bij de daksituatie', []);
  await wkaart.getByRole('button', { name: w.werk.daksysteemGebruik('EPDM', BED) }).click();
  await expect(wkaart.getByLabel('EPDM', { exact: true })).toBeChecked();
  await expect(wkaart.getByLabel(ONTL, { exact: true })).not.toBeChecked();
  await expect(wkaart.getByLabel(HOUT, { exact: true })).toHaveCount(0);

  // Beton + bitumen, werkzaamheid opnieuw kiezen: alleen bitumen, ontluchter en houtschroeven niet kiesbaar.
  await bedekking.getByRole('button', { name: 'Bitumen', exact: true }).click();
  await tegel.click();
  await expect(wkaart).toHaveCount(0);
  await tegel.click();
  await expect(wkaart.getByLabel('Bitumen', { exact: true })).toBeChecked();
  for (const m of ['EPDM', ONTL, HOUT]) await expect(wkaart.getByLabel(m, { exact: true })).toHaveCount(0);
  await controleerScherm(page, 'Wizard 3 bij beton en bitumen', []);

  const id = await offerteIdVan(page, 'Situatieman');
  await expect
    .poll(async () => {
      const invoer = (await apiData(page, 'offerteHaal', { id })).invoer;
      return [
        invoer.ondergrond,
        invoer.nieuweBedekking,
        invoer.werkzaamheden.find((x) => x.sleutel === 'nieuwe_bedekking')?.materialen.map((m) => m.sleutel),
      ];
    })
    .toEqual(['beton', 'bitumen', ['bitumen']]);
  expect(gestart.paginaFouten).toEqual([]);
});
