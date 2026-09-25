import { nl } from '../../teksten/nl';

/**
 * Placeholder (OFM-018). OFM-022 vervangt dit bestand door Geavanceerd, Back-ups (FO UC-16).
 * De container (Instellingen.tsx) toont dit component al op tab `backups`; de export blijft `Backups`.
 */
export function Backups() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{nl.instellingen.tab.backups}</h2>
      <p className="text-tekst-zacht">{nl.algemeen.nogNietGebouwd}</p>
    </section>
  );
}
