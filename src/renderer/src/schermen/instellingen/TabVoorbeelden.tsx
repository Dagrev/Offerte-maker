import { nl } from '../../teksten/nl';

/**
 * Placeholder (OFM-018). OFM-019 vervangt dit bestand door de tab Voorbeelden (FO UC-13); de review staat in VoorbeeldReview.tsx.
 * De container (Instellingen.tsx) toont dit component al op tab `voorbeelden`; de export blijft `TabVoorbeelden`.
 */
export function TabVoorbeelden() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{nl.instellingen.tab.voorbeelden}</h2>
      <p className="text-tekst-zacht">{nl.algemeen.nogNietGebouwd}</p>
    </section>
  );
}
