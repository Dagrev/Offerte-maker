import Anthropic from '@anthropic-ai/sdk';
import { safeStorage } from 'electron';
import type { FoutCode } from '@shared/fouten';
import type { ClaudeInstelling } from '@shared/types';
import { log } from '../log';
import { registreerClaudeFout } from './claudeStatus';
import type { AgentAntwoord, AgentProvider, AgentVerzoek } from './provider';

// ApiProvider (TDO §10.8, V-17, FE-094): de Claude API via de officiële SDK, met een opgeslagen,
// versleutelde sleutel. De enige plek waar de app zelf HTTP-verzoeken doet (§17). Nooit de sleutel,
// de opdracht of het antwoord loggen (§15.3): alleen de foutcode.

/** In API-modus altijd dit model, ongeacht `claude.model` (V-17, A-20). */
export const API_MODEL = 'claude-opus-5';
export const API_MAX_TOKENS = 32_000;

/** SDK-fout → foutcode (§10.8). Afbreken eerst, verbindingstimeout vóór de algemene verbindingsfout. */
export function foutcodeVan(fout: unknown, signal: AbortSignal): FoutCode {
  if (signal.aborted || fout instanceof Anthropic.APIUserAbortError) return 'AGENT_AFGEBROKEN';
  if (fout instanceof Anthropic.AuthenticationError) return 'CLAUDE_NIET_INGELOGD';
  if (fout instanceof Anthropic.RateLimitError) return 'LIMIET_BEREIKT';
  if (fout instanceof Anthropic.APIConnectionTimeoutError) return 'AGENT_TIMEOUT';
  if (fout instanceof Anthropic.APIConnectionError) return 'GEEN_INTERNET';
  return 'AGENT_ONBRUIKBAAR';
}

export class ApiProvider implements AgentProvider {
  constructor(
    private readonly sleutelVersleuteld: string,
    private readonly effort: ClaudeInstelling['effort'],
  ) {}

  async voerUit(v: AgentVerzoek): Promise<AgentAntwoord> {
    const antwoord = await this.aanroep(v);
    if (!antwoord.ok) {
      registreerClaudeFout(antwoord.code);
      log.warn(`agent ${v.soort} (api): ${antwoord.code}`);
    }
    return antwoord;
  }

  private async aanroep(v: AgentVerzoek): Promise<AgentAntwoord> {
    let apiKey: string;
    try {
      apiKey = safeStorage.decryptString(Buffer.from(this.sleutelVersleuteld, 'base64'));
    } catch {
      // Niet te ontsleutelen (bijv. ander Windows-account): behandelen als een ongeldige sleutel.
      return { ok: false, code: 'CLAUDE_NIET_INGELOGD', ruw: '' };
    }

    const client = new Anthropic({ apiKey, maxRetries: 2, timeout: v.timeoutMs });
    try {
      const stream = client.messages.stream(
        {
          model: API_MODEL,
          max_tokens: API_MAX_TOKENS,
          thinking: { type: 'adaptive' },
          output_config: {
            effort: this.effort,
            format: { type: 'json_schema', schema: v.schema as Record<string, unknown> },
          },
          system: v.systeemprompt,
          messages: [{ role: 'user', content: v.opdracht }],
        },
        { signal: v.signal },
      );
      const bericht = await stream.finalMessage();
      if (bericht.stop_reason === 'refusal') return { ok: false, code: 'AGENT_ONBRUIKBAAR', ruw: '' };

      const tekst = bericht.content.find((b) => b.type === 'text')?.text ?? '';
      try {
        return { ok: true, json: JSON.parse(tekst) as unknown, ruw: tekst };
      } catch {
        return { ok: false, code: 'AGENT_ONBRUIKBAAR', ruw: tekst };
      }
    } catch (fout: unknown) {
      return { ok: false, code: foutcodeVan(fout, v.signal), ruw: '' };
    }
  }
}
