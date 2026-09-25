import type { z } from 'zod';
import { instellingSchemas, standaardInstelling, type InstellingSleutel } from '@shared/schemas';
import { log } from '../../log';
import { database } from '../verbinding';

// Instellingen (TDO §4.3, V-12, V-13). Lezen valideert met het schema uit shared/schemas.ts; een
// ontbrekende sleutel geeft de standaardwaarde. Standaardwaarden worden niet opgeslagen.

export type InstellingWaarde<S extends InstellingSleutel> = z.infer<(typeof instellingSchemas)[S]>;

export function haalInstelling<S extends InstellingSleutel>(sleutel: S): InstellingWaarde<S> {
  const rij = database().prepare('SELECT waarde_json FROM instellingen WHERE sleutel = ?').get(sleutel) as
    { waarde_json: string } | undefined;
  if (!rij) return standaardInstelling(sleutel);

  let ruw: unknown;
  try {
    ruw = JSON.parse(rij.waarde_json);
  } catch {
    ruw = undefined;
  }
  const gecontroleerd = instellingSchemas[sleutel].safeParse(ruw);
  if (!gecontroleerd.success) {
    // V-12: waarschuwen zonder de waarde; de rij blijft staan tot de volgende keer bewaren.
    log.warn(`instelling ${sleutel}: opgeslagen waarde ongeldig, standaardwaarde gebruikt`);
    return standaardInstelling(sleutel);
  }
  return gecontroleerd.data as InstellingWaarde<S>;
}

/** Bewaart de volledige waarde (gevalideerd met het schema). */
export function bewaarInstelling<S extends InstellingSleutel>(sleutel: S, waarde: InstellingWaarde<S>): void {
  const geldig = instellingSchemas[sleutel].parse(waarde);
  database()
    .prepare(
      'INSERT INTO instellingen (sleutel, waarde_json) VALUES (?, ?) ON CONFLICT(sleutel) DO UPDATE SET waarde_json = excluded.waarde_json',
    )
    .run(sleutel, JSON.stringify(geldig));
}

/** Leest, past een deel aan en bewaart; bv. `wijzigInstelling('app', { welkomVoltooid: true })`. */
export function wijzigInstelling<S extends InstellingSleutel>(
  sleutel: S,
  deel: Partial<InstellingWaarde<S>>,
): InstellingWaarde<S> {
  const nieuw = { ...haalInstelling(sleutel), ...deel } as InstellingWaarde<S>;
  bewaarInstelling(sleutel, nieuw);
  return nieuw;
}
