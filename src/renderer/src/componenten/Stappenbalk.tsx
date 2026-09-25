import { Check } from 'lucide-react';
import { nl } from '../teksten/nl';

export interface StappenbalkProps {
  /** Namen van de stappen, in volgorde. */
  stappen: readonly string[];
  /** Huidige stap, vanaf 1. */
  huidig: number;
  /** Optioneel: naar een eerdere stap springen. Latere stappen zijn niet klikbaar. */
  opKies?: (stap: number) => void;
}

/** Genummerde stappen bovenaan de wizard; de huidige stap heeft `aria-current="step"`. */
export function Stappenbalk({ stappen, huidig, opKies }: StappenbalkProps) {
  return (
    <nav aria-label={nl.componenten.stappen}>
      <p className="sr-only">{nl.componenten.stap(huidig, stappen.length)}</p>
      <ol className="flex flex-wrap items-center gap-2">
        {stappen.map((naam, index) => {
          const nummer = index + 1;
          const klaar = nummer < huidig;
          const actief = nummer === huidig;
          const rondje = (
            <span
              aria-hidden="true"
              className={
                'flex size-9 shrink-0 items-center justify-center rounded-full border-2 font-semibold ' +
                (actief
                  ? 'border-accent bg-accent text-white'
                  : klaar
                    ? 'border-accent bg-achtergrond text-accent'
                    : 'border-rand bg-achtergrond text-tekst-zacht')
              }
            >
              {klaar ? <Check className="size-5" strokeWidth={3} /> : nummer}
            </span>
          );
          const inhoud = (
            <>
              {rondje}
              <span className={actief ? 'font-semibold' : ''}>
                {naam}
                {klaar && <span className="sr-only"> ({nl.componenten.stapKlaar})</span>}
              </span>
            </>
          );
          return (
            <li key={naam} className="flex items-center gap-2" aria-current={actief ? 'step' : undefined}>
              {index > 0 && <span aria-hidden="true" className="h-0.5 w-8 bg-rand" />}
              {opKies && klaar ? (
                <button
                  type="button"
                  onClick={() => opKies(nummer)}
                  className="flex min-h-12 items-center gap-2 rounded-knop px-2 hover:bg-vlak"
                >
                  {inhoud}
                </button>
              ) : (
                <span className="flex min-h-12 items-center gap-2 px-2">{inhoud}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
