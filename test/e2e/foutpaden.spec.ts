import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { FOUTMELDINGEN } from '../../src/shared/teksten/fouten';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  maakTestMappen,
  nepClaudeAanroepen,
  nieuweOfferteTotStap4,
  overslaanWelkom,
  procesLeeft,
  sluitApp,
  startApp,
  TEST_VANDAAG,
  type GestarteApp,
  type StartOpties,
  type TestMappen,
} from '../helpers/e2e';

// Foutpaden (FE-102, FO §11, TDO §15.1): elke situatie via een nep-CLI-modus, een testhaak of een
// ontbrekend nep-CLI-bestand. Na elke fout blijft de offerte concept, blijft de invoer bewaard en is de
// app bedienbaar (NFE-016). Meldingen komen uit `shared/teksten/fouten.ts`, knoppen uit de renderer (V-11).

const actie = nl.componenten.foutActie;
const KLANT = { naam: 'Jansen', plaats: 'Eindhoven' };

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

async function start(opties: StartOpties = {}): Promise<Page> {
  gestart = await startApp(mappen, opties);
  await overslaanWelkom(gestart.page);
  return gestart.page;
}

/** Wizard tot stap 4 en **Maak de offerte**; geeft het offerte-ID terug. */
async function maak(page: Page, overig?: string): Promise<string> {
  const id = await nieuweOfferteTotStap4(page, { ...KLANT, overig });
  await page.getByRole('button', { name: nl.wizard.maakDeOfferte }).click();
  return id;
}

function foutmelding(page: Page, melding: string) {
  return page.getByRole('alert').filter({ hasText: melding });
}

/** NFE-016/FE-102: concept, invoer bewaard, en de app reageert (terug naar een werkende lijst). */
async function controleerNaFout(page: Page, id: string): Promise<void> {
  const detail = await apiData(page, 'offerteHaal', { id });
  expect(detail.status).toBe('concept');
  expect(detail.nummer).toBeNull();
  expect(detail.klant.naam).toBe(KLANT.naam);
  expect(detail.klant.adres.plaats).toBe(KLANT.plaats);
  await page.getByRole('button', { name: nl.wizard.terugNaarOverzicht }).first().click();
  const rij = page.getByRole('listitem').filter({ hasText: KLANT.naam });
  await expect(rij).toContainText(nl.overzicht.concept);
  expect(gestart?.paginaFouten).toEqual([]);
}

