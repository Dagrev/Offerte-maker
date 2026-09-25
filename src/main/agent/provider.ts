import type { FoutCode } from '@shared/fouten';
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

/** `claude.apiSleutelVersleuteld` gezet → `ApiProvider` (OFM-020), anders `ClaudeCodeProvider`. */
export function kiesProvider(): AgentProvider {
  return new ClaudeCodeProvider();
}
