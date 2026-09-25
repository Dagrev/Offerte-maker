import type { FoutCode } from '@shared/fouten';
import { haalInstelling } from '../db/repo/instellingen';
import { ApiProvider } from './apiProvider';
import { ClaudeCodeProvider } from './claudeCodeProvider';

// Provider-interface (TDO §10.1).

export interface AgentVerzoek {
  soort: 'maken' | 'aanpassen' | 'template_teksten' | 'test';
  systeemprompt: string; // §10.5
  opdracht: string; // §10.5, geanonimiseerd en gecontroleerd
  schema: object; // JSON Schema (§10.6) — bij 'test' een mini-schema {ok:boolean}
  signal: AbortSignal;
  timeoutMs: number; // 300_000 (test: 60_000)
}
export type AgentAntwoord =
  { ok: true; json: unknown; ruw: string } | { ok: false; code: FoutCode; ruw: string };
export interface AgentProvider {
  voerUit(v: AgentVerzoek): Promise<AgentAntwoord>;
}

/** API-modus: er is een API-sleutel opgeslagen (§10.1, FE-094). */
export function isApiModus(): boolean {
  return haalInstelling('claude').apiSleutelVersleuteld !== null;
}

/** `claude.apiSleutelVersleuteld` gezet → `ApiProvider` (OFM-020), anders `ClaudeCodeProvider`. */
export function kiesProvider(): AgentProvider {
  const claude = haalInstelling('claude');
  return claude.apiSleutelVersleuteld !== null
    ? new ApiProvider(claude.apiSleutelVersleuteld, claude.effort)
    : new ClaudeCodeProvider();
}
