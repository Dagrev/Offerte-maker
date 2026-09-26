import { useId, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { nl } from '../teksten/nl';
import { Knop } from './Knop';

/** Maakt de puntenlijst inklapbaar (OFM-036). De teksten komen van de aanroeper (`teksten/`). */
export interface GeleBalkInklappen {
  uitgeklapt: boolean;
  opWissel: (uitgeklapt: boolean) => void;
  /** Achter de titel, bijv. "19 punten"; loopt mee met het aantal. */
  aantal: string;
  toon: string;
  verberg: string;
  /** Toegankelijke naam van de (scrollbare) lijst. */
  lijstNaam: string;
}

export interface GeleBalkProps {
  /** Kop van de balk; standaard "Let op". */
  titel?: string;
  /** Punten om te controleren (FE-051, V-05). Een lege lijst toont niets. */
  punten?: readonly string[];
  /** Zonder dit veld staat de lijst altijd open (zoals op het welkomstscherm). */
  inklappen?: GeleBalkInklappen;
  children?: ReactNode;
}

/**
 * Gele balk met punten die de gebruiker moet controleren. Inklapbaar: samengevouwen één regel met
 * titel, aantal en **Toon punten**; uitgeklapt een lijst van hoogstens ±40 % van het venster die
 * zelf scrollt, zodat het voorbeeld eronder zichtbaar blijft.
 */
export function GeleBalk({ titel = nl.componenten.controleer, punten, inklappen, children }: GeleBalkProps) {
  const lijstId = useId();
  const heeftPunten = !!punten && punten.length > 0;
  if (!children && !heeftPunten) return null;
  const open = !inklappen || inklappen.uitgeklapt;

  const lijst = heeftPunten && (
    <ul className="list-disc space-y-1 pl-6">
      {punten.map((punt, i) => (
        <li key={i}>{punt}</li>
      ))}
    </ul>
  );

  return (
    <section
      role="status"
      className={`flex gap-4 rounded-knop border-2 border-waarschuwing-rand bg-waarschuwing-vlak text-waarschuwing ${
        open ? 'p-5' : 'items-center px-5 py-2'
      }`}
    >
      {/* Uitgeklapt met knop: het icoon op de hoogte van de kopregel (knop 56 px hoog). */}
      <AlertTriangle
        aria-hidden="true"
        className={`size-7 shrink-0 ${inklappen && open && heeftPunten ? 'mt-3.5' : ''}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {inklappen ? (
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">
              {titel} {inklappen.aantal}
            </h2>
            {heeftPunten && (
              <Knop
                label={open ? inklappen.verberg : inklappen.toon}
                icoon={open ? ChevronUp : ChevronDown}
                aria-expanded={open}
                aria-controls={lijstId}
                onClick={() => inklappen.opWissel(!open)}
              />
            )}
          </div>
        ) : (
          <h2 className="font-semibold">{titel}</h2>
        )}
        {inklappen
          ? heeftPunten && (
              // tabIndex: de lijst kan zelf scrollen en moet dan met het toetsenbord te scrollen zijn.
              <div
                id={lijstId}
                role="region"
                aria-label={inklappen.lijstNaam}
                tabIndex={0}
                hidden={!open}
                className="max-h-[40vh] overflow-y-auto pr-2"
              >
                {lijst}
              </div>
            )
          : lijst}
        {children}
      </div>
    </section>
  );
}
