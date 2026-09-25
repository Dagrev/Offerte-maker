import type { Db } from './verbinding';

// Opschonen bij opstart (TDO §14.1 stap 5, FE-062, FE-040). Tijdstippen staan als ISO-tekst
// (`new Date().toISOString()`) in `verwijderd_op` en `privacylog.tijdstip`, dus tekstvergelijking werkt.

const DAG_MS = 24 * 60 * 60 * 1000;
export const PRULLENBAK_DAGEN = 90;
export const PRIVACYLOG_DAGEN = 365;

export interface OpschoonUitkomst {
  offertes: number;
  privacylog: number;
}

/** Offertes > 90 dagen in de prullenbak definitief weg (cascade; PDF-bestanden op schijf blijven), privacylog > 365 dagen weg. */
export function schoonOp(db: Db, nu: Date = new Date()): OpschoonUitkomst {
  const grensPrullenbak = new Date(nu.getTime() - PRULLENBAK_DAGEN * DAG_MS).toISOString();
  const grensPrivacylog = new Date(nu.getTime() - PRIVACYLOG_DAGEN * DAG_MS).toISOString();
  return db.transaction(() => ({
    offertes: db
      .prepare('DELETE FROM offertes WHERE verwijderd_op IS NOT NULL AND verwijderd_op < ?')
      .run(grensPrullenbak).changes,
    privacylog: db.prepare('DELETE FROM privacylog WHERE tijdstip < ?').run(grensPrivacylog).changes,
  }))();
}
