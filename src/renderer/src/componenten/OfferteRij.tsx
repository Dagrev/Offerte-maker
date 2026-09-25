import type { OfferteLijstItem } from '@shared/types';
import { formatEuroHeel } from '@shared/formatteer';
import { nl } from '../teksten/nl';
import { StatusLabel } from './StatusLabel';

/** Kolommen van de offertelijst; gedeeld met de kopregel in het overzicht. */
export const offerteRijKolommen =
  'grid grid-cols-[8rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.6fr)_10rem_8.5rem] items-center gap-4';

export interface OfferteRijProps {
  offerte: OfferteLijstItem;
  opKies: (offerte: OfferteLijstItem) => void;
}

/**
 * Eén offerte in een lijst (TDO §13.4, FE-012): nummer of "Concept", klant, plaats, korte
 * omschrijving, totaal incl. btw in hele euro's (V-14) of "nog niet gemaakt", en het statuslabel.
 * De hele rij is één knop. Ook bruikbaar voor de prullenbak (OFM-016).
 */
export function OfferteRij({ offerte, opKies }: OfferteRijProps) {
  const t = nl.overzicht;
  return (
    <button
      type="button"
      onClick={() => opKies(offerte)}
      className={`${offerteRijKolommen} min-h-16 w-full rounded-knop px-4 py-3 text-left hover:bg-vlak`}
    >
      <span className={offerte.nummer ? 'font-semibold tabular-nums' : 'text-tekst-zacht'}>
        {offerte.nummer ?? t.concept}
      </span>
      <span className="truncate font-semibold">{offerte.klantWeergave}</span>
      <span className="truncate">{offerte.plaats}</span>
      <span className="truncate text-tekst-zacht">{offerte.omschrijvingKort}</span>
      <span
        className={
          offerte.totaalInclCent === null ? 'text-right text-tekst-zacht' : 'text-right tabular-nums'
        }
      >
        {offerte.totaalInclCent === null ? t.nogNietGemaakt : formatEuroHeel(offerte.totaalInclCent)}
      </span>
      <span className="justify-self-end">
        <StatusLabel status={offerte.status} />
      </span>
    </button>
  );
}
