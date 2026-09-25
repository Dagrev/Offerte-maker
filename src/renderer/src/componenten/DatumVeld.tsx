import type { InputHTMLAttributes } from 'react';
import { invoerKlassen, VeldOmlijsting, type VeldMeldingen } from './Veld';

export type DatumVeldProps = VeldMeldingen & {
  /** `YYYY-MM-DD`, of `''` als er nog geen datum is. */
  waarde: string;
  opWijzig: (waarde: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'id'>;

/** Native `input type=date` (TDO §13.3); Chromium toont de kalender in de taal van het systeem. */
export function DatumVeld({
  label,
  hint,
  waarschuwing,
  fout,
  waarde,
  opWijzig,
  className = '',
  ...rest
}: DatumVeldProps) {
  return (
    <VeldOmlijsting label={label} hint={hint} waarschuwing={waarschuwing} fout={fout}>
      {(aria) => (
        <input
          {...rest}
          {...aria}
          type="date"
          className={`${invoerKlassen} max-w-xs ${className}`}
          value={waarde}
          onChange={(e) => opWijzig(e.target.value)}
        />
      )}
    </VeldOmlijsting>
  );
}
