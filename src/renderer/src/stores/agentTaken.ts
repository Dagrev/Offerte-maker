import type { Resultaat } from '@shared/fouten';
import type { Bezig } from './navigatie';

// Lopende agenttaken in de renderer (TDO §13.4 Bezig, V-07). Het Bezig-scherm wacht op de taak voor
// `bezig.id`. Een scherm dat een taak met eigen invoer start (aanpassen met instructie, OFM-017;
// teksten uit template, OFM-024) registreert de aanroep hier vóór het naar Bezig navigeert:
//
//   startAgentTaak(bezig, () => window.api.offertePasAanMetClaude({ id, instructie }));
//   gaNaar({ scherm: 'bezig', bezig });
//
// Zonder registratie start het Bezig-scherm zelf `offerte:maak` (maken) of `offerte:maakZonderClaude`
// (zonder_claude). Eén belofte per id: ook als React het effect twee keer draait (StrictMode), gaat
// er maar één aanroep naar main.

export interface AgentTaak {
  belofte: Promise<Resultaat<unknown>>;
  /** Voor OFM-024: iets doen met het resultaat (bijv. de voorstellen bewaren) vóór de navigatie. */
  bijSucces?: (data: unknown) => void;
}

const taken = new Map<string, AgentTaak>();

/** Registreert en start een taak; bestaat er al een voor dit id, dan blijft die staan. */
export function startAgentTaak<T>(
  bezig: Pick<Bezig, 'id'>,
  aanroep: () => Promise<Resultaat<T>>,
  bijSucces?: (data: T) => void,
): AgentTaak {
  const bestaand = taken.get(bezig.id);
  if (bestaand) return bestaand;
  const taak: AgentTaak = {
    belofte: aanroep(),
    ...(bijSucces && { bijSucces: bijSucces as (data: unknown) => void }),
  };
  taken.set(bezig.id, taak);
  void taak.belofte.finally(() => {
    if (taken.get(bezig.id) === taak) taken.delete(bezig.id);
  });
  return taak;
}

/** De lopende taak voor dit id, of `null`. */
export function lopendeAgentTaak(id: string): AgentTaak | null {
  return taken.get(id) ?? null;
}

/** Verstreken tijd als `m:ss` (FE-039). */
export function formatVerstreken(seconden: number): string {
  const s = Math.max(0, Math.floor(seconden));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
