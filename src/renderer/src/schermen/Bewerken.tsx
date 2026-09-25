import { nl } from '../teksten/nl';

/** Placeholder (OFM-008). OFM-014 vervangt dit bestand door het echte scherm (FO UC-06). */
export function Bewerken() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-10">
      <h1 className="text-3xl font-semibold">{nl.bewerken.titel}</h1>
      <p className="text-tekst-zacht">{nl.algemeen.nogNietGebouwd}</p>
    </main>
  );
}
