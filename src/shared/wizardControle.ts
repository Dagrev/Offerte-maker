import type { Klant } from './types';
import { ongeldigeKlantVelden, type KlantVeld, type ValidatieFout } from './validatie';

// Controles van stap 1 van de wizard (FE-024, V-16, OFM-030). Pure functies; de meldingsteksten staan
// in de tekstmodule van de wizard en in `teksten/validatie.ts`. Alle fouten blokkeren **Volgende**.

export interface KlantControle {
  /** Verplichte velden die leeg zijn. */
  fouten: { naam?: 'leeg'; plaats?: 'leeg' };
  /** Ingevulde velden met een ongeldige waarde (OFM-030); lege velden staan hier nooit in. */
  ongeldig: Partial<Record<KlantVeld, ValidatieFout>>;
}

export function controleerKlant(klant: Klant): KlantControle {
  const fouten: KlantControle['fouten'] = {};
  if (klant.naam.trim() === '') fouten.naam = 'leeg';
  if (klant.adres.plaats.trim() === '') fouten.plaats = 'leeg';
  return { fouten, ongeldig: ongeldigeKlantVelden(klant) };
}

/** `true` als **Volgende** op stap 1 mag: niets leeg wat verplicht is en niets ongeldig. */
export function klantCompleet(klant: Klant): boolean {
  const { fouten, ongeldig } = controleerKlant(klant);
  return Object.keys(fouten).length === 0 && Object.keys(ongeldig).length === 0;
}
