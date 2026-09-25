import { useState, type InputHTMLAttributes } from 'react';
import { invoerKlassen, VeldOmlijsting, type VeldMeldingen } from './Veld';
import { leesGetal, schoonGetalInvoer, toonGetal } from './getalNotatie';

export type GetalVeldProps = VeldMeldingen & {
  waarde: number | null;
  opWijzig: (waarde: number | null) => void;
  /** Aantal decimalen na de komma; 0 = alleen hele getallen. Standaard 2. */
  decimalen?: number;
  /** Eenheid rechts naast het veld, bijv. "m²" (uit `teksten/`). */
  eenheid?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode' | 'id'>;

/** Getal met komma als decimaalteken, nooit negatief (TDO §13.3). */
export function GetalVeld({
  label,
  hint,
  waarschuwing,
  fout,
  waarde,
  opWijzig,
  decimalen = 2,
  eenheid,
  className = '',
  onBlur,
  ...rest
}: GetalVeldProps) {
  const [tekst, setTekst] = useState(() => toonGetal(waarde, decimalen));
  const [bekend, setBekend] = useState(waarde);

  // Waarde van buiten gewijzigd (bijv. teruggezet): tekst bijwerken tijdens het renderen.
  if (waarde !== bekend) {
    setBekend(waarde);
    if (leesGetal(tekst) !== waarde) setTekst(toonGetal(waarde, decimalen));
  }

  return (
    <VeldOmlijsting label={label} hint={hint} waarschuwing={waarschuwing} fout={fout}>
      {(aria) => (
        <div className="flex items-center gap-3">
          <input
            {...rest}
            {...aria}
            type="text"
            inputMode={decimalen > 0 ? 'decimal' : 'numeric'}
            autoComplete="off"
            className={`${invoerKlassen} text-right tabular-nums ${className}`}
            value={tekst}
            onChange={(e) => {
              const schoon = schoonGetalInvoer(e.target.value, decimalen);
              const getal = leesGetal(schoon);
              setTekst(schoon);
              setBekend(getal);
              opWijzig(getal);
            }}
            onBlur={(e) => {
              setTekst(toonGetal(leesGetal(tekst), decimalen));
              onBlur?.(e);
            }}
          />
          {eenheid && <span className="shrink-0 text-tekst-zacht">{eenheid}</span>}
        </div>
      )}
    </VeldOmlijsting>
  );
}
