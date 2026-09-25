import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { nl } from '../teksten/nl';

export interface GeleBalkProps {
  /** Kop van de balk; standaard "Let op". */
  titel?: string;
  /** Punten om te controleren (FE-051, V-05). Een lege lijst toont niets. */
  punten?: readonly string[];
  children?: ReactNode;
}

/** Gele balk met punten die de gebruiker moet controleren. */
export function GeleBalk({ titel = nl.componenten.controleer, punten, children }: GeleBalkProps) {
  if (!children && (!punten || punten.length === 0)) return null;
  return (
    <section
      role="status"
      className="flex gap-4 rounded-knop border-2 border-waarschuwing-rand bg-waarschuwing-vlak p-5 text-waarschuwing"
    >
      <AlertTriangle aria-hidden="true" className="size-7 shrink-0" />
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">{titel}</h2>
        {punten && punten.length > 0 && (
          <ul className="list-disc space-y-1 pl-6">
            {punten.map((punt, i) => (
              <li key={i}>{punt}</li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </section>
  );
}
