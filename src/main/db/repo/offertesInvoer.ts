import { randomUUID } from 'node:crypto';
import { berekenTotalen } from '@shared/calc/bedragen';
import { AppFout } from '@shared/fouten';
import {
  kopieerInvoer,
  legeKlant,
  legeKlusInvoer,
  normaliseerKlant,
  zoektekstVan,
} from '@shared/nieuweOfferte';
import { omschrijvingKort } from '@shared/omschrijvingKort';
import { berekenGeldigTot } from '@shared/periode';
import { klantSchema, klusInvoerSchema, offerteInhoudSchema, statusSchema } from '@shared/schemas';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { Klant, KlusInvoer, OfferteDetail } from '@shared/types';
import { invullen } from '../../privacy/invullen';
import { database } from '../verbinding';

// Offerte aanmaken, ophalen en de wizardinvoer bewaren (TDO §6.2, §6.3, §8.2, V-12). Eigenaar: OFM-010.
// Tijdstippen als ISO-tekst (`toISOString`); datums van de offerte als `YYYY-MM-DD` uit `vandaag()`.

/** §12.3: na definitief mag de wizardinvoer niet meer veranderen. */
export const MELDING_AL_DEFINITIEF = 'Deze offerte is al definitief; pas de offerte aan of maak een kopie.';

interface OfferteRij {
  id: string;
  status: string;
  nummer: string | null;
  offertedatum: string;
  geldig_tot: string;
  wizard_stap: number;
  klant_json: string;
  invoer_json: string;
  inhoud_json: string | null;
  gewijzigd_na_definitief: number;
}

function haalRij(id: string): OfferteRij {
  const rij = database()
    .prepare(
      `SELECT id, status, nummer, offertedatum, geldig_tot, wizard_stap, klant_json, invoer_json, inhoud_json,
              gewijzigd_na_definitief
       FROM offertes WHERE id = ?`,
    )
    .get(id) as OfferteRij | undefined;
  if (!rij) throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
  return rij;
}

export interface NieuweOfferte {
  bronId?: string | undefined;
  zelfdeKlant?: boolean | undefined;
  /** `vandaag()` (V-10). */
  vandaag: string;
  geldigheidDagen: number;
}

/**
 * `offerte:nieuw` (§6.2). Zonder bron: lege klant en invoer, stap 1. Met bron (kopie, FE-061): invoer
 * gekopieerd met nieuwe dakvlak-id's, klant alleen bij `zelfdeKlant` (dan stap 2); geen inhoud.
 */
export function maakOfferte(opties: NieuweOfferte, nu: Date = new Date()): string {
  let klant: Klant = legeKlant();
  let invoer: KlusInvoer = legeKlusInvoer();
  let stap = 1;
  if (opties.bronId !== undefined) {
    const bron = haalRij(opties.bronId);
    invoer = kopieerInvoer(klusInvoerSchema.parse(JSON.parse(bron.invoer_json)));
    if (opties.zelfdeKlant) {
      klant = klantSchema.parse(JSON.parse(bron.klant_json));
      stap = 2;
    }
  }
  const id = randomUUID();
  const tijd = nu.toISOString();
  database()
    .prepare(
      `INSERT INTO offertes (id, status, offertedatum, geldig_tot, wizard_stap, klant_json, invoer_json,
         inhoud_json, totaal_incl_cent, omschrijving_kort, zoektekst, aangemaakt_op, bijgewerkt_op)
       VALUES (?, 'concept', ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
    )
    .run(
      id,
      opties.vandaag,
      berekenGeldigTot(opties.vandaag, opties.geldigheidDagen),
      stap,
      JSON.stringify(klant),
      JSON.stringify(invoer),
      omschrijvingKort(invoer),
      zoektekstVan(klant, null),
      tijd,
      tijd,
    );
  return id;
}

/** `offerte:haal` (§6.3): inhoud met echte waarden ingevuld (§11.4) en totalen berekend (§7). */
export function haalOfferte(id: string): OfferteDetail {
  const rij = haalRij(id);
  const klant = klantSchema.parse(JSON.parse(rij.klant_json));
  const opgeslagen = rij.inhoud_json === null ? null : offerteInhoudSchema.parse(JSON.parse(rij.inhoud_json));
  const db = database();
  const versies = db
    .prepare(
      `SELECT id, versie_nr AS versieNr, bron, aangemaakt_op AS aangemaaktOp
       FROM offerte_versies WHERE offerte_id = ? ORDER BY versie_nr DESC`,
    )
    .all(id) as OfferteDetail['versies'];
  const pdfs = db
    .prepare(
      `SELECT versieletter, pad, aangemaakt_op AS aangemaaktOp
       FROM pdf_bestanden WHERE offerte_id = ? ORDER BY aangemaakt_op, versieletter`,
    )
    .all(id) as OfferteDetail['pdfs'];
  return {
    id: rij.id,
    status: statusSchema.parse(rij.status),
    nummer: rij.nummer,
    offertedatum: rij.offertedatum,
    geldigTot: rij.geldig_tot,
    wizardStap: rij.wizard_stap,
    klant,
    invoer: klusInvoerSchema.parse(JSON.parse(rij.invoer_json)),
    inhoud: opgeslagen === null ? null : invullen(opgeslagen, klant),
    totalen: opgeslagen === null ? null : berekenTotalen(opgeslagen.regels),
    versies,
    pdfs,
    gewijzigdNaDefinitief: rij.gewijzigd_na_definitief === 1,
  };
}

export interface InvoerWijziging {
  id: string;
  klant?: Klant | undefined;
  invoer?: KlusInvoer | undefined;
  wizardStap?: number | undefined;
  offertedatum?: string | undefined;
}

/**
 * `offerte:bewaarInvoer`: werkt alleen de meegegeven delen bij en zet de afgeleide velden opnieuw
 * (V-12): `zoektekst`, `omschrijving_kort`, `bijgewerkt_op`, en `geldig_tot` bij een nieuwe datum.
 */
export function bewaarInvoer(w: InvoerWijziging, geldigheidDagen: number, nu: Date = new Date()): void {
  const db = database();
  db.transaction(() => {
    const rij = haalRij(w.id);
    const heeftPdf = db.prepare('SELECT 1 FROM pdf_bestanden WHERE offerte_id = ? LIMIT 1').get(w.id);
    if (rij.nummer !== null || heeftPdf) throw new AppFout('VALIDATIE', MELDING_AL_DEFINITIEF);

    const klant = w.klant ? normaliseerKlant(w.klant) : klantSchema.parse(JSON.parse(rij.klant_json));
    const invoer = w.invoer ?? klusInvoerSchema.parse(JSON.parse(rij.invoer_json));
    const offertedatum = w.offertedatum ?? rij.offertedatum;
    const geldigTot =
      w.offertedatum !== undefined ? berekenGeldigTot(w.offertedatum, geldigheidDagen) : rij.geldig_tot;

    db.prepare(
      `UPDATE offertes SET klant_json = ?, invoer_json = ?, wizard_stap = ?, offertedatum = ?, geldig_tot = ?,
         omschrijving_kort = ?, zoektekst = ?, bijgewerkt_op = ?
       WHERE id = ?`,
    ).run(
      JSON.stringify(klant),
      JSON.stringify(invoer),
      w.wizardStap ?? rij.wizard_stap,
      offertedatum,
      geldigTot,
      omschrijvingKort(invoer),
      zoektekstVan(klant, rij.nummer),
      nu.toISOString(),
      w.id,
    );
  })();
}
