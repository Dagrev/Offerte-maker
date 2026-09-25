import type { ClaudeStatus } from '@shared/types';

// "In deze sessie mislukt" (TDO V-09, OFM-025): offertes waarvoor een `maken`-poging is mislukt. Geen
// databasegegeven: na een herstart telt alleen nog `claude:status`. De wizard zet een offerte hier
// zodra hij met een fout van het Bezig-scherm terugkomt (V-07).

const mislukt = new Set<string>();

export function markeerMislukt(offerteId: string): void {
  mislukt.add(offerteId);
}

export function isMislukt(offerteId: string): boolean {
  return mislukt.has(offerteId);
}

/** Alleen voor tests. */
export function wisMislukt(): void {
  mislukt.clear();
}

/** V-09: de knop **Maak zonder Claude** verschijnt bij een statusfout of na een mislukte poging. */
export function toonZonderClaude(status: ClaudeStatus | null, offerteId: string): boolean {
  return status?.toestand === 'fout' || isMislukt(offerteId);
}
