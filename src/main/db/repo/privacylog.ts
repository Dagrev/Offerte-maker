import { randomUUID } from 'node:crypto';
import { AppFout } from '@shared/fouten';
import { weergaveNummer } from '@shared/nummering';
import type { PrivacylogDetail, PrivacylogItem } from '@shared/types';
import { database } from '../verbinding';

// Privacylog (TDO §4.2, FE-040). OFM-012 levert alleen het schrijven; OFM-013 gebruikt het ook,
// OFM-021 voegt het lezen toe. `tijdstip` altijd als ISO-tekst (zie db/opschonen.ts).

export interface Logregel {
  soort: 'maken' | 'aanpassen' | 'template_teksten' | 'test';
  offerteId: string | null;
  /** Exact verstuurde tekst: systeemprompt + `\n\n---\n\n` + opdracht (§10.7 stap 5). */
  opdracht: string;
  antwoord: string | null;
  resultaat: 'ok' | 'fout' | 'afgebroken';
  foutcode: string | null;
}

export function schrijfLogregel(regel: Logregel, nu: Date = new Date()): string {
  const id = randomUUID();
  database()
    .prepare(
      'INSERT INTO privacylog (id, tijdstip, offerte_id, soort, opdracht, antwoord, resultaat, foutcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      nu.toISOString(),
      regel.offerteId,
      regel.soort,
      regel.opdracht,
      regel.antwoord,
      regel.resultaat,
      regel.foutcode,
    );
  return id;
}

// ---------- Lezen (OFM-021, V-18, V-27) ----------

/** Maximaal aantal regels in de lijst (V-18). */
export const PRIVACYLOG_LIMIET = 500;

interface ItemRij {
  id: string;
  tijdstip: string;
  soort: PrivacylogItem['soort'];
  resultaat: PrivacylogItem['resultaat'];
  foutcode: string | null;
  nummer: string | null;
  laatste_letter: string | null;
}

/**
 * Kolommen voor een lijstregel. `offerte_id` heeft geen foreign key (§4.2): bestaat de offerte niet
 * meer, dan is `nummer` NULL. Het nummer is het weergavenummer met de letter van de laatste PDF.
 */
const KOLOMMEN = `
  p.id, p.tijdstip, p.soort, p.resultaat, p.foutcode, o.nummer,
  (SELECT f.versieletter FROM pdf_bestanden f WHERE f.offerte_id = o.id
     ORDER BY f.aangemaakt_op DESC, f.versieletter DESC LIMIT 1) AS laatste_letter`;

function naarItem(rij: ItemRij): PrivacylogItem {
  return {
    id: rij.id,
    tijdstip: rij.tijdstip,
    // Test- en templateregels horen nooit bij een offerte (V-27: kolom toont "—").
    offerteNummer:
      rij.soort === 'maken' || rij.soort === 'aanpassen'
        ? weergaveNummer(rij.nummer, rij.laatste_letter)
        : null,
    soort: rij.soort,
    resultaat: rij.resultaat,
    foutcode: rij.foutcode,
  };
}

/** `privacylog:lijst`: nieuwste eerst, maximaal 500, zonder opdracht- en antwoordtekst. */
export function lijstPrivacylog(): PrivacylogItem[] {
  const rijen = database()
    .prepare(
      `SELECT ${KOLOMMEN} FROM privacylog p LEFT JOIN offertes o ON o.id = p.offerte_id
       ORDER BY p.tijdstip DESC, p.rowid DESC LIMIT ${PRIVACYLOG_LIMIET}`,
    )
    .all() as ItemRij[];
  return rijen.map(naarItem);
}

/** `privacylog:haal`: één regel met de tekst precies zoals opgeslagen (plaatshouders niet ingevuld). */
export function haalPrivacylog(id: string): PrivacylogDetail {
  const rij = database()
    .prepare(
      `SELECT ${KOLOMMEN}, p.opdracht, p.antwoord FROM privacylog p
       LEFT JOIN offertes o ON o.id = p.offerte_id WHERE p.id = ?`,
    )
    .get(id) as (ItemRij & { opdracht: string; antwoord: string | null }) | undefined;
  if (!rij) throw new AppFout('VALIDATIE');
  return { ...naarItem(rij), opdracht: rij.opdracht, antwoord: rij.antwoord };
}
