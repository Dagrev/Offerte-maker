import { randomUUID } from 'node:crypto';
import { berekenTotalen } from '@shared/calc/bedragen';
import { AppFout } from '@shared/fouten';
import { markeerHandmatig } from '@shared/offerteBewerken';
import { omschrijvingKort } from '@shared/omschrijvingKort';
import { klantSchema, klusInvoerSchema, offerteInhoudSchema } from '@shared/schemas';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { Klant, KlusInvoer, OfferteInhoud } from '@shared/types';
import { terugNaarPlaatshouders } from '../../privacy/invullen';
import { haalKeuzes } from './keuzeopties';
import { database } from '../verbinding';

// Inhoud en versies van een offerte (TDO §4.2, §10.7 stap 7). Eigenaar: OFM-013; OFM-014 (handmatig
// bewaren), OFM-017 (aanpassen, terugzetten) en OFM-025 (zonder Claude) breiden dit bestand uit.
// `inhoud_json` bevat altijd plaatshouders, nooit klantgegevens (§11.4).

export type VersieBron =
  | 'agent'
  | 'agent_aanpassing'
  | 'handmatig'
  | 'terugzetten'
  | 'zonder_claude'
  /** OFM-047: **Maak opnieuw** vanuit de wizard (aanpassen), met of zonder Claude; migratie 008. */
  | 'wizard';

/** Bronnen waarbij de inhoud uit de wizardinvoer is gemaakt: die wissen `invoer_gewijzigd` (OFM-047). */
const UIT_INVOER: readonly VersieBron[] = ['agent', 'zonder_claude', 'wizard'];

export interface OfferteVoorAgent {
  id: string;
  status: string;
  offertedatum: string;
  klant: Klant;
  invoer: KlusInvoer;
  /** Opgeslagen inhoud (met plaatshouders), of `null` als er nog geen is. */
  inhoud: OfferteInhoud | null;
  heeftPdf: boolean;
}

/** Alles wat een agenttaak van de offerte nodig heeft. Onbekend id → `VALIDATIE`. */
export function haalOfferteVoorAgent(id: string): OfferteVoorAgent {
  const db = database();
  const rij = db
    .prepare(
      'SELECT id, status, offertedatum, klant_json, invoer_json, inhoud_json FROM offertes WHERE id = ?',
    )
    .get(id) as
    | {
        id: string;
        status: string;
        offertedatum: string;
        klant_json: string;
        invoer_json: string;
        inhoud_json: string | null;
      }
    | undefined;
  if (!rij) throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
  const heeftPdf =
    db.prepare('SELECT 1 FROM pdf_bestanden WHERE offerte_id = ? LIMIT 1').get(id) !== undefined;
  return {
    id: rij.id,
    status: rij.status,
    offertedatum: rij.offertedatum,
    klant: klantSchema.parse(JSON.parse(rij.klant_json)),
    invoer: klusInvoerSchema.parse(JSON.parse(rij.invoer_json)),
    inhoud: rij.inhoud_json === null ? null : offerteInhoudSchema.parse(JSON.parse(rij.inhoud_json)),
    heeftPdf,
  };
}

export interface NieuweVersie {
  id: string;
  inhoud: OfferteInhoud;
  bron: VersieBron;
  /** `offertes.wizard_stap`; bij `maken` 4 (§10.7 stap 7), anders ongewijzigd laten. */
  wizardStap?: number;
  /** Bij een aanpassing van een definitieve offerte (OFM-017). */
  gewijzigdNaDefinitief?: boolean;
}

/**
 * Eén synchrone transactie (§10.7 stap 7): nieuwe `offerte_versies`-regel, `inhoud_json`,
 * `totaal_incl_cent`, `omschrijving_kort` en `bijgewerkt_op`. De status verandert niet. Is de inhoud
 * uit de wizardinvoer gemaakt (`agent`, `zonder_claude`, `wizard`), dan `invoer_gewijzigd = 0` (OFM-047).
 */
