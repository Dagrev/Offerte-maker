import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { nl } from '../../src/renderer/src/teksten/nl';
import {
  apiData,
  maakTestMappen,
  overslaanWelkom,
  sluitApp,
  startApp,
  TEST_VANDAAG,
  type GestarteApp,
  type TestMappen,
} from '../helpers/e2e';

// Back-up terugzetten met een echte herstart (OFM-022, openstaand punt voor OFM-027; FO UC-16, V-19).
// Na **Ja, zet terug** doet de app `app.relaunch()` + `app.exit(0)`. Die nieuwe instantie hangt niet
// aan Playwright; de test zoekt hem op via `--user-data-dir` (= de eigen datamap) en stopt hem.

let mappen: TestMappen;
let gestart: GestarteApp | undefined;

test.beforeEach(() => {
  mappen = maakTestMappen();
});
test.afterEach(async () => {
  if (gestart) await sluitApp(gestart.app);
  gestart = undefined;
  stopHerstarteApp(mappen);
  mappen.opruimen();
});

/** Hoofdprocessen van Electron-instanties die de eigen datamap gebruiken (via hun kindprocessen). */
function herstarteApps(m: TestMappen): number[] {
  if (process.platform !== 'win32') return [];
  const uit = execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      // Kindprocessen (gpu, netwerk, renderer) dragen `--user-data-dir="<datamap>"`; hun ouder is de app.
      `Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | ` +
        `Where-Object { $_.CommandLine -like '*--user-data-dir=*${m.data}*' } | ` +
        'Select-Object -ExpandProperty ParentProcessId',
    ],
    { encoding: 'utf8' },
  );
  return [...new Set(uit.split(/\s+/).filter(Boolean).map(Number))].filter((pid) => pid !== process.pid);
}

function stopHerstarteApp(m: TestMappen): void {
  for (const pid of herstarteApps(m)) {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // al weg
    }
  }
}

async function aantalOffertes(page: Page): Promise<number> {
  const lijst = await apiData(page, 'overzichtLijst', { weergave: 'jaar', datum: TEST_VANDAAG });
  return lijst.items.length;
}

test('terugzetten: bevestigen, herstart, en de oude stand is terug', async () => {
  test.skip(process.platform !== 'win32', 'zoekt de herstarte app op met Windows-hulpmiddelen');
  test.setTimeout(120_000);
  gestart = await startApp(mappen);
  let page = gestart.page;
  await overslaanWelkom(page);
  await apiData(page, 'offerteNieuw', {});
  await apiData(page, 'offerteNieuw', {});

  // Geavanceerd › Back-ups › Maak nu een back-up.
  const b = nl.backups;
  await page.getByRole('button', { name: nl.overzicht.instellingen, exact: true }).click();
  await page.getByRole('button', { name: nl.instellingen.geavanceerd, exact: true }).click();
  await page.getByRole('button', { name: nl.instellingen.tab.backups, exact: true }).click();
  await page.getByRole('button', { name: b.maakNu }).click();
  const rij = page.getByRole('row').filter({ hasText: b.soort['handmatig'] ?? 'Handmatig' });
  await expect(rij).toHaveCount(1);

  // Daarna een derde offerte, dan de handmatige back-up terugzetten.
  await apiData(page, 'offerteNieuw', {});
  expect(await aantalOffertes(page)).toBe(3);
  await rij.getByRole('button').click();
  const dialoog = page.getByRole('dialog');
  await expect(dialoog.getByRole('heading', { name: b.bevestigTitel })).toBeVisible();
  const dicht = gestart.app.waitForEvent('close', { timeout: 30_000 });
  await dialoog.getByRole('button', { name: b.bevestigKnop }).click();
  await dicht;
  gestart = undefined;

  // De app is opnieuw gestart (buiten Playwright om); stoppen en zelf opnieuw starten.
  await expect.poll(() => herstarteApps(mappen).length, { timeout: 20_000 }).toBeGreaterThan(0);
  stopHerstarteApp(mappen);
  await expect.poll(() => herstarteApps(mappen).length, { timeout: 10_000 }).toBe(0);

  gestart = await startApp(mappen);
  page = gestart.page;
  await expect(page.getByRole('button', { name: nl.overzicht.nieuweOfferte })).toBeVisible();
  expect(await aantalOffertes(page)).toBe(2);
  const backups = await apiData(page, 'backupLijst');
  expect(backups.some((x) => x.bestand.endsWith('-voor-herstel.sqlite'))).toBe(true);
  expect(gestart.paginaFouten).toEqual([]);
});
