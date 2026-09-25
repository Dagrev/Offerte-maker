import { nl } from '../../teksten/nl';

/**
 * Placeholder (OFM-018). OFM-021 vervangt dit bestand door Geavanceerd, Wat is naar Claude gestuurd (FO UC-15).
 * De container (Instellingen.tsx) toont dit component al op tab `privacylog`; de export blijft `Privacylog`.
 */
export function Privacylog() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{nl.instellingen.tab.privacylog}</h2>
      <p className="text-tekst-zacht">{nl.algemeen.nogNietGebouwd}</p>
    </section>
  );
}
