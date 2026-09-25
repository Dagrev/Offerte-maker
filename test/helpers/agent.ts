import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Hulp voor tests met de nep-Claude-CLI (TDO §15.2). Zet OFFERTE_MAKER_CLAUDE_CMD en FAKE_CLAUDE_*.

export const NEP_CLAUDE = resolve(import.meta.dirname, '..', 'fake-claude', 'fake-claude.mjs');

export interface NepClaude {
  logPad: string;
  /** Alle aanroepen tot nu toe (`{ args, stdin }`). */
  aanroepen: () => { args: string[]; stdin: string }[];
  opruimen: () => void;
}

/** Stuurt `zoekClaude()` naar de nep-CLI in de gegeven modus. */
export function gebruikNepClaude(modus = 'ok'): NepClaude {
  const map = mkdtempSync(join(tmpdir(), 'ofm-nepclaude-'));
  const logPad = join(map, 'aanroepen.jsonl');
  process.env['OFFERTE_MAKER_CLAUDE_CMD'] = NEP_CLAUDE;
  process.env['FAKE_CLAUDE_MODE'] = modus;
  process.env['FAKE_CLAUDE_LOG'] = logPad;
  return {
    logPad,
    aanroepen: () => {
      try {
        return readFileSync(logPad, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((r) => JSON.parse(r) as { args: string[]; stdin: string });
      } catch {
        return [];
      }
    },
    opruimen: () => {
      delete process.env['OFFERTE_MAKER_CLAUDE_CMD'];
      delete process.env['FAKE_CLAUDE_MODE'];
      delete process.env['FAKE_CLAUDE_LOG'];
      rmSync(map, { recursive: true, force: true });
    },
  };
}
