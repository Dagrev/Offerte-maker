import type { FoutCode } from '@shared/fouten';
import type { ClaudeStatus } from '@shared/types';
import { haalInstelling, wijzigInstelling } from '../db/repo/instellingen';
import { log } from '../log';
import { zoekClaude } from './claudePad';
import { voerProcesUit, type ClaudeCommando } from './proces';

// Claude-status (TDO §10.2 stap 1–5, NFE-020), 60 s gecachet.

export const MINIMUM_VERSIE: readonly [number, number, number] = [2, 1, 259];
const CACHE_MS = 60_000;
const GEEN_INTERNET_MS = 10 * 60_000;

export function parseVersie(tekst: string): [number, number, number] | null {
  const treffer = /(\d+)\.(\d+)\.(\d+)/.exec(tekst);
  if (!treffer) return null;
  return [Number(treffer[1]), Number(treffer[2]), Number(treffer[3])];
}

export function isTeOud(versie: readonly [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    const a = versie[i] ?? 0;
    const b = MINIMUM_VERSIE[i] ?? 0;
    if (a !== b) return a < b;
  }
  return false;
}

let cache: { status: ClaudeStatus; geldigTot: number } | null = null;

/** Na login, test, een agentfout, het bewaren van `claude` en van de API-sleutel (OFM-018, OFM-020). */
export function legeStatusCache(): void {
  cache = null;
}

/** §10.4: bij `GEEN_INTERNET` of `CLAUDE_NIET_INGELOGD` wordt `app.laatsteClaudeFout` gezet. Cache altijd leeg. */
export function registreerClaudeFout(code: FoutCode, nu: Date = new Date()): void {
  legeStatusCache();
  if (code === 'GEEN_INTERNET' || code === 'CLAUDE_NIET_INGELOGD') {
    wijzigInstelling('app', { laatsteClaudeFout: { code, tijdstip: nu.toISOString() } });
  }
}

const fout = (
  code: Extract<ClaudeStatus, { toestand: 'fout' }>['code'],
  versie: string | null,
): ClaudeStatus => ({
  toestand: 'fout',
  code,
  versie,
});

async function bepaal(cmd: ClaudeCommando | null, nu: number): Promise<ClaudeStatus> {
  // 1. API-sleutel ingevuld → geen verdere controle.
  if (haalInstelling('claude').apiSleutelVersleuteld) {
    return { toestand: 'gekoppeld', versie: '', via: 'api-sleutel' };
  }
  // 2. Uitvoerbaar bestand.
  if (!cmd) return fout('CLAUDE_NIET_GEINSTALLEERD', null);

  // 3. Versie (timeout 10 s); geen versie, niet te starten of timeout → niet geïnstalleerd.
  const versieUit = await voerProcesUit(cmd, ['--version'], { timeoutMs: 10_000 });
  const versie = versieUit.startFout || versieUit.timeout ? null : parseVersie(versieUit.stdout);
  if (!versie) return fout('CLAUDE_NIET_GEINSTALLEERD', null);
  const versieTekst = versie.join('.');
  if (isTeOud(versie)) return fout('CLAUDE_TE_OUD', versieTekst);

  // 4. Ingelogd (timeout 15 s).
  const auth = await voerProcesUit(cmd, ['auth', 'status'], { timeoutMs: 15_000 });
  if (auth.exitCode !== 0) return fout('CLAUDE_NIET_INGELOGD', versieTekst);

  // 5. Recente internetfout (de app doet zelf geen netwerkcontrole, NFE-009).
  const laatste = haalInstelling('app').laatsteClaudeFout;
  if (laatste?.code === 'GEEN_INTERNET' && nu - Date.parse(laatste.tijdstip) < GEEN_INTERNET_MS) {
    return fout('GEEN_INTERNET', versieTekst);
  }
  return { toestand: 'gekoppeld', versie: versieTekst, via: 'account' };
}

export async function bepaalClaudeStatus(nu: number = Date.now()): Promise<ClaudeStatus> {
  if (cache && cache.geldigTot > nu) return cache.status;
  const status = await bepaal(await zoekClaude(), nu);
  cache = { status, geldigTot: nu + CACHE_MS };
  log.info(`claude-status: ${status.toestand === 'fout' ? status.code : `gekoppeld (${status.via})`}`);
  return status;
}
