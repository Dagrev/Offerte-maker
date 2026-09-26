import { useId, useState, type ReactNode } from 'react';

export interface TooltipProps {
  /** Regels in de tooltip; leeg = geen tooltip (en geen `aria-describedby`). */
  regels: readonly string[];
  /** Het element waar de tooltip bij hoort; zet `aria-describedby` op het focusbare element. */
  children: (koppeling: { 'aria-describedby': string | undefined }) => ReactNode;
}

/**
 * Kleine tooltip (OFM-042, geen pakket, V-03): verschijnt bij hover en bij toetsenbordfocus, verdwijnt
 * bij Escape (tot de muis of focus weg is geweest) en is via `aria-describedby` aan het element
 * gekoppeld, zodat een schermlezer de regels ook voorleest.
 */
export function Tooltip({ regels, children }: TooltipProps) {
  const id = useId();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [weggedrukt, setWeggedrukt] = useState(false);
  const heeftInhoud = regels.length > 0;
  const open = heeftInhoud && (hover || focus) && !weggedrukt;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setWeggedrukt(false);
      }}
      onFocus={() => setFocus(true)}
      onBlur={() => {
        setFocus(false);
        setWeggedrukt(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setWeggedrukt(true);
        }
      }}
    >
      {children({ 'aria-describedby': heeftInhoud ? id : undefined })}
      {heeftInhoud && (
        <span
          role="tooltip"
          id={id}
          hidden={!open}
          className="absolute top-full left-0 z-20 mt-2 w-max max-w-sm rounded-knop border border-rand bg-achtergrond p-3 text-base text-tekst shadow-lg"
        >
          {regels.map((regel) => (
            <span key={regel} className="block">
              {regel}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
