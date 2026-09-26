import { z } from 'zod';
import { AppFout, type FoutCode } from '@shared/fouten';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { TekstenVoorstellen, Voortgang } from '@shared/types';
import { haalInstelling } from '../db/repo/instellingen';
import { haalKeuzes } from '../db/repo/keuzeopties';
import { haalWerkzaamheden } from '../db/repo/werkzaamheden';
import { bewaarNieuweVersie, haalOfferteVoorAgent } from '../db/repo/offertesInhoud';
import { haalPrijspost, haalPrijspostOpSleutel, prijslijstVoorAgent } from '../db/repo/prijsposten';
import { schrijfLogregel, type Logregel } from '../db/repo/privacylog';
import { log } from '../log';
import { anonimiseer } from '../privacy/anonimiseer';
import { controleer } from '../privacy/controle';
import { tekstvelden, terugNaarPlaatshouders } from '../privacy/invullen';
import { bouwKlusVoorAgent, gebruikersTekst, vastePrijzen } from '../privacy/klusVoorAgent';
import { bouwPiiSet } from '../privacy/piiSet';
import { testhaak } from '../testhaken';
import { bepaalClaudeStatus } from './claudeStatus';
import { haalGoedgekeurdeVoorbeelden } from '../db/repo/voorbeelden';
import {
  bouwOpdrachtAanpassen,
  bouwOpdrachtMaken,
  bouwOpdrachtTemplateTeksten,
  bouwSysteemprompt,
  SYSTEEMPROMPT_TEMPLATE_TEKSTEN,
  TEMPLATE_TEKST_VELDEN,
  TEMPLATE_TEKSTEN_SCHEMA,
  verstuurdeTekst,
} from './prompts';
import { isApiModus, kiesProvider, type AgentProvider, type AgentVerzoek } from './provider';
import { agentUitvoerSchema, UITVOER_SCHEMA } from './uitvoerSchema';
import { nabewerk } from './verwerk';
import { synchroniseerWerkmap, voorbeeldenVoorApi } from './werkmap';

// Agenttaken (TDO §10.7). `maakOfferte` is de eerste; OFM-017 (`pasAanMetClaude`) en OFM-024
// (`tekstenUitTemplate`) hergebruiken `metTaak`, `controleerKoppeling`, `controleerPrivacy` en
// `voerUitMetNieuwePoging`.

export const MELDING_AL_BEZIG = 'Er wordt al aan deze offerte gewerkt.';
export const STANDAARD_TIMEOUT_MS = 300_000;
/** V-23: van `versturen` naar `schrijven` na 3 s. */
export const SCHRIJVEN_NA_MS = 3_000;
const TIK_MS = 1_000;

export type Fase = Voortgang['fase'];
export type Stuur = (voortgang: Voortgang) => void;

/** Stuurt `offerte:voortgang` bij elke fasewissel en daarna elke seconde (FE-039). */
export class Voortgangsmelder {
  private fase: Fase = 'controleren';
  private readonly start = Date.now();
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly id: string,
    private readonly stuur: Stuur,
  ) {
    this.timer = setInterval(() => this.meld(), TIK_MS);
    this.meld();
  }

  zet(fase: Fase): void {
    if (fase === this.fase) return;
    this.fase = fase;
    this.meld();
  }

  get huidigeFase(): Fase {
    return this.fase;
  }

  stop(): void {
    clearInterval(this.timer);
  }

  private meld(): void {
    try {
      this.stuur({ id: this.id, fase: this.fase, verstrekenS: Math.floor((Date.now() - this.start) / 1000) });
    } catch (fout) {
      log.warn('voortgang niet verstuurd', fout);
    }
  }
}

const lopend = new Map<string, AbortController>();

/** `offerte:stop`: breekt de lopende taak af (het subproces stopt binnen 2 s, §10.4). */
export function stopTaak(id: string): boolean {
  const taak = lopend.get(id);
  taak?.abort();
  return taak !== undefined;
}

