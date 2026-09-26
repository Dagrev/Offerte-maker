import {
  KEUZE_STARTSET,
  VRAAGT_BEDEKKING_STARTSET,
  ZIN_LIJSTEN,
  ZIN_STARTSET,
} from '../../shared/keuzelijsten';
import type { Db } from './verbinding';

// Migratie 009 (OFM-050, TDO §4.2): het huidige dak in stap 2, de nieuwe dakbedekking in stap 3.
// `zetNieuweBedekkingOm` draait vóór de SQL (zoals de omzetting van 005), `zetHuidigDakStartset` erna
// (startgegevens nooit in de SQL, V-13). Beide zijn idempotent. Relatieve imports: de seed
// (`scripts/seedGegevens.ts`) gebruikt dit ook, zonder de alias `@shared`.

/** De werkzaamheid uit de startset (§9.6) waarvan het materiaal de nieuwe dakbedekking is. */
export const BEDEKKING_WERKZAAMHEID = 'nieuwe_bedekking';

interface OpgeslagenWerk {
  sleutel?: string | null;
  materialen?: { sleutel?: string | null }[];
}

/**
 * De nieuwe dakbedekking van een bestaande offerte: het eerste gekozen materiaal bij de werkzaamheid
 * Nieuwe bedekking dat ook een optie van de lijst `nieuweBedekking` is (bitumen, EPDM, PVC); anders
 * `null`.
 */
export function nieuweBedekkingUitWerkzaamheden(
  werkzaamheden: readonly OpgeslagenWerk[] | undefined,
): string | null {
  const opties = new Set(KEUZE_STARTSET.nieuweBedekking.map((o) => o.sleutel));
  for (const werk of werkzaamheden ?? []) {
    if (werk.sleutel !== BEDEKKING_WERKZAAMHEID) continue;
    const materiaal = werk.materialen?.find((m) => m.sleutel != null && opties.has(m.sleutel));
    if (materiaal?.sleutel) return materiaal.sleutel;
  }
  return null;
}

/** Vóór de SQL van 009: elke offerte krijgt `nieuweBedekking` (afgeleid of `null`). Geeft het aantal met een waarde. */
export function zetNieuweBedekkingOm(db: Db): number {
  const offertes = db.prepare('SELECT id, invoer_json FROM offertes').all() as {
    id: string;
    invoer_json: string;
  }[];
  const bijwerken = db.prepare('UPDATE offertes SET invoer_json = ? WHERE id = ?');
  let aantal = 0;
  for (const rij of offertes) {
    const invoer = JSON.parse(rij.invoer_json) as Record<string, unknown> & {
      werkzaamheden?: OpgeslagenWerk[];
    };
    if ('nieuweBedekking' in invoer) continue;
    const nieuweBedekking = nieuweBedekkingUitWerkzaamheden(invoer.werkzaamheden);
    if (nieuweBedekking !== null) aantal += 1;
    bijwerken.run(JSON.stringify({ ...invoer, nieuweBedekking }), rij.id);
  }
  return aantal;
}

/**
 * Na de SQL van 009: de opties van `nieuweBedekking` (als ze er nog niet zijn), de startzinnen bij de
 * startopties zonder zin, en het vinkje "vraagt nieuwe dakbedekking" bij dak vervangen en nieuw dak.
 */
export function zetHuidigDakStartset(db: Db): void {
  const invoegen = db.prepare(
    `INSERT OR IGNORE INTO keuzeopties (id, lijst, sleutel, label, volgorde, verborgen, standaard, standaardkeuze)
     VALUES (?, 'nieuweBedekking', ?, ?, ?, 0, 1, 0)`,
  );
  KEUZE_STARTSET.nieuweBedekking.forEach((optie, index) => {
    invoegen.run(`start-nieuweBedekking-${optie.sleutel}`, optie.sleutel, optie.label, (index + 1) * 10);
  });
  const zin = db.prepare(
    "UPDATE keuzeopties SET zin = ? WHERE lijst = ? AND sleutel = ? AND standaard = 1 AND zin = ''",
  );
  for (const lijst of ZIN_LIJSTEN) {
    for (const [sleutel, tekst] of Object.entries(ZIN_STARTSET[lijst])) zin.run(tekst, lijst, sleutel);
  }
  const vraagt = db.prepare(
    "UPDATE keuzeopties SET vraagt_bedekking = 1 WHERE lijst = 'soortWerk' AND sleutel = ? AND standaard = 1",
  );
  for (const sleutel of VRAAGT_BEDEKKING_STARTSET) vraagt.run(sleutel);
}
