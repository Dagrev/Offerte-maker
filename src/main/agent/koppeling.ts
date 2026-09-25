import { spawn } from 'node:child_process';
import { AppFout } from '@shared/fouten';
import type { ClaudeStatus } from '@shared/types';
import { haalInstelling, wijzigInstelling } from '../db/repo/instellingen';
import { schrijfLogregel } from '../db/repo/privacylog';
import { log } from '../log';
import { zoekClaude } from './claudePad';
import { bepaalClaudeStatus, legeStatusCache } from './claudeStatus';
import { schoneOmgeving, type ClaudeCommando } from './proces';
import { kiesProvider, type AgentVerzoek } from './provider';

// Inloggen en de proefopdracht (TDO §10.2, §10.5 "Test", V-17; FE-091, FE-092).

export const TEST_SYSTEEMPROMPT =
  'Je bent een testassistent. Antwoord uitsluitend met JSON volgens het schema.';
export const TEST_OPDRACHT = 'Antwoord met {"ok": true}.';
export const TEST_SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
  required: ['ok'],
  additionalProperties: false,
} as const;
const LOGIN_MAX_MS = 10 * 60_000;

/** Start `auth login` in een eigen consolevenster en wacht tot het sluit (max 10 min). */
export function wachtOpLogin(cmd: ClaudeCommando, maxMs: number = LOGIN_MAX_MS): Promise<void> {
  return new Promise((klaar) => {
    const child = spawn(cmd.command, [...cmd.prefixArgs, 'auth', 'login'], {
      detached: true,
      windowsHide: false,
      stdio: 'ignore',
      env: schoneOmgeving(process.env, cmd.env),
    });
    const timer = setTimeout(() => {
      child.unref();
      klaar();
    }, maxMs);
    const einde = (): void => {
      clearTimeout(timer);
      klaar();
    };
    child.once('exit', einde);
    child.once('error', einde);
  });
}

export async function loginClaude(): Promise<ClaudeStatus> {
  const cmd = await zoekClaude();
  if (cmd) {
    log.info('claude: inloggen gestart');
    await wachtOpLogin(cmd);
  }
  legeStatusCache();
  return bepaalClaudeStatus();
}

/** De proefopdracht via `kiesProvider()`; legt een privacylogregel `test` vast. */
export async function testClaude(): Promise<{ duurMs: number }> {
  const verzoek: AgentVerzoek = {
    soort: 'test',
    systeemprompt: TEST_SYSTEEMPROMPT,
    opdracht: TEST_OPDRACHT,
    schema: TEST_SCHEMA,
    signal: new AbortController().signal,
    timeoutMs: 60_000,
  };
  const start = Date.now();
  const antwoord = await kiesProvider().voerUit(verzoek);
  const duurMs = Date.now() - start;
  legeStatusCache();

  const geldig =
    antwoord.ok &&
    typeof antwoord.json === 'object' &&
    antwoord.json !== null &&
    (antwoord.json as { ok?: unknown }).ok === true;
  const code = antwoord.ok ? (geldig ? null : 'AGENT_ONBRUIKBAAR') : antwoord.code;

  schrijfLogregel({
    soort: 'test',
    offerteId: null,
    opdracht: `${verzoek.systeemprompt}\n\n---\n\n${verzoek.opdracht}`,
    antwoord: antwoord.ruw || null,
    resultaat: code === null ? 'ok' : code === 'AGENT_AFGEBROKEN' ? 'afgebroken' : 'fout',
    foutcode: code,
  });

  if (code !== null) throw new AppFout(code);
  // Een geslaagde test bewijst dat de verbinding er weer is: een oude internetfout (§10.2 stap 5)
  // mag de status dan niet nog tien minuten rood houden (OFM-020).
  if (haalInstelling('app').laatsteClaudeFout !== null) {
    wijzigInstelling('app', { laatsteClaudeFout: null });
    legeStatusCache();
  }
  log.info(`claude: test geslaagd in ${duurMs} ms`);
  return { duurMs };
}