/** Bij afsluiten van de app: alle lopende subprocessen stoppen. */
export function stopAlleTaken(): void {
  for (const taak of lopend.values()) taak.abort();
}

export function isBezig(id: string): boolean {
  return lopend.has(id);
}

export interface TaakContext {
  signal: AbortSignal;
  voortgang: Voortgangsmelder;
}

/**
 * Eén lopende agenttaak per id (§10.7). Zet de voortgang op `klaar` of `fout` en ruimt altijd op.
 * Een tweede aanroep voor hetzelfde id → `VALIDATIE` "Er wordt al aan deze offerte gewerkt."
 */
export async function metTaak<T>(
  id: string,
  stuur: Stuur,
  werk: (ctx: TaakContext) => Promise<T>,
): Promise<T> {
  if (lopend.has(id)) throw new AppFout('VALIDATIE', MELDING_AL_BEZIG);
  const controller = new AbortController();
  lopend.set(id, controller);
  const voortgang = new Voortgangsmelder(id, stuur);
  try {
    const uitkomst = await werk({ signal: controller.signal, voortgang });
    voortgang.zet('klaar');
    return uitkomst;
  } catch (fout) {
    voortgang.zet('fout');
    throw fout;
  } finally {
    voortgang.stop();
    lopend.delete(id);
  }
}

function afgebroken(signal: AbortSignal): void {
  if (signal.aborted) throw new AppFout('AGENT_AFGEBROKEN');
}

/** Stap 1 (FE-030): werkt de koppeling niet, dan wordt er niets verstuurd. */
export async function controleerKoppeling(signal: AbortSignal): Promise<void> {
  const status = await bepaalClaudeStatus();
  if (status.toestand === 'fout') throw new AppFout(status.code);
  afgebroken(signal);
}

/**
 * Stap 2 (§11.3): eindcontrole op de gebruikersinvoer na het filter. Bij een treffer
 * `PRIVACY_GEBLOKKEERD`; alleen het aantal treffers gaat naar het log, nooit de waarden.
 */
export function controleerPrivacy(payload: string, piiSet: Parameters<typeof controleer>[1]): void {
  const uitkomst = controleer(payload, piiSet);
  if (!uitkomst.ok) {
    log.warn(`privacy: eindcontrole blokkeert (${uitkomst.gevonden.length} treffers)`);
    throw new AppFout('PRIVACY_GEBLOKKEERD');
  }
}

/** 300 s, of de waarde van testhaak `agent-timeout=<ms>` (§3). */
export function agentTimeoutMs(): number {
  const haak = testhaak('agent-timeout');
  const ms = typeof haak === 'string' ? Number(haak) : NaN;
  return Number.isFinite(ms) && ms > 0 ? ms : STANDAARD_TIMEOUT_MS;
}

export interface Poging<T> {
  soort: AgentVerzoek['soort'];
  offerteId: string | null;
  systeemprompt: string;
  opdracht: string;
  schema: object;
  /** Zod-validatie van het antwoord; `null` = ongeldig (→ nieuwe poging). */
  valideer: (json: unknown) => T | null;
  ctx: TaakContext;
  provider: AgentProvider;
}

function resultaatVan(code: FoutCode | null): Logregel['resultaat'] {
  if (code === null) return 'ok';
  return code === 'AGENT_AFGEBROKEN' ? 'afgebroken' : 'fout';
}

/**
 * Stap 3–5: versturen met hoogstens één nieuwe poging (FE-036), alleen na een ongeldig antwoord of
 * `AGENT_ONBRUIKBAAR`. Per poging één privacylogregel (FE-040).
 */
