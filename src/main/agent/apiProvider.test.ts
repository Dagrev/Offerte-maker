import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentVerzoek } from './provider';

// ApiProvider met een nep-SDK (V-17): aanroepvorm, JSON uitlezen, refusal, foutklassen, afbreken.

const nep = vi.hoisted(() => {
  class APIError extends Error {}
  class APIUserAbortError extends APIError {}
  class APIConnectionError extends APIError {}
  class APIConnectionTimeoutError extends APIConnectionError {}
  class AuthenticationError extends APIError {}
  class RateLimitError extends APIError {}
  class InternalServerError extends APIError {}
  const stream = vi.fn();
  const constructor = vi.fn();
  class Anthropic {
    static APIError = APIError;
    static APIUserAbortError = APIUserAbortError;
    static APIConnectionError = APIConnectionError;
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    static AuthenticationError = AuthenticationError;
    static RateLimitError = RateLimitError;
    static InternalServerError = InternalServerError;
    messages = { stream };
    constructor(opties: unknown) {
      constructor(opties);
    }
  }
  return {
    Anthropic,
    stream,
    constructor,
    registreer: vi.fn(),
    decrypt: vi.fn((b: Buffer) => b.toString('utf8').replace('versleuteld:', '')),
  };
});

vi.mock('@anthropic-ai/sdk', () => ({ default: nep.Anthropic }));
vi.mock('electron', () => ({ safeStorage: { decryptString: nep.decrypt } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./claudeStatus', () => ({ registreerClaudeFout: nep.registreer }));

const { API_MODEL, ApiProvider } = await import('./apiProvider');

const SLEUTEL = Buffer.from('versleuteld:sk-ant-test-123', 'utf8').toString('base64');

function verzoek(over: Partial<AgentVerzoek> = {}): AgentVerzoek {
  return {
    soort: 'maken',
    systeemprompt: 'systeem',
    opdracht: 'opdracht',
    schema: { type: 'object' },
    signal: new AbortController().signal,
    timeoutMs: 300_000,
    ...over,
  };
}

function antwoordMet(bericht: unknown) {
  nep.stream.mockReturnValue({ finalMessage: () => Promise.resolve(bericht) });
}

function gooit(fout: Error) {
  nep.stream.mockReturnValue({ finalMessage: () => Promise.reject(fout) });
}

beforeEach(() => vi.clearAllMocks());

describe('ApiProvider (§10.8)', () => {
  it('roept de SDK aan zoals §10.8 en leest de JSON uit het eerste tekstblok', async () => {
    antwoordMet({
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: '{"ok":true}' },
      ],
    });
    const v = verzoek({ timeoutMs: 60_000 });
    const uit = await new ApiProvider(SLEUTEL, 'high').voerUit(v);

    expect(uit).toEqual({ ok: true, json: { ok: true }, ruw: '{"ok":true}' });
    expect(nep.constructor).toHaveBeenCalledWith({
      apiKey: 'sk-ant-test-123',
      maxRetries: 2,
      timeout: 60_000,
    });
    expect(nep.stream).toHaveBeenCalledWith(
      {
        model: 'claude-opus-5',
        max_tokens: 32_000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high', format: { type: 'json_schema', schema: { type: 'object' } } },
        system: 'systeem',
        messages: [{ role: 'user', content: 'opdracht' }],
      },
      { signal: v.signal },
    );
    expect(API_MODEL).toBe('claude-opus-5');
    expect(nep.registreer).not.toHaveBeenCalled();
  });

  it('refusal → AGENT_ONBRUIKBAAR', async () => {
    antwoordMet({ stop_reason: 'refusal', content: [] });
    expect(await new ApiProvider(SLEUTEL, 'medium').voerUit(verzoek())).toEqual({
      ok: false,
      code: 'AGENT_ONBRUIKBAAR',
      ruw: '',
    });
  });

  it('geen geldige JSON → AGENT_ONBRUIKBAAR met de ruwe tekst', async () => {
    antwoordMet({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"half' }] });
    expect(await new ApiProvider(SLEUTEL, 'medium').voerUit(verzoek())).toEqual({
      ok: false,
      code: 'AGENT_ONBRUIKBAAR',
      ruw: '{"half',
    });
    antwoordMet({ stop_reason: 'end_turn', content: [] });
    expect((await new ApiProvider(SLEUTEL, 'medium').voerUit(verzoek())).ok).toBe(false);
  });

  it.each([
    ['AuthenticationError', 'CLAUDE_NIET_INGELOGD'],
    ['RateLimitError', 'LIMIET_BEREIKT'],
    ['APIConnectionError', 'GEEN_INTERNET'],
    ['APIConnectionTimeoutError', 'AGENT_TIMEOUT'],
    ['InternalServerError', 'AGENT_ONBRUIKBAAR'],
    ['APIError', 'AGENT_ONBRUIKBAAR'],
    ['APIUserAbortError', 'AGENT_AFGEBROKEN'],
  ] as const)('%s → %s', async (klasse, code) => {
    gooit(new nep.Anthropic[klasse]('fout'));
    const uit = await new ApiProvider(SLEUTEL, 'low').voerUit(verzoek());
    expect(uit).toEqual({ ok: false, code, ruw: '' });
    expect(nep.registreer).toHaveBeenCalledWith(code);
  });

  it('onbekende fout → AGENT_ONBRUIKBAAR', async () => {
    gooit(new TypeError('stuk'));
    expect(await new ApiProvider(SLEUTEL, 'low').voerUit(verzoek())).toMatchObject({
      code: 'AGENT_ONBRUIKBAAR',
    });
  });

  it('afbreken via signal → AGENT_AFGEBROKEN', async () => {
    const stop = new AbortController();
    nep.stream.mockImplementation(() => ({
      finalMessage: () => {
        stop.abort();
        return Promise.reject(new Error('Request was aborted.'));
      },
    }));
    expect(await new ApiProvider(SLEUTEL, 'low').voerUit(verzoek({ signal: stop.signal }))).toMatchObject({
      code: 'AGENT_AFGEBROKEN',
    });
  });

  it('niet te ontsleutelen sleutel → CLAUDE_NIET_INGELOGD, geen aanroep', async () => {
    nep.decrypt.mockImplementationOnce(() => {
      throw new Error('ontsleutelen mislukt');
    });
    expect(await new ApiProvider(SLEUTEL, 'low').voerUit(verzoek())).toMatchObject({
      code: 'CLAUDE_NIET_INGELOGD',
    });
    expect(nep.stream).not.toHaveBeenCalled();
  });
});
