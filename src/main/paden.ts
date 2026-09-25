import { mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { app } from 'electron';

// Alle paden van de app (TDO §3). Geen andere module bouwt zelf paden.
export interface Paden {
  dataMap: string;
  database: string;
  logMap: string;
  tmpMap: string;
  agentMap: string;
  documentenMap: string;
  pdfMap: (jaar: number) => string;
  backupMap: string;
}

export interface PadBron {
  /** `app.getPath('userData')`, bv. `%APPDATA%\Offerte maker`. */
  userData: string;
  /** `app.getPath('documents')`. */
  documenten: string;
  env: Record<string, string | undefined>;
}

export function berekenPaden({ userData, documenten, env }: PadBron): Paden {
  const dataOverride = env['OFFERTE_MAKER_DATA']?.trim();
  const docsOverride = env['OFFERTE_MAKER_DOCS']?.trim();

  const dataMap = dataOverride ? resolve(dataOverride) : userData;
  const documentenMap = docsOverride ? resolve(docsOverride) : join(documenten, 'Offertes');

  return {
    dataMap,
    database: join(dataMap, 'offerte-maker.sqlite'),
    logMap: join(dataMap, 'logs'),
    tmpMap: join(dataMap, 'tmp'),
    agentMap: join(dataMap, 'agent'),
    documentenMap,
    pdfMap: (jaar: number) => join(documentenMap, String(jaar)),
    backupMap: join(documentenMap, 'Back-ups'),
  };
}

export const paden: Paden = berekenPaden({
  userData: app.getPath('userData'),
  documenten: app.getPath('documents'),
  env: process.env,
});

/** §14.1 stap 2: alle mappen aanmaken (`mkdir -p`) en `tmpMap` leegmaken. */
export async function maakMappenAan(p: Paden): Promise<void> {
  await rm(p.tmpMap, { recursive: true, force: true });
  for (const map of [p.dataMap, p.logMap, p.tmpMap, p.agentMap, p.documentenMap, p.backupMap]) {
    await mkdir(map, { recursive: true });
  }
}