export async function voerUitMetNieuwePoging<T>(p: Poging<T>): Promise<T> {
  const start = Date.now();
  let laatsteCode: FoutCode = 'AGENT_ONBRUIKBAAR';
  for (let poging = 1; poging <= 2; poging++) {
    afgebroken(p.ctx.signal);
    p.ctx.voortgang.zet('versturen');
    const naarSchrijven = setTimeout(() => p.ctx.voortgang.zet('schrijven'), SCHRIJVEN_NA_MS);
    const antwoord = await p.provider.voerUit({
      soort: p.soort,
      systeemprompt: p.systeemprompt,
      opdracht: p.opdracht,
      schema: p.schema,
      signal: p.ctx.signal,
      timeoutMs: agentTimeoutMs(),
    });
    clearTimeout(naarSchrijven);
    p.ctx.voortgang.zet('verwerken');

    const geldig = antwoord.ok ? p.valideer(antwoord.json) : null;
    const code: FoutCode | null = antwoord.ok
      ? geldig === null
        ? 'AGENT_ONBRUIKBAAR'
        : null
      : antwoord.code;
    schrijfLogregel({
      soort: p.soort,
      offerteId: p.offerteId,
      opdracht: verstuurdeTekst(p.systeemprompt, p.opdracht),
      antwoord: antwoord.ruw || null,
      resultaat: resultaatVan(code),
      foutcode: code,
    });
    log.info(`agent ${p.soort}: poging ${poging}, ${code ?? 'ok'}, ${Date.now() - start} ms`);
    if (code === null && geldig !== null) return geldig;
    laatsteCode = code ?? 'AGENT_ONBRUIKBAAR';
    if (laatsteCode !== 'AGENT_ONBRUIKBAAR') break;
  }
  throw new AppFout(laatsteCode);
}

export interface MaakOpties {
  stuur?: Stuur;
  provider?: AgentProvider;
  /** Werkmap voor tests; standaard `paden.agentMap`. */
  agentMap?: string;
}

// ---------- Standaardteksten uit het template (OFM-024, §10.7, V-08, FE-084) ----------

/** Id van de taak voor voortgang en stoppen (V-08). */
export const TEMPLATE_TEKSTEN_ID = 'template_teksten';
export const MELDING_GEEN_TEMPLATE = 'Er is nog geen template gekozen.';

const tekstVoorstel = z.string().optional();
/** Past bij `TEMPLATE_TEKSTEN_SCHEMA`; onbekende velden vallen weg. */
export const templateTekstenSchema = z.object({
  inleiding: tekstVoorstel,
  afsluiting: tekstVoorstel,
  betalingsvoorwaarden: tekstVoorstel,
  garantie10: tekstVoorstel,
  garantie20: tekstVoorstel,
  voetnoot: tekstVoorstel,
});

/**
 * V-08: `[VERWIJDERD]` en `[BEDRIJF]` eruit, dubbele spaties opschonen (regeleinden blijven), trimmen;
 * lege voorstellen vallen weg.
 */
