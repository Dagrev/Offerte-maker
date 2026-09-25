import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { haalInstelling } from '../db/repo/instellingen';
import type { ClaudeCommando } from './proces';

// Claude Code vinden (TDO §10.2). Eerste die bestaat wint:
// 1. env OFFERTE_MAKER_CLAUDE_CMD (nep-CLI) — gezet maar bestaat niet → direct "niet geïnstalleerd";
// 2. instelling claude.pad (.exe); 3. %USERPROFILE%\.local\bin\claude.exe; 4. where.exe claude.

const SHIM_PATROON = /"%dp0%\\([^"]+claude\.exe)"/i;

/** Haalt uit een npm-`.cmd`-shim het pad naar `claude.exe`; `%dp0%` = de map van het `.cmd`-bestand. */
export function padUitCmdShim(cmdPad: string, inhoud: string): string | null {
  const treffer = SHIM_PATROON.exec(inhoud);
  return treffer?.[1] ? join(dirname(cmdPad), treffer[1]) : null;
}

export type WhereFunctie = () => Promise<string[]>;

/** `where.exe claude` met timeout 5 s; bij een fout of timeout een lege lijst. */
export const whereClaude: WhereFunctie = () =>
  new Promise((klaar) => {
    execFile('where.exe', ['claude'], { timeout: 5000, windowsHide: true }, (fout, stdout) => {
      if (fout) {
        klaar([]);
        return;
      }
      klaar(
        stdout
          .split(/\r?\n/)
          .map((r) => r.trim())
          .filter(Boolean),
      );
    });
  });

/** Kiest uit de regels van `where.exe` het `.exe`-pad (eerste `.exe`, anders via de eerste `.cmd`). */
export function kiesUitWhere(
  regels: string[],
  bestaat: (pad: string) => boolean = existsSync,
): string | null {
  const exe = regels.find((r) => r.toLowerCase().endsWith('.exe'));
  if (exe && bestaat(exe)) return exe;
  const cmd = regels.find((r) => r.toLowerCase().endsWith('.cmd'));
  if (!cmd) return null;
  let inhoud: string;
  try {
    inhoud = readFileSync(cmd, 'utf8');
  } catch {
    return null;
  }
  const pad = padUitCmdShim(cmd, inhoud);
  return pad && bestaat(pad) ? pad : null;
}

export interface ZoekOpties {
  env?: NodeJS.ProcessEnv;
  instellingPad?: string | null;
  gebruikersmap?: string;
  where?: WhereFunctie;
  bestaat?: (pad: string) => boolean;
}

/** `null` = niet gevonden → `CLAUDE_NIET_GEINSTALLEERD`. */
export async function zoekClaude(opties: ZoekOpties = {}): Promise<ClaudeCommando | null> {
  const env = opties.env ?? process.env;
  const bestaat = opties.bestaat ?? existsSync;
  const exe = (command: string): ClaudeCommando => ({ command, prefixArgs: [], env: {} });

  const nep = env['OFFERTE_MAKER_CLAUDE_CMD'];
  if (nep) {
    if (!bestaat(nep)) return null;
    return { command: process.execPath, prefixArgs: [nep], env: { ELECTRON_RUN_AS_NODE: '1' } };
  }

  const instelling = opties.instellingPad !== undefined ? opties.instellingPad : haalInstelling('claude').pad;
  if (instelling && instelling.toLowerCase().endsWith('.exe') && bestaat(instelling)) return exe(instelling);

  const standaard = join(
    opties.gebruikersmap ?? env['USERPROFILE'] ?? homedir(),
    '.local',
    'bin',
    'claude.exe',
  );
  if (bestaat(standaard)) return exe(standaard);

  const gevonden = kiesUitWhere(await (opties.where ?? whereClaude)(), bestaat);
  return gevonden ? exe(gevonden) : null;
}
