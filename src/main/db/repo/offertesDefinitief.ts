import { randomUUID } from 'node:crypto';
import { AppFout } from '@shared/fouten';
import { zoektekstVan } from '@shared/nieuweOfferte';
import { formatNummer, versieletter } from '@shared/nummering';
import { omschrijvingKort } from '@shared/omschrijvingKort';
import { berekenGeldigTot } from '@shared/periode';
import { klantSchema, klusInvoerSchema } from '@shared/schemas';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { Klant } from '@shared/types';
import { haalKeuzes } from './keuzeopties';
import { database, type Db } from '../verbinding';

// Definitief maken en PDF-bestanden (TDO §8.1, §12.3, V-01, V-12). Eigenaar: OFM-015.
// Alleen synchrone database-stappen; de asynchrone PDF-stap zit in `pdf/definitief.ts`.

/** §8.1: volgend volgnummer voor een jaar. */
export function volgendNummer(db: Db, jaar: number): number {
  const { volgend } = db
    .prepare('SELECT COALESCE(MAX(volgnummer), 0) + 1 AS volgend FROM offertes WHERE jaar = ?')
    .get(jaar) as { volgend: number };
  return volgend;
}

export interface DefinitiefPlan {
  id: string;
  klant: Klant;
  jaar: number;
  volgnummer: number;
  /** `JJJJ-NNN`; voorlopig als de offerte nog geen nummer had (`nieuwNummer`). */
  nummer: string;
  nieuwNummer: boolean;
  versieletter: string;
}

/**
 * V-01 stap 2, alleen lezen: bestaand nummer of voorlopig nummer, en de versieletter. Onbekend id of
 * nog geen inhoud → `VALIDATIE`.
 */
export function planDefinitief(id: string): DefinitiefPlan {
  const db = database();
  const rij = db
    .prepare(
      `SELECT jaar, volgnummer, nummer, offertedatum, klant_json, inhoud_json FROM offertes
       WHERE id = ? AND verwijderd_op IS NULL`,
    )
    .get(id) as
    | {
        jaar: number | null;
        volgnummer: number | null;
        nummer: string | null;
        offertedatum: string;
        klant_json: string;
        inhoud_json: string | null;
      }
    | undefined;
  if (!rij || rij.inhoud_json === null) throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
  const { aantal } = db
    .prepare('SELECT COUNT(*) AS aantal FROM pdf_bestanden WHERE offerte_id = ?')
    .get(id) as {
    aantal: number;
  };
  const klant = klantSchema.parse(JSON.parse(rij.klant_json));
  if (rij.nummer !== null && rij.jaar !== null && rij.volgnummer !== null) {
    return {
      id,
      klant,
      jaar: rij.jaar,
      volgnummer: rij.volgnummer,
      nummer: rij.nummer,
      nieuwNummer: false,
      versieletter: versieletter(aantal),
    };
  }
  const jaar = Number(rij.offertedatum.slice(0, 4));
  const volgnummer = volgendNummer(db, jaar);
  return {
    id,
    klant,
    jaar,
    volgnummer,
    nummer: formatNummer(jaar, volgnummer),
    nieuwNummer: true,
    versieletter: versieletter(aantal),
  };
}

/**
 * V-01 stap 5, één synchrone transactie: nummer vastleggen (als nieuw), `pdf_bestanden`-regel, status
 * `concept` → `klaar`, `gewijzigd_na_definitief = 0`, `geldig_tot` (V-12), `zoektekst` en
 * `omschrijving_kort`.
 */
export function legDefinitiefVast(
  plan: DefinitiefPlan,
  pad: string,
  geldigheidDagen: number,
  nu: Date = new Date(),
): void {
  const db = database();
  const tijd = nu.toISOString();
  db.transaction(() => {
    const rij = db
      .prepare('SELECT offertedatum, klant_json, invoer_json FROM offertes WHERE id = ?')
      .get(plan.id) as {
      offertedatum: string;
      klant_json: string;
      invoer_json: string;
    };
    const klant = klantSchema.parse(JSON.parse(rij.klant_json));
    const invoer = klusInvoerSchema.parse(JSON.parse(rij.invoer_json));
    if (plan.nieuwNummer) {
      db.prepare(
        'UPDATE offertes SET jaar = ?, volgnummer = ?, nummer = ? WHERE id = ? AND nummer IS NULL',
      ).run(plan.jaar, plan.volgnummer, plan.nummer, plan.id);
    }
    db.prepare(
      'INSERT INTO pdf_bestanden (id, offerte_id, versieletter, pad, aangemaakt_op) VALUES (?, ?, ?, ?, ?)',
    ).run(randomUUID(), plan.id, plan.versieletter, pad, tijd);
    db.prepare(
      `UPDATE offertes SET status = CASE WHEN status = 'concept' THEN 'klaar' ELSE status END,
         gewijzigd_na_definitief = 0, geldig_tot = ?, zoektekst = ?, omschrijving_kort = ?, bijgewerkt_op = ?
       WHERE id = ?`,
    ).run(
      berekenGeldigTot(rij.offertedatum, geldigheidDagen),
      zoektekstVan(klant, plan.nummer),
      omschrijvingKort(invoer, haalKeuzes()),
      tijd,
      plan.id,
    );
  })();
}

export interface LaatstePdf {
  pad: string;
  versieletter: string;
  nummer: string;
}

/** De nieuwste PDF van een offerte (§12.4); zonder PDF → `VALIDATIE` "Maak de offerte eerst definitief." */
export function laatstePdf(id: string): LaatstePdf {
  const rij = database()
    .prepare(
      `SELECT p.pad, p.versieletter, o.nummer FROM pdf_bestanden p JOIN offertes o ON o.id = p.offerte_id
       WHERE p.offerte_id = ? ORDER BY p.aangemaakt_op DESC, length(p.versieletter) DESC, p.versieletter DESC
       LIMIT 1`,
    )
    .get(id) as { pad: string; versieletter: string; nummer: string } | undefined;
  if (!rij) throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.eerstDefinitief);
  return rij;
}
