import { Check } from 'lucide-react';
import { nl } from '../teksten/nl';
import type { StapMarkering } from './stapMarkering';
import { Tooltip } from './Tooltip';

export interface StappenbalkProps {
  /** Namen van de stappen, in volgorde. */
  stappen: readonly string[];
  /** Huidige stap, vanaf 1. */
  huidig: number;
  /** Optioneel: naar een andere stap springen. Zonder `vrij` alleen naar eerdere stappen. */
  opKies?: (stap: number) => void;
  /** Elke stap is klikbaar, ook latere (wizard, OFM-035). */
  vrij?: boolean;
  /**
   * Per stap (index 0 = stap 1) de punten die nog niet in orde zijn; `aantal` > 0 geeft een oranje
   * markering met dat aantal, `punten` staan in de tooltip bij hover en focus (OFM-035, OFM-042).
   */
  markeringen?: readonly StapMarkering[];
}

/** Genummerde stappen bovenaan de wizard; de huidige stap heeft `aria-current="step"`. */
export function Stappenbalk({ stappen, huidig, opKies, vrij = false, markeringen }: StappenbalkProps) {
  return (
    <nav aria-label={nl.componenten.stappen}>
      <p className="sr-only">{nl.componenten.stap(huidig, stappen.length)}</p>
      <ol className="flex flex-wrap items-center gap-2">
        {stappen.map((naam, index) => {
          const nummer = index + 1;
          const markering = markeringen?.[index];
          const punten = markering?.aantal ?? 0;
          const uitleg = punten > 0 ? (markering?.punten ?? []) : [];
          const klaar = nummer < huidig && punten === 0;
          const actief = nummer === huidig;
          // De huidige stap is ook een knop als hij een markering heeft: dan is de uitleg met het
          // toetsenbord te bereiken (OFM-042); klikken blijft op dezelfde stap.
          const klikbaar = opKies !== undefined && (actief ? uitleg.length > 0 : vrij || nummer < huidig);
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
              {punten > 0 && (
                <span className="rounded-full border-2 border-status-verstuurd bg-schatting-vlak px-2.5 py-0.5 text-base font-semibold text-tekst">
                  <span aria-hidden="true">{punten}</span>
                  <span className="sr-only">{nl.componenten.stapPunten(punten)}</span>
                </span>
              )}
            </>
          );
          return (
            <li key={naam} className="flex items-center gap-2" aria-current={actief ? 'step' : undefined}>
              {index > 0 && <span aria-hidden="true" className="h-0.5 w-8 bg-rand" />}
              <Tooltip regels={uitleg}>
                {(koppeling) =>
                  klikbaar ? (
                    <button
                      type="button"
                      onClick={() => opKies(nummer)}
                      className="flex min-h-12 items-center gap-2 rounded-knop px-2 hover:bg-vlak"
                      {...koppeling}
                    >
                      {inhoud}
                    </button>
                  ) : (
                    <span className="flex min-h-12 items-center gap-2 px-2">{inhoud}</span>
                  )
                }
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
