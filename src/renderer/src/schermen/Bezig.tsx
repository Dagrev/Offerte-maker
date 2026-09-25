import { nl } from '../teksten/nl';

/** Placeholder (OFM-008). OFM-013 vervangt dit bestand door het echte scherm (FO S3). */
export function Bezig() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-10">
      <h1 className="text-3xl font-semibold">{nl.bezig.titel}</h1>
      <p className="text-tekst-zacht">{nl.algemeen.nogNietGebouwd}</p>
    </main>
  );
}
