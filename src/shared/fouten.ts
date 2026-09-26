import { FOUTMELDINGEN, VALIDATIE_MELDINGEN } from './teksten/fouten';

// Foutcodes (TDO §15.1, V-19) en het IPC-resultaat (§6.1).

export const FOUT_CODES = [
  'CLAUDE_NIET_GEINSTALLEERD',
  'CLAUDE_TE_OUD',
  'CLAUDE_NIET_INGELOGD',
  'GEEN_INTERNET',
  'LIMIET_BEREIKT',
  'AGENT_ONBRUIKBAAR',
  'AGENT_TIMEOUT',
  'AGENT_AFGEBROKEN',
  'PRIVACY_GEBLOKKEERD',
  'PDF_BESTAND_BEZET',
  'BESTAND_TYPE_ONBEKEND',
  'BESTAND_TE_GROOT',
  'BESTAND_GEEN_TEKST',
  'BESTAND_ONLEESBAAR',
  'VALIDATIE',
  'BACKUP_MISLUKT',
  'HERSTEL_MISLUKT',
  'MAIL_GEEN_PROGRAMMA',
  'ONBEKEND',
] as const;

export type FoutCode = (typeof FOUT_CODES)[number];

/** Actieknop bij een foutmelding (§15.1). De knoplabels zijn interfacetekst en staan in de renderer (V-11). */
export type FoutActie =
  'naarClaudeKoppeling' | 'opnieuwInloggen' | 'probeerOpnieuw' | 'naarOverig' | 'opnieuw';

export const FOUT_ACTIE: Record<FoutCode, FoutActie | null> = {
  CLAUDE_NIET_GEINSTALLEERD: 'naarClaudeKoppeling',
  CLAUDE_TE_OUD: 'naarClaudeKoppeling',
  CLAUDE_NIET_INGELOGD: 'opnieuwInloggen',
  GEEN_INTERNET: 'probeerOpnieuw',
  LIMIET_BEREIKT: null,
  AGENT_ONBRUIKBAAR: 'probeerOpnieuw',
  AGENT_TIMEOUT: 'probeerOpnieuw',
  AGENT_AFGEBROKEN: 'probeerOpnieuw',
  PRIVACY_GEBLOKKEERD: 'naarOverig',
  PDF_BESTAND_BEZET: 'opnieuw',
  BESTAND_TYPE_ONBEKEND: null,
  BESTAND_TE_GROOT: null,
  BESTAND_GEEN_TEKST: null,
  BESTAND_ONLEESBAAR: null,
  VALIDATIE: null,
  BACKUP_MISLUKT: null,
  HERSTEL_MISLUKT: null,
  MAIL_GEEN_PROGRAMMA: null,
  ONBEKEND: null,
};

export interface Fout {
  code: FoutCode;
  melding: string;
}

export type Resultaat<T> = { ok: true; data: T } | { ok: false; fout: Fout };

/**
 * Een verwachte fout in main. Handlers en modules gooien deze; `ipc/registreer.ts` zet hem om in
 * `{ ok: false, fout }`. Zonder melding geldt de standaardmelding uit `teksten/fouten.ts`.
 */
export class AppFout extends Error {
  readonly code: FoutCode;
  readonly melding: string;

  constructor(code: FoutCode, melding?: string) {
    const tekst = melding ?? FOUTMELDINGEN[code];
    super(`${code}: ${tekst}`);
    this.name = 'AppFout';
    this.code = code;
    this.melding = tekst;
  }
}

/** Handler-stub tot het eigenaarticket het kanaal invult (V-03). */
export function nietBeschikbaar(): never {
  throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.nogNietBeschikbaar);
}
