import { existsSync, renameSync, rmSync } from 'node:fs';
import { join, parse } from 'node:path';
import log from 'electron-log/main';

// Logging (TDO §15.3, NFE-019). Wel: opstartstappen, IPC-fouten met code en offerte-ID,
// agentaanroepen (duur, foutcode, pogingen), back-ups. Nooit: klantgegevens, opdracht- of
// antwoordtekst, API-sleutel, PII-treffers.

export const MAX_LOGGROOTTE = 1024 * 1024;
export const AANTAL_ARCHIEVEN = 5;

/** Schuift `main.log` door naar `main.1.log` … `main.5.log`; het oudste archief vervalt. */
export function roteerLog(pad: string, aantal = AANTAL_ARCHIEVEN): void {
  const { dir, name, ext } = parse(pad);
  const archief = (n: number): string => join(dir, `${name}.${n}${ext}`);
  rmSync(archief(aantal), { force: true });
  for (let n = aantal - 1; n >= 1; n--) {
    if (existsSync(archief(n))) renameSync(archief(n), archief(n + 1));
  }
  renameSync(pad, archief(1));
}

export function initLogging(logMap: string, verpakt: boolean): void {
  const niveau = verpakt ? 'info' : 'debug';
  log.transports.file.resolvePathFn = () => join(logMap, 'main.log');
  log.transports.file.maxSize = MAX_LOGGROOTTE;
  log.transports.file.archiveLogFn = (bestand) => roteerLog(bestand.path);
  log.transports.file.level = niveau;
  log.transports.console.level = verpakt ? false : 'debug';
  // Registreert de electron-log-preload, zodat `electron-log/renderer` in hetzelfde bestand schrijft.
  log.initialize({ preload: true });
  log.errorHandler.startCatching({ showDialog: false });
}

export { log };
