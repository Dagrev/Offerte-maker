import type { Bedrijf } from '@shared/types';
import { database } from '../db/verbinding';
import { log } from '../log';
import { redigeerVoorbeeld } from '../privacy/voorbeeldRedactie';
import { haalTekstUit } from './tekstExtractie';

// V-16: na het bewaren van `bedrijf` alle voorbeelden opnieuw redigeren vanaf de brontekst (OFM-018).
// Eigen bestand, zodat `db/repo/voorbeelden.ts` van OFM-019 blijft. Aanroeper synchroniseert daarna
// de agentwerkmap.

interface Rij {
  id: string;
  bestandsnaam: string;
  handmatige_redacties: string;
  inhoud: Uint8Array;
}

function leesRedacties(json: string): string[] {
  try {
    const waarde: unknown = JSON.parse(json);
    return Array.isArray(waarde) ? waarde.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Leest elk voorbeeld opnieuw uit zijn originele bestand en zet `tekst_geanonimiseerd` opnieuw met
 * de huidige bedrijfsgegevens en de handmatige redacties. Een voorbeeld dat niet (meer) te lezen is,
 * wordt overgeslagen en gelogd; de rest gaat door. Geeft het aantal bijgewerkte voorbeelden.
 */
export async function herRedigeerVoorbeelden(bedrijf: Bedrijf): Promise<number> {
  const db = database();
  const rijen = db
    .prepare(
      `SELECT v.id, v.bestandsnaam, v.handmatige_redacties, b.inhoud
       FROM voorbeelden v JOIN bestanden b ON b.id = v.bestand_id`,
    )
    .all() as Rij[];
  const zet = db.prepare('UPDATE voorbeelden SET tekst_geanonimiseerd = ? WHERE id = ?');

  let bijgewerkt = 0;
  for (const rij of rijen) {
    try {
      const bron = await haalTekstUit(rij.inhoud, rij.bestandsnaam);
      zet.run(redigeerVoorbeeld(bron, bedrijf, leesRedacties(rij.handmatige_redacties)), rij.id);
      bijgewerkt += 1;
    } catch (fout) {
      log.warn(`voorbeeld ${rij.id} niet opnieuw geredigeerd`, fout instanceof Error ? fout.name : '');
    }
  }
  log.info(`voorbeelden opnieuw geredigeerd: ${bijgewerkt} van ${rijen.length}`);
  return bijgewerkt;
}