export function bewaarNieuweVersie(v: NieuweVersie, nu: Date = new Date()): { versieNr: number } {
  const db = database();
  const inhoud = offerteInhoudSchema.parse(v.inhoud);
  const inhoudJson = JSON.stringify(inhoud);
  const totaal = berekenTotalen(inhoud.regels).totaalCent;
  const tijd = nu.toISOString();
  return db.transaction(() => {
    const rij = db.prepare('SELECT invoer_json, wizard_stap FROM offertes WHERE id = ?').get(v.id) as
      { invoer_json: string; wizard_stap: number } | undefined;
    if (!rij) throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
    const invoer = klusInvoerSchema.parse(JSON.parse(rij.invoer_json));
    const { hoogste } = db
      .prepare('SELECT COALESCE(MAX(versie_nr), 0) AS hoogste FROM offerte_versies WHERE offerte_id = ?')
      .get(v.id) as { hoogste: number };
    const versieNr = hoogste + 1;
    db.prepare(
      'INSERT INTO offerte_versies (id, offerte_id, versie_nr, bron, inhoud_json, aangemaakt_op) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(randomUUID(), v.id, versieNr, v.bron, inhoudJson, tijd);
    db.prepare(
      `UPDATE offertes SET inhoud_json = ?, totaal_incl_cent = ?, omschrijving_kort = ?, wizard_stap = ?,
         gewijzigd_na_definitief = CASE WHEN ? THEN 1 ELSE gewijzigd_na_definitief END,
         invoer_gewijzigd = CASE WHEN ? THEN 0 ELSE invoer_gewijzigd END, bijgewerkt_op = ?
       WHERE id = ?`,
    ).run(
      inhoudJson,
      totaal,
      omschrijvingKort(invoer, haalKeuzes()),
      v.wizardStap ?? rij.wizard_stap,
      v.gewijzigdNaDefinitief ? 1 : 0,
      UIT_INVOER.includes(v.bron) ? 1 : 0,
      tijd,
      v.id,
    );
    return { versieNr };
  })();
}

/**
 * `offerte:maak` en `offerte:maakZonderClaude` (§10.7 stap 7, OFM-047): de nieuwe inhoud komt uit de
 * wizardinvoer. Had de offerte nog geen inhoud, dan is de bron `agent` of `zonder_claude`; anders is
 * het **Maak opnieuw** en wordt de bron `wizard`. Is de offerte al definitief (nummer of PDF), dan
 * `gewijzigd_na_definitief = 1`: opnieuw definitief maken geeft een versieletter.
 */
export function bewaarVersieUitInvoer(
  id: string,
  inhoud: OfferteInhoud,
  soort: 'agent' | 'zonder_claude',
  nu: Date = new Date(),
): { versieNr: number } {
  const db = database();
  return db.transaction(() => {
    const rij = db.prepare('SELECT nummer, inhoud_json FROM offertes WHERE id = ?').get(id) as
      | { nummer: string | null; inhoud_json: string | null }
      | undefined;
    if (!rij) throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
    const heeftPdf =
      db.prepare('SELECT 1 FROM pdf_bestanden WHERE offerte_id = ? LIMIT 1').get(id) !== undefined;
    return bewaarNieuweVersie(
      {
        id,
        inhoud,
        bron: rij.inhoud_json === null ? soort : 'wizard',
        wizardStap: 4,
        gewijzigdNaDefinitief: rij.nummer !== null || heeftPdf,
      },
      nu,
    );
  })();
}

/**
 * `offerte:zetVersieTerug` (OFM-017, FE-053): nieuwe versie met bron `terugzetten` en precies de inhoud
 * van de gekozen versie (ook als dat al de huidige is: terugzetten overschrijft nooit). Is de offerte
 * definitief (nummer of PDF), dan `gewijzigd_na_definitief = 1`.
 */
export function zetVersieTerug(id: string, versieId: string, nu: Date = new Date()): { versieNr: number } {
  const db = database();
  return db.transaction(() => {
    const versie = db
      .prepare('SELECT inhoud_json FROM offerte_versies WHERE id = ? AND offerte_id = ?')
      .get(versieId, id) as { inhoud_json: string } | undefined;
    const offerte = db
      .prepare('SELECT nummer FROM offertes WHERE id = ? AND verwijderd_op IS NULL')
      .get(id) as { nummer: string | null } | undefined;
    if (!versie || !offerte) throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
    const heeftPdf =
      db.prepare('SELECT 1 FROM pdf_bestanden WHERE offerte_id = ? LIMIT 1').get(id) !== undefined;
    return bewaarNieuweVersie(
      {
        id,
        inhoud: offerteInhoudSchema.parse(JSON.parse(versie.inhoud_json)),
        bron: 'terugzetten',
        gewijzigdNaDefinitief: offerte.nummer !== null || heeftPdf,
      },
      nu,
    );
  })();
}

/**
 * `offerte:bewaarInhoud` (OFM-014, §11.4, §12.3, V-05, V-12). De renderer stuurt ingevulde tekst;
 * die gaat eerst door `terugNaarPlaatshouders`, zodat `inhoud_json` nooit klantgegevens bevat. Regels
 * die nieuw zijn of een andere prijs hebben dan opgeslagen worden `handmatig`. Is de offerte al
 * definitief (nummer of PDF), dan wordt `gewijzigd_na_definitief = 1`.
 */
export function bewaarHandmatigeInhoud(
  id: string,
  ingevuld: OfferteInhoud,
  nu: Date = new Date(),
): { versieNr: number } {
  const db = database();
  return db.transaction(() => {
    const offerte = haalOfferteVoorAgent(id);
    if (offerte.inhoud === null) throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
    const { nummer } = db.prepare('SELECT nummer FROM offertes WHERE id = ?').get(id) as {
      nummer: string | null;
    };
    const metPlaatshouders = terugNaarPlaatshouders(ingevuld, offerte.klant);
    const regels = markeerHandmatig(offerte.inhoud.regels, metPlaatshouders.regels);
    return bewaarNieuweVersie(
      {
        id,
        inhoud: { ...metPlaatshouders, regels },
        bron: 'handmatig',
        gewijzigdNaDefinitief: nummer !== null || offerte.heeftPdf,
      },
      nu,
    );
  })();
}
