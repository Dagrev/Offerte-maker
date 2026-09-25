import type { FoutCode } from '@shared/fouten';
import { haalInstelling } from '../db/repo/instellingen';
import { log } from '../log';
import { paden } from '../paden';
import { zoekClaude } from './claudePad';
import { registreerClaudeFout } from './claudeStatus';
import { voerProcesUit, type ClaudeCommando } from './proces';
import type { AgentAntwoord, AgentProvider, AgentVerzoek } from './provider';
import { schrijfSysteemprompt, werkmapBestanden } from './werkmap';

// ClaudeCodeProvider (TDO §10.4): de Claude Code-CLI als subproces, zonder shell.

/** Argumenten na `prefixArgs`, precies volgens §10.4 (test: `--max-turns 1`). */
export function bouwArgumenten(
  verzoek: Pick<AgentVerzoek, 'soort' | 'schema'>,
  instellingen: { agentMap: string; model: string; effort: string },
): string[] {
  const b = werkmapBestanden(instellingen.agentMap);
  return [
    '-p',
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(verzoek.schema),
    '--system-prompt-file',
    b.systeemprompt,
    '--tools',
    'Read,Glob,Grep',
    '--permission-mode',
    'dontAsk',
    '--strict-mcp-config',
    '--mcp-config',
    b.mcpConfig,
    '--no-session-persistence',
    '--max-turns',
    verzoek.soort === 'test' ? '1' : '15',
    '--model',
    instellingen.model,
    '--effort',
    instellingen.effort,
  ];
}

const CLASSIFICATIE: readonly [RegExp, FoutCode][] = [
  [
    /not logged in|please run .*login|invalid api key|authentication|unauthorized|\b401\b|oauth/i,
    'CLAUDE_NIET_INGELOGD',
  ],
  [/rate limit|usage limit|limit reached|\b429\b|quota|credit/i, 'LIMIET_BEREIKT'],
  [
    /enotfound|econnrefused|econnreset|etimedout|getaddrinfo|network|unable to connect|offline/i,
    'GEEN_INTERNET',
  ],
  [/overloaded|\b5\d\d\b/i, 'AGENT_ONBRUIKBAAR'],
];

/** Classificatie van CLI-uitvoer (§10.4): eerste treffer, anders `AGENT_ONBRUIKBAAR`. Nooit `ONBEKEND`. */
export function classificeer(tekst: string): FoutCode {
  for (const [patroon, code] of CLASSIFICATIE) {
    if (patroon.test(tekst)) return code;
  }
  return 'AGENT_ONBRUIKBAAR';
}

function isObject(waarde: unknown): waarde is Record<string, unknown> {
  return typeof waarde === 'object' && waarde !== null && !Array.isArray(waarde);
}

/** Uitkomst volgens §10.4 stap 1–3. */
export function verwerkUitvoer(stdout: string, stderr: string): AgentAntwoord {
  let envelop: unknown;
  try {
    envelop = JSON.parse(stdout);
  } catch {
    return { ok: false, code: classificeer(`${stdout}\n${stderr}`), ruw: stdout };
  }
  if (!isObject(envelop)) return { ok: false, code: classificeer(`${stdout}\n${stderr}`), ruw: stdout };

  const result = typeof envelop['result'] === 'string' ? envelop['result'] : '';
  if (envelop['is_error'] === true || envelop['subtype'] !== 'success') {
    return { ok: false, code: classificeer(`${result}\n${stderr}`), ruw: stdout };
  }

  if (envelop['structured_output'] !== undefined && envelop['structured_output'] !== null) {
    return { ok: true, json: envelop['structured_output'], ruw: stdout };
  }
  const begin = result.indexOf('{');
  const eind = result.lastIndexOf('}');
  if (begin !== -1 && eind > begin) {
    try {
      return { ok: true, json: JSON.parse(result.slice(begin, eind + 1)) as unknown, ruw: stdout };
    } catch {
      // valt door naar onbruikbaar
    }
  }
  return { ok: false, code: 'AGENT_ONBRUIKBAAR', ruw: stdout };
}

export interface ProviderOpties {
  agentMap?: string;
  zoek?: () => Promise<ClaudeCommando | null>;
}

export class ClaudeCodeProvider implements AgentProvider {
  constructor(private readonly opties: ProviderOpties = {}) {}

  async voerUit(verzoek: AgentVerzoek): Promise<AgentAntwoord> {
    const antwoord = await this.roepAan(verzoek);
    if (!antwoord.ok) {
      registreerClaudeFout(antwoord.code);
      log.warn(`agent ${verzoek.soort}: ${antwoord.code}`);
    }
    return antwoord;
  }

  private async roepAan(verzoek: AgentVerzoek): Promise<AgentAntwoord> {
    if (verzoek.signal.aborted) return { ok: false, code: 'AGENT_AFGEBROKEN', ruw: '' };
    const cmd = await (this.opties.zoek ?? zoekClaude)();
    if (!cmd) return { ok: false, code: 'CLAUDE_NIET_GEINSTALLEERD', ruw: '' };

    const agentMap = this.opties.agentMap ?? paden.agentMap;
    schrijfSysteemprompt(verzoek.systeemprompt, agentMap);
    const { model, effort } = haalInstelling('claude');
    const args = bouwArgumenten(verzoek, { agentMap, model, effort });

    const start = Date.now();
    const uit = await voerProcesUit(cmd, args, {
      cwd: agentMap,
      stdin: verzoek.opdracht,
      timeoutMs: verzoek.timeoutMs,
      signal: verzoek.signal,
    });
    log.info(`agent ${verzoek.soort}: klaar na ${Date.now() - start} ms, exitcode ${uit.exitCode}`);

    if (uit.afgebroken) return { ok: false, code: 'AGENT_AFGEBROKEN', ruw: uit.stdout };
    if (uit.timeout) return { ok: false, code: 'AGENT_TIMEOUT', ruw: uit.stdout };
    if (uit.startFout) return { ok: false, code: 'CLAUDE_NIET_GEINSTALLEERD', ruw: '' };
    return verwerkUitvoer(uit.stdout, uit.stderr);
  }
}