export function nabewerkVoorstellen(ruw: z.infer<typeof templateTekstenSchema>): TekstenVoorstellen {
  const uit: TekstenVoorstellen = {};
  for (const veld of TEMPLATE_TEKST_VELDEN) {
    const tekst = (ruw[veld] ?? '')
      .replace(/\[(?:VERWIJDERD|BEDRIJF)\]/g, '')
      .replace(/[ \t]+([,.;:!?])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .trim();
    if (tekst !== '') uit[veld] = tekst;
  }
  return uit;
}

export interface TemplateTekstenOpties {
  stuur?: Stuur;
  provider?: AgentProvider;
}

/**
 * `voorbeelden:tekstenUitTemplate` (§10.7): voorstellen voor de standaardteksten uit het goedgekeurde
 * template. Geen klant, dus geen PII-set of eindcontrole: de templatetekst is al geanonimiseerd en
 * goedgekeurd (§11.5, FE-082). Slaat zelf niets op.
 */
export function tekstenUitTemplate(
  opties: TemplateTekstenOpties = {},
): Promise<{ voorstellen: TekstenVoorstellen }> {
  const template = haalGoedgekeurdeVoorbeelden().find((v) => v.isTemplate);
  if (!template) return Promise.reject(new AppFout('VALIDATIE', MELDING_GEEN_TEMPLATE));

  return metTaak(TEMPLATE_TEKSTEN_ID, opties.stuur ?? (() => undefined), async (ctx) => {
    await controleerKoppeling(ctx.signal);
    const ruw = await voerUitMetNieuwePoging({
      soort: 'template_teksten',
      offerteId: null,
      systeemprompt: SYSTEEMPROMPT_TEMPLATE_TEKSTEN,
      opdracht: bouwOpdrachtTemplateTeksten(template.tekst),
      schema: TEMPLATE_TEKSTEN_SCHEMA,
      valideer: (json) => {
        const r = templateTekstenSchema.safeParse(json);
        return r.success ? r.data : null;
      },
      ctx,
      provider: opties.provider ?? kiesProvider(),
    });
    afgebroken(ctx.signal);
    return { voorstellen: nabewerkVoorstellen(ruw) };
  });
}

/** `offerte:maak` (§10.7 stap 1–7). Geeft het aantal opgeslagen controlepunten terug (V-27). */
export function maakOfferte(id: string, opties: MaakOpties = {}): Promise<{ controlepunten: number }> {
  return metTaak(id, opties.stuur ?? (() => undefined), async (ctx) => {
    // 1. Koppeling controleren; bij een fout niets versturen en geen privacylogregel.
    await controleerKoppeling(ctx.signal);

    // 2. KlusVoorAgent bouwen, filteren en de eindcontrole.
    const offerte = haalOfferteVoorAgent(id);
    const piiSet = bouwPiiSet(offerte.klant);
    const klus = bouwKlusVoorAgent(
      {
        invoer: offerte.invoer,
        klant: offerte.klant,
        offertedatum: offerte.offertedatum,
        keuzes: haalKeuzes(),
        catalogus: haalWerkzaamheden(),
        postOpSleutel: haalPrijspostOpSleutel,
      },
      { filteren: testhaak('privacyfilter-uit') === false },
    );
    controleerPrivacy(gebruikersTekst(klus).join('\n'), piiSet);

    // 3. Werkmap synchroniseren en de opdracht bouwen (de provider schrijft systeemprompt.md).
    const werkmap =
      opties.agentMap === undefined ? synchroniseerWerkmap() : synchroniseerWerkmap(opties.agentMap);
    const teksten = haalInstelling('teksten');
    // API-modus (OFM-020, V-17): voorbeelden in de opdracht in plaats van in de werkmap. Ze horen niet
    // bij de payload van de eindcontrole (§11.3): die is hierboven al gedaan.
    const api = isApiModus();
    const systeemprompt = bouwSysteemprompt({ template: werkmap.template, api });
    const opdracht = bouwOpdrachtMaken({
      klus,
      prijslijst: prijslijstVoorAgent(),
      teksten: { inleiding: teksten.inleiding, afsluiting: teksten.afsluiting },
      aantalVoorbeelden: werkmap.voorbeelden,
      template: werkmap.template,
      ...(api && { api: voorbeeldenVoorApi() }),
    });

    // 4–5. Versturen, valideren, één nieuwe poging, privacylog.
    const uitvoer = await voerUitMetNieuwePoging({
      soort: 'maken',
      offerteId: id,
      systeemprompt,
      opdracht,
      schema: UITVOER_SCHEMA,
      valideer: (json) => {
        const r = agentUitvoerSchema.safeParse(json);
        return r.success ? r.data : null;
      },
      ctx,
      provider: opties.provider ?? kiesProvider(),
    });

    // 6. Nabewerking; 7. opslaan in één transactie. Stoppen na het antwoord telt nog.
    afgebroken(ctx.signal);
    const inhoud = nabewerk(uitvoer, {
      soort: 'maken',
      klant: offerte.klant,
      prijspost: haalPrijspost,
      vastePrijzen: vastePrijzen(klus),
    });
    bewaarNieuweVersie({ id, inhoud, bron: 'agent', wizardStap: 4 });
    return { controlepunten: inhoud.controlepunten.length };
  });
}

// ---------- Laat Claude aanpassen (OFM-017, §10.7, V-06, FE-053) ----------

/**
 * `offerte:pasAanMetClaude`: dezelfde stappen als `maakOfferte` met de opdracht `aanpassen`.
 * Instructie en huidige inhoud gaan door filter en eindcontrole; nieuwe versie met bron
 * `agent_aanpassing`; is de offerte al definitief (PDF), dan `gewijzigd_na_definitief = 1`.
 */
export function pasAanMetClaude(
  id: string,
  instructie: string,
  opties: MaakOpties = {},
): Promise<{ versieNr: number }> {
  return metTaak(id, opties.stuur ?? (() => undefined), async (ctx) => {
    const offerte = haalOfferteVoorAgent(id);
    if (offerte.inhoud === null || instructie.trim() === '') {
      throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
    }

    // 1. Koppeling controleren; bij een fout niets versturen.
    await controleerKoppeling(ctx.signal);

    // 2. Filter en eindcontrole: gebruikersinvoer van `maken` plus instructie en huidige inhoud (§11.3).
    const filteren = testhaak('privacyfilter-uit') === false;
    const piiSet = bouwPiiSet(offerte.klant);
    const klus = bouwKlusVoorAgent(
      {
        invoer: offerte.invoer,
        klant: offerte.klant,
        offertedatum: offerte.offertedatum,
        keuzes: haalKeuzes(),
        catalogus: haalWerkzaamheden(),
        postOpSleutel: haalPrijspostOpSleutel,
      },
      { filteren },
    );
    const gefilterdeInstructie = filteren ? anonimiseer(instructie, piiSet) : instructie;
    const huidige = filteren ? terugNaarPlaatshouders(offerte.inhoud, offerte.klant) : offerte.inhoud;
    controleerPrivacy(
      [...gebruikersTekst(klus), gefilterdeInstructie, ...tekstvelden(huidige)].join('\n'),
      piiSet,
    );

    // 3. Werkmap en opdracht `aanpassen` (§10.5).
    const werkmap =
      opties.agentMap === undefined ? synchroniseerWerkmap() : synchroniseerWerkmap(opties.agentMap);
    const api = isApiModus();
    const systeemprompt = bouwSysteemprompt({ template: werkmap.template, api });
    const opdracht = bouwOpdrachtAanpassen({
      huidige,
      instructie: gefilterdeInstructie,
      prijslijst: prijslijstVoorAgent(),
      aantalVoorbeelden: werkmap.voorbeelden,
      template: werkmap.template,
      ...(api && { api: voorbeeldenVoorApi() }),
    });

    // 4–5. Versturen, valideren, één nieuwe poging, privacylog (soort `aanpassen`).
    const uitvoer = await voerUitMetNieuwePoging({
      soort: 'aanpassen',
      offerteId: id,
      systeemprompt,
      opdracht,
      schema: UITVOER_SCHEMA,
      valideer: (json) => {
        const r = agentUitvoerSchema.safeParse(json);
        return r.success ? r.data : null;
      },
      ctx,
      provider: opties.provider ?? kiesProvider(),
    });

    // 6. Nabewerking met de refs uit de opdracht (V-06); 7. opslaan.
    afgebroken(ctx.signal);
    const inhoud = nabewerk(uitvoer, {
      soort: 'aanpassen',
      klant: offerte.klant,
      prijspost: haalPrijspost,
      huidigeRegels: huidige.regels,
    });
    return bewaarNieuweVersie({
      id,
      inhoud,
      bron: 'agent_aanpassing',
      gewijzigdNaDefinitief: offerte.heeftPdf,
    });
  });
}
