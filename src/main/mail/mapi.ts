import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { voerProcesUit, type ClaudeCommando, type ProcesOpties, type ProcesUitkomst } from '../agent/proces';
import type { MailConcept } from './concept';

// Simple MAPI (OFM-041): `resources/mail/mapi.ps1` roept `MAPISendMail` aan met `MAPI_DIALOG`, zodat
// het mailprogramma (klassiek Outlook) een concept mét PDF-bijlage toont. De app verstuurt zelf niets.
// Het script leest JSON `{ aan, onderwerp, tekst, pad }` van stdin en schrijft
// `{ "mapi": <code | null>, "mailto": <true | false> }` naar stdout. Geen nieuw pakket (V-03).
//
// Tests: env OFFERTE_MAKER_MAIL_CMD = pad naar een `.mjs`-script dat het hulpscript vervangt (zoals
// OFFERTE_MAKER_CLAUDE_CMD); gestart met `process.execPath` en ELECTRON_RUN_AS_NODE=1. Bestaat het
// bestand niet, dan geldt MAPI als mislukt (nooit het echte script).

/** MAPI-returncodes die betekenen dat het concept getoond is: verzonden of door de gebruiker gesloten. */
export const MAPI_GELUKT = 0;
export const MAPI_USER_ABORT = 1;

/**
 * `MAPI_DIALOG` is modaal: het script wacht tot de gebruiker de mail verstuurt of sluit. Na deze tijd
 * wordt het gestopt (het concept staat dan al open).
 */
export const MAPI_TIMEOUT_MS = 30 * 60 * 1000;

export interface MapiInvoer extends MailConcept {
  /** Volledig pad van de PDF-bijlage. */
  pad: string;
}

export interface MapiUitkomst {
  /** Returncode van `MAPISendMail`; `null` = niet aan te roepen (script, DLL of functie ontbreekt). */
  mapi: number | null;
  /** Of Windows een standaardprogramma voor `mailto:` kent; `null` = onbekend. */
  mailto: boolean | null;
  /** Het script liep tegen de time-out aan (concept stond open). */
  timeout: boolean;
}

export type Starter = (cmd: ClaudeCommando, args: string[], opties: ProcesOpties) => Promise<ProcesUitkomst>;

export interface MapiOmgeving {
  env: Record<string, string | undefined>;
  /** Map met `mapi.ps1` (dev: `resources/mail`, verpakt: `process.resourcesPath/mail`). */
  scriptMap: string;
  bestaat?: (pad: string) => boolean;
}

/**
 * Welke processen er achter elkaar geprobeerd worden. Echt: eerst 64-bit PowerShell, dan 32-bit
 * (SysWOW64) — een 32-bit Outlook is vanuit een 64-bit proces niet via Simple MAPI bereikbaar.
 */
export function mapiCommandos({ env, scriptMap, bestaat = existsSync }: MapiOmgeving): ClaudeCommando[] {
  const nep = env['OFFERTE_MAKER_MAIL_CMD'];
  if (nep) {
    return bestaat(nep)
      ? [{ command: process.execPath, prefixArgs: [nep], env: { ELECTRON_RUN_AS_NODE: '1' } }]
      : [];
  }
  const script = join(scriptMap, 'mapi.ps1');
  if (!bestaat(script)) return [];
  const windows = env['SystemRoot'] ?? env['SYSTEMROOT'] ?? 'C:\\Windows';
  const argumenten = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script];
  return ['System32', 'SysWOW64']
    .map((map) => join(windows, map, 'WindowsPowerShell', 'v1.0', 'powershell.exe'))
    .filter((exe) => bestaat(exe))
    .map((exe) => ({ command: exe, prefixArgs: argumenten, env: {} }));
}

/** Leest de uitvoer van het script; alles wat niet klopt telt als "MAPI niet aan te roepen". */
export function leesUitkomst(uitkomst: ProcesUitkomst): MapiUitkomst {
  const mislukt: MapiUitkomst = { mapi: null, mailto: null, timeout: uitkomst.timeout };
  if (uitkomst.timeout) return { ...mislukt, mapi: MAPI_GELUKT };
  if (uitkomst.startFout || uitkomst.exitCode !== 0) return mislukt;
  const regel = uitkomst.stdout.trim().split(/\r?\n/).at(-1) ?? '';
  let data: unknown;
  try {
    data = JSON.parse(regel);
  } catch {
    return mislukt;
  }
  if (typeof data !== 'object' || data === null) return mislukt;
  const { mapi, mailto } = data as { mapi?: unknown; mailto?: unknown };
  return {
    mapi: typeof mapi === 'number' && Number.isInteger(mapi) ? mapi : null,
    mailto: typeof mailto === 'boolean' ? mailto : null,
    timeout: false,
  };
}

export function mapiGelukt(uitkomst: MapiUitkomst): boolean {
  return uitkomst.mapi === MAPI_GELUKT || uitkomst.mapi === MAPI_USER_ABORT;
}

/**
 * Probeert de commando's achter elkaar tot er één het concept toont. Geeft de laatste uitkomst terug
 * (`mapi: null` als er niets te proberen viel).
 */
export async function openViaMapi(
  invoer: MapiInvoer,
  commandos: ClaudeCommando[],
  start: Starter = voerProcesUit,
): Promise<MapiUitkomst> {
  let laatste: MapiUitkomst = { mapi: null, mailto: null, timeout: false };
  for (const cmd of commandos) {
    const uitkomst = leesUitkomst(
      await start(cmd, [], { stdin: JSON.stringify(invoer), timeoutMs: MAPI_TIMEOUT_MS }),
    );
    // "mailto" van een eerdere poging niet kwijtraken als een latere het niet kon bepalen.
    laatste = { ...uitkomst, mailto: uitkomst.mailto ?? laatste.mailto };
    if (mapiGelukt(laatste)) break;
  }
  return laatste;
}
