import { randomUUID } from 'node:crypto';
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
