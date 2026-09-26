import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { STANDAARD_EMAILTEKST } from '../../src/shared/schemas';
import { FOUTMELDINGEN } from '../../src/shared/teksten/fouten';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  maakTestMappen,
  overslaanWelkom,
  sluitApp,
  startApp,
  vulDakIn,
  vulWerkIn,
  vulKlantIn,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// OFM-041: Verstuur per e-mail. Het nep-MAPI-hulpscript (OFFERTE_MAKER_MAIL_CMD) vervangt mapi.ps1 en
// de testhaak `mail-shell` legt mailto/Verkenner vast: er gaat geen mail weg en er opent geen
// mailprogramma. Volgorde van de nep-uitkomsten per klik: geen MAPI (terugval) → MAPI ok → geen programma.

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

const d = nl.detail;
const w = nl.wizard;
const knop = (page: Page, naam: string) => page.getByRole('button', { name: naam, exact: true });

function regels<T>(pad: string): T[] {
  if (!existsSync(pad)) return [];
  return readFileSync(pad, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((r) => JSON.parse(r) as T);
}

interface MailAanroep {
  modus: string;
  stdin: { aan: string; onderwerp: string; tekst: string; pad: string };
}

test('verstuur per e-mail: terugval, concept met bijlage en status, geen mailprogramma', async () => {
  gestart = await startApp(mappen, { mailModus: 'geen-mapi,ok,geen-programma' });
  const { page } = gestart;
  await overslaanWelkom(page, 'Dakwerken Test');

  // Instellingen › Teksten: het nieuwe veld E-mailtekst met de startwaarde; een eigen tekst bewaart.
  await knop(page, nl.overzicht.instellingen).click();
  await knop(page, nl.instellingen.tab.teksten).click();
  const veld = page.getByLabel(nl.instellingen.teksten.emailTekst, { exact: true });
  await expect(veld).toHaveValue(STANDAARD_EMAILTEKST);
  const eigen =
    '{aanhef}\n\nBeste {achternaam}, hierbij offerte {nummer} van {bedrijfsnaam}, geldig tot {geldigTot}.';
  await veld.fill(eigen);
  await veld.blur();
  await expect.poll(async () => (await apiData(page, 'instellingenHaal')).teksten.emailTekst).toBe(eigen);
  await knop(page, nl.instellingen.terug).click();

  // Offerte met e-mailadres maken (nep-CLI) en definitief maken.
  await knop(page, nl.overzicht.nieuweOfferte).click();
  await vulKlantIn(page, { achternaam: 'Jansen', plaats: 'Eindhoven', email: 'jan@voorbeeld.nl' });
  await knop(page, w.volgende).click();
  await vulDakIn(page);
  await knop(page, w.volgende).click();
  await vulWerkIn(page);
  await knop(page, w.volgende).click();
  await page.getByRole('button', { name: w.maakDeOfferte }).click();
  await expect(knop(page, d.maakDefinitief)).toBeVisible({ timeout: 15_000 });

  // Concept: geen mailknop.
  await expect(knop(page, d.verstuurPerMail)).toHaveCount(0);
  await knop(page, d.maakDefinitief).click();
  const mail = knop(page, d.verstuurPerMail);
  await expect(mail).toBeVisible({ timeout: 20_000 });

  // 1. MAPI niet aan te roepen → mailto zonder bijlage, PDF in Verkenner, melding; vraag → Nee.
  await mail.click();
  await expect(page.getByRole('status').filter({ hasText: d.mailZonderBijlage })).toBeVisible();
  const vraag = page.getByRole('dialog', { name: d.isVerstuurdTitel });
  await expect(vraag).toBeVisible();
  await vraag.getByRole('button', { name: d.nee, exact: true }).click();
  await expect(vraag).toBeHidden();
  await expect(knop(page, nl.componenten.status.klaar)).toHaveAttribute('aria-pressed', 'true');

  const shell = regels<{ openExternal?: string; showItemInFolder?: string }>(mappen.mailShellLog);
  expect(shell).toHaveLength(2);
  const url = shell[0]?.openExternal ?? '';
  expect(url.startsWith('mailto:jan%40voorbeeld.nl?subject=')).toBe(true);
  expect(decodeURIComponent(url)).toContain('subject=Offerte 2026-09-25-001 van Dakwerken Test');
  expect(decodeURIComponent(url)).toContain('Beste Jansen, hierbij offerte 2026-09-25-001');
  expect(shell[1]?.showItemInFolder?.endsWith('2026-09-25-001 Jan Jansen.pdf')).toBe(true);

  // 2. MAPI ok → concept met bijlage; vraag → Ja → status Verstuurd.
  await mail.click();
  await expect(vraag).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: d.mailZonderBijlage })).toHaveCount(0);
  await vraag.getByRole('button', { name: d.ja, exact: true }).click();
  await expect(knop(page, nl.componenten.status.verstuurd)).toHaveAttribute('aria-pressed', 'true');

  const aanroepen = regels<MailAanroep>(mappen.mailLog);
  expect(aanroepen.map((a) => a.modus)).toEqual(['geen-mapi', 'ok']);
  const concept = aanroepen[1]?.stdin;
  expect(concept?.aan).toBe('jan@voorbeeld.nl');
  expect(concept?.onderwerp).toBe('Offerte 2026-09-25-001 van Dakwerken Test');
  expect(concept?.tekst).toBe(
    'Geachte heer Jansen,\r\n\r\nBeste Jansen, hierbij offerte 2026-09-25-001 van Dakwerken Test, geldig tot 25 oktober 2026.',
  );
  expect(concept?.pad.endsWith('2026-09-25-001 Jan Jansen.pdf')).toBe(true);
  expect(existsSync(concept?.pad ?? '')).toBe(true);
  expect(regels(mappen.mailShellLog)).toHaveLength(2);

  // 3. Geen mailprogramma → foutmelding, geen vraag (status is al Verstuurd), niets geopend.
  await mail.click();
  await expect(page.getByText(FOUTMELDINGEN.MAIL_GEEN_PROGRAMMA)).toBeVisible();
  await expect(vraag).toBeHidden();
  expect(regels(mappen.mailShellLog)).toHaveLength(2);
  expect(gestart.paginaFouten).toEqual([]);
});
