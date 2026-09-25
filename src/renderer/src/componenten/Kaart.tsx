import type { HTMLAttributes, ReactNode } from 'react';

export interface KaartProps extends HTMLAttributes<HTMLElement> {
  titel?: string;
  /** Kaart op het grijze vlak in plaats van wit. */
  vlak?: boolean;
  children?: ReactNode;
}

/** Omlijst blok met optionele titel. */
export function Kaart({ titel, vlak = false, className = '', children, ...rest }: KaartProps) {
  return (
    <section
      {...rest}
      className={
        `flex flex-col gap-4 rounded-knop border border-rand p-6 ` +
        `${vlak ? 'bg-vlak' : 'bg-achtergrond'} ${className}`
      }
    >
      {titel && <h2 className="text-xl font-semibold">{titel}</h2>}
      {children}
    </section>
  );
}
