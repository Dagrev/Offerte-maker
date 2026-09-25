import { nl } from '../../teksten/nl';

/**
 * Placeholder (OFM-018). OFM-021 vervangt dit bestand door Geavanceerd, Over (V-17).
 * De container (Instellingen.tsx) toont dit component al op tab `over`; de export blijft `Over`.
 */
export function Over() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{nl.instellingen.tab.over}</h2>
      <p className="text-tekst-zacht">{nl.algemeen.nogNietGebouwd}</p>
    </section>
  );
}
