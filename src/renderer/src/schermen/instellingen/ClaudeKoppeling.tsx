import { nl } from '../../teksten/nl';

/**
 * Placeholder (OFM-018). OFM-020 vervangt dit bestand door Geavanceerd, Claude-koppeling (FO UC-14).
 * De container (Instellingen.tsx) toont dit component al op tab `claudeKoppeling`; de export blijft `ClaudeKoppeling`.
 */
export function ClaudeKoppeling() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{nl.instellingen.tab.claudeKoppeling}</h2>
      <p className="text-tekst-zacht">{nl.algemeen.nogNietGebouwd}</p>
    </section>
  );
}
