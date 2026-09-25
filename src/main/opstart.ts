import { app, ipcMain } from 'electron';
import { registreerIpc } from './ipc/registreer';
import { initLogging, log } from './log';
import { maakMappenAan, paden } from './paden';
import { claimEnkeleInstantie, cspVoor, devServerUrl, maakHoofdvenster, stelCspIn } from './venster';

// Opstartvolgorde (TDO §14.1). Houd dit een lineaire lijst stappen; latere tickets voegen op de
// gemarkeerde plekken elk één regel toe (V-03).
export async function opstart(): Promise<void> {
  // Stap 1 — één instantie (FE-002). De lock hangt aan userData; met OFFERTE_MAKER_DATA krijgt een
  // testinstantie zo een eigen lock (en Chromium-data in dezelfde map).
  app.setPath('userData', paden.dataMap);
  if (!claimEnkeleInstantie()) {
    app.quit();
    return;
  }

  // Stap 2 — logging, mappen aanmaken, tmpMap leegmaken.
  initLogging(paden.logMap, app.isPackaged);
  log.info(`opstart: versie ${app.getVersion()}, ${app.isPackaged ? 'verpakt' : 'ontwikkeling'}`);
  await maakMappenAan(paden);
  log.info('opstart: mappen aangemaakt, tmp leeggemaakt');

  // Stap 3 — database openen en migreren (OFM-003).

  // Stap 4 — dagelijkse back-up (OFM-022).

  // Stap 5 — opschonen: prullenbak > 90 dagen, privacylog > 365 dagen (OFM-003).

  // Stap 6 — agentwerkmap synchroniseren (OFM-012).

  // Stap 7 — IPC registreren, CSP en hoofdvenster.
  await app.whenReady();
  registreerIpc(ipcMain);
  log.info('opstart: IPC geregistreerd');
  const devUrl = devServerUrl();
  stelCspIn(cspVoor(devUrl));
  maakHoofdvenster();
  log.info('opstart: hoofdvenster gemaakt');
}
