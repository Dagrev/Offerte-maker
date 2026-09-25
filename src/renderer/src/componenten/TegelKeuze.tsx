import { Check, type LucideIcon } from 'lucide-react';
import { nl } from '../teksten/nl';

export interface TegelOptie<T extends string> {
  waarde: T;
  label: string;
  icoon: LucideIcon;
}

export interface TegelKeuzeProps<T extends string> {
  /** Vraag boven de tegels (legend). */
  label: string;
  opties: readonly TegelOptie<T>[];
  waarde: T | null;
  opKies: (waarde: T) => void;
  hint?: string;
}

/**
 * Keuze uit grote tegels (TDO §13.2): minimaal 160 × 96 px met icoon en label; gekozen tegel heeft
 * een accentrand van 3 px en een vinkje. Elke tegel is een echte knop met `aria-pressed`.
 */
export function TegelKeuze<T extends string>({ label, opties, waarde, opKies, hint }: TegelKeuzeProps<T>) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 font-semibold">{label}</legend>
      {hint && <p className="text-tekst-zacht">{hint}</p>}
      <div className="flex flex-wrap gap-4">
        {opties.map(({ waarde: optie, label: optieLabel, icoon: Icoon }) => {
          const gekozen = optie === waarde;
          return (
            <button
              key={optie}
              type="button"
              aria-pressed={gekozen}
              onClick={() => opKies(optie)}
              className={
                'relative flex min-h-24 min-w-40 flex-col items-center justify-center gap-2 ' +
                'rounded-knop bg-achtergrond px-4 py-3 text-center font-semibold ' +
                (gekozen
                  ? 'border-3 border-accent text-accent'
                  : 'border-2 border-rand text-tekst hover:border-accent')
              }
            >
              <Icoon aria-hidden="true" className="size-8" />
              <span>{optieLabel}</span>
              {gekozen && (
                <span className="absolute top-1.5 right-1.5 rounded-full bg-accent p-0.5 text-white">
                  <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                  <span className="sr-only">{nl.componenten.gekozen}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