test('niet geïnstalleerd: ontbrekend nep-CLI-bestand', async () => {
  const page = await start({ claudeCmd: join(mappen.root, 'bestaat-niet.mjs') });
  const id = await maak(page);
  const melding = foutmelding(page, FOUTMELDINGEN.CLAUDE_NIET_GEINSTALLEERD);
  await expect(melding).toBeVisible();
  await expect(melding.getByRole('button', { name: actie.naarClaudeKoppeling })).toBeVisible();
  await controleerNaFout(page, id);
  expect(nepClaudeAanroepen(mappen, false)).toEqual([]);

  // De actieknop opent de tab Claude-koppeling.
  await page.getByRole('listitem').filter({ hasText: KLANT.naam }).click();
  await page.getByRole('button', { name: nl.wizard.maakDeOfferte }).click();
  await foutmelding(page, FOUTMELDINGEN.CLAUDE_NIET_GEINSTALLEERD)
    .getByRole('button', { name: actie.naarClaudeKoppeling })
    .click();
  await expect(page.getByRole('button', { name: nl.instellingen.tab.claudeKoppeling })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('oud: melding in de wizard en in het statusblok (NFE-020)', async () => {
  const page = await start({ modus: 'oud' });
  const id = await maak(page);
  const melding = foutmelding(page, FOUTMELDINGEN.CLAUDE_TE_OUD);
  await expect(melding).toBeVisible();
  await melding.getByRole('button', { name: actie.naarClaudeKoppeling }).click();
  await expect(page.getByRole('main').getByText(FOUTMELDINGEN.CLAUDE_TE_OUD)).toBeVisible();
  expect(nepClaudeAanroepen(mappen)).toEqual([]);
  await page.getByRole('button', { name: nl.instellingen.terug }).click();
  await page.getByRole('listitem').filter({ hasText: KLANT.naam }).click();
  await controleerNaFout(page, id);
});

test('niet ingelogd: melding met Opnieuw inloggen', async () => {
  const page = await start({ modus: 'niet-ingelogd' });
  const id = await maak(page);
  const melding = foutmelding(page, FOUTMELDINGEN.CLAUDE_NIET_INGELOGD);
  await expect(melding).toBeVisible();
  await expect(melding.getByRole('button', { name: actie.opnieuwInloggen })).toBeVisible();
  await controleerNaFout(page, id);
});

test('geen internet: melding met Probeer opnieuw', async () => {
  const page = await start({ modus: 'geen-internet' });
  const id = await maak(page);
  const melding = foutmelding(page, FOUTMELDINGEN.GEEN_INTERNET);
  await expect(melding).toBeVisible();
  expect(nepClaudeAanroepen(mappen)).toHaveLength(1);
  // Probeer opnieuw: de statuscontrole (§10.2 stap 5, §10.7 stap 1) onthoudt GEEN_INTERNET 10 minuten,
  // dus binnen die tijd komt dezelfde melding terug zónder nieuwe aanroep. Zie werklog OFM-027.
  await melding.getByRole('button', { name: actie.probeerOpnieuw }).click();
  await expect(foutmelding(page, FOUTMELDINGEN.GEEN_INTERNET)).toBeVisible();
  expect(nepClaudeAanroepen(mappen)).toHaveLength(1);
  await controleerNaFout(page, id);
});

test('limiet: melding zonder actieknop', async () => {
  const page = await start({ modus: 'limiet' });
  const id = await maak(page);
  const melding = foutmelding(page, FOUTMELDINGEN.LIMIET_BEREIKT);
  await expect(melding).toBeVisible();
  await expect(melding.getByRole('button')).toHaveCount(0);
  expect(nepClaudeAanroepen(mappen)).toHaveLength(1);
  await controleerNaFout(page, id);
});

for (const modus of ['ongeldig', 'leeg', 'crash']) {
  test(`${modus}: precies 2 aanroepen, dan AGENT_ONBRUIKBAAR (FE-036)`, async () => {
    const page = await start({ modus });
    const id = await maak(page);
    const melding = foutmelding(page, FOUTMELDINGEN.AGENT_ONBRUIKBAAR);
    await expect(melding).toBeVisible();
    await expect(melding.getByRole('button', { name: actie.probeerOpnieuw })).toBeVisible();
    expect(nepClaudeAanroepen(mappen)).toHaveLength(2);
    await controleerNaFout(page, id);
  });
}

test('ongeldig-dan-ok: na de tweede poging het detailscherm', async () => {
  const page = await start({ modus: 'ongeldig-dan-ok' });
  const id = await maak(page);
  await expect(page.getByRole('heading', { name: nl.detail.controleerEven })).toBeVisible({
    timeout: 15_000,
  });
  expect(nepClaudeAanroepen(mappen)).toHaveLength(2);
  const detail = await apiData(page, 'offerteHaal', { id });
  expect(detail.versies.map((v) => v.bron)).toEqual(['agent']);
});

test('traag met agent-timeout: afbreken na die tijd (FE-039)', async () => {
  const page = await start({ modus: 'traag', haken: [`vandaag=${TEST_VANDAAG}`, 'agent-timeout=3000'] });
  const id = await maak(page);
  const begin = Date.now();
  await expect(page.getByRole('heading', { name: nl.bezig.kop.maken })).toBeVisible();
  const melding = foutmelding(page, FOUTMELDINGEN.AGENT_TIMEOUT);
  await expect(melding).toBeVisible({ timeout: 15_000 });
  const duur = Date.now() - begin;
  expect(duur).toBeGreaterThanOrEqual(2_500);
  expect(duur).toBeLessThan(10_000);
  await expect(melding.getByRole('button', { name: actie.probeerOpnieuw })).toBeVisible();
  const [aanroep] = nepClaudeAanroepen(mappen);
  expect(aanroep).toBeDefined();
  await expect.poll(() => procesLeeft(aanroep?.pid ?? 0), { timeout: 2_000 }).toBe(false);
  await controleerNaFout(page, id);
});

test('Stoppen tijdens traag: subproces binnen 2 s weg (FE-039)', async () => {
  const page = await start({ modus: 'traag' });
  const id = await maak(page);
  await expect(page.getByRole('heading', { name: nl.bezig.kop.maken })).toBeVisible();
  await expect.poll(() => nepClaudeAanroepen(mappen).length).toBe(1);
  const pid = nepClaudeAanroepen(mappen)[0]?.pid ?? 0;
  expect(procesLeeft(pid)).toBe(true);

  const begin = Date.now();
  await page.getByRole('button', { name: nl.bezig.stoppen }).click();
  await expect.poll(() => procesLeeft(pid), { timeout: 2_000, intervals: [50] }).toBe(false);
  const duur = Date.now() - begin;
  expect(duur).toBeLessThan(2_000);
  test.info().annotations.push({ type: 'stoppen-ms', description: String(duur) });

  const melding = foutmelding(page, FOUTMELDINGEN.AGENT_AFGEBROKEN);
  await expect(melding).toBeVisible();
  await expect(melding.getByRole('button', { name: actie.probeerOpnieuw })).toBeVisible();
  await controleerNaFout(page, id);
});

test('pdf-bezet: melding met Opnieuw, geen nummer verbruikt (V-01)', async () => {
  let page = await start({ haken: [`vandaag=${TEST_VANDAAG}`, 'pdf-bezet'] });
  const id = await maak(page);
  const d = nl.detail;
  await expect(page.getByRole('heading', { name: d.controleerEven })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: d.maakDefinitief }).click();
  const melding = foutmelding(page, FOUTMELDINGEN.PDF_BESTAND_BEZET);
  await expect(melding).toBeVisible({ timeout: 20_000 });
  // Opnieuw probeert het nog eens (de testhaak staat nog aan).
  await melding.getByRole('button', { name: actie.opnieuw }).click();
  await expect(foutmelding(page, FOUTMELDINGEN.PDF_BESTAND_BEZET)).toBeVisible({ timeout: 20_000 });
  const detail = await apiData(page, 'offerteHaal', { id });
  expect(detail.nummer).toBeNull();
  expect(detail.status).toBe('concept');
  expect(detail.pdfs).toEqual([]);
  expect(existsSync(join(mappen.docs, '2026')) ? readdirSync(join(mappen.docs, '2026')) : []).toEqual([]);
  expect(gestart?.paginaFouten).toEqual([]);

  // Zonder testhaak krijgt dezelfde offerte het eerste nummer.
  await sluitApp(gestart!.app);
  gestart = await startApp(mappen);
  page = gestart.page;
  await page.getByRole('listitem').filter({ hasText: KLANT.naam }).click();
  await expect(page.getByRole('heading', { name: d.controleerEven })).toBeVisible();
  await page.getByRole('button', { name: d.maakDefinitief }).click();
  await expect(page.getByRole('heading', { name: '2026-09-25-001', level: 1 })).toBeVisible({
    timeout: 20_000,
  });
});

test('ipc-fout: onverwachte fout bij openen, invoer blijft bewaard', async () => {
  let page = await start();
  const id = await nieuweOfferteTotStap4(page, KLANT);
  await page.getByRole('button', { name: nl.wizard.terugNaarOverzicht }).click();
  await sluitApp(gestart!.app);

  gestart = await startApp(mappen, { haken: [`vandaag=${TEST_VANDAAG}`, 'ipc-fout'] });
  page = gestart.page;
  await page.getByRole('listitem').filter({ hasText: KLANT.naam }).click();
  await expect(foutmelding(page, FOUTMELDINGEN.ONBEKEND)).toBeVisible();
  // De app blijft bedienbaar.
  await page.getByRole('button', { name: nl.wizard.terugNaarOverzicht }).click();
  await expect(page.getByRole('listitem').filter({ hasText: KLANT.naam })).toContainText(
    nl.overzicht.concept,
  );
  expect(gestart.paginaFouten).toEqual([]);
  await sluitApp(gestart.app);

  gestart = await startApp(mappen);
  page = gestart.page;
  await page.getByRole('listitem').filter({ hasText: KLANT.naam }).click();
  await expect(page.getByRole('heading', { name: `4. ${nl.wizard.stappen[3]}` })).toBeVisible();
  await controleerNaFout(page, id);
});

test('privacyfilter-uit + klantnaam in Overig: geblokkeerd, niets verstuurd (FE-033)', async () => {
  const page = await start({ haken: [`vandaag=${TEST_VANDAAG}`, 'privacyfilter-uit'] });
  const logVoor = await apiData(page, 'privacylogLijst');
  const id = await maak(page, 'Graag contact opnemen met Jansen over de planning.');
  const melding = foutmelding(page, FOUTMELDINGEN.PRIVACY_GEBLOKKEERD);
  await expect(melding).toBeVisible();
  expect(nepClaudeAanroepen(mappen)).toEqual([]);
  expect(await apiData(page, 'privacylogLijst')).toHaveLength(logVoor.length);

  await melding.getByRole('button', { name: actie.naarOverig }).click();
  await expect(page.getByLabel(nl.wizard.overig.vraag, { exact: true })).toHaveValue(
    'Graag contact opnemen met Jansen over de planning.',
  );
  await controleerNaFout(page, id);
});

test('Maak zonder Claude: bij een statusfout zichtbaar, via Bezig naar het detailscherm (OFM-025)', async () => {
  const page = await start({ modus: 'niet-ingelogd' });
  const id = await nieuweOfferteTotStap4(page, KLANT);
  const knop = page.getByRole('button', { name: nl.wizard.maakZonderClaude });
  await expect(knop).toBeVisible();
  await knop.click();
  await expect(page.getByRole('heading', { name: nl.detail.controleerEven })).toBeVisible({
    timeout: 15_000,
  });
  expect(nepClaudeAanroepen(mappen)).toEqual([]);
  const detail = await apiData(page, 'offerteHaal', { id });
  expect(detail.versies.map((v) => v.bron)).toEqual(['zonder_claude']);
  expect(detail.status).toBe('concept');
  expect(gestart?.paginaFouten).toEqual([]);
});
