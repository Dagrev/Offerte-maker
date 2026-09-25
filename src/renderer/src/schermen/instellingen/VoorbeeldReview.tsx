import { nl } from '../../teksten/nl';

/** Placeholder (OFM-008). OFM-019 vervangt dit bestand door het echte scherm (TDO §13.4); het staat binnen
 * de tab Voorbeelden van Instellingen, niet in App.tsx. */
export function VoorbeeldReview() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{nl.voorbeelden.reviewTitel}</h2>
      <p className="text-tekst-zacht">{nl.algemeen.nogNietGebouwd}</p>
    </section>
  );
}
