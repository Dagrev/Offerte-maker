import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';

/** Gedeelde klassen voor een groot invoerveld (NFE-005). */
export const invoerKlassen =
  'w-full min-h-14 rounded-knop border-2 border-rand bg-achtergrond px-4 py-3 text-tekst ' +
  'aria-[invalid=true]:border-fout disabled:bg-vlak';

export interface VeldMeldingen {
  label: string;
  hint?: string;
  /** Geel: mag door, maar let op (FE-024). */
  waarschuwing?: string;
  /** Rood: blokkeert (FE-024). Heeft voorrang op `waarschuwing`. */
  fout?: string;
}

interface OmlijstingProps extends VeldMeldingen {
  /** Rendert het invoerelement met de juiste `id` en `aria-*`-attributen. */
  children: (aria: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}

/**
 * Label boven, invoer, hint, en waarschuwing of fout eronder (TDO §13.3). Label is gekoppeld via
 * `htmlFor`, hint en melding via `aria-describedby`. Gedeeld door `Veld`, `GetalVeld` en `DatumVeld`.
 */
export function VeldOmlijsting({ label, hint, waarschuwing, fout, children }: OmlijstingProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const meldingId = `${id}-melding`;
  const melding = fout ?? waarschuwing;
  const beschreven = [hint ? hintId : null, melding ? meldingId : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {children({
        id,
        'aria-describedby': beschreven || undefined,
        'aria-invalid': fout ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-tekst-zacht">
          {hint}
        </p>
      )}
      {melding && (
        <p
          id={meldingId}
          className={
            fout
              ? 'flex items-start gap-2 font-semibold text-fout'
              : 'flex items-start gap-2 rounded-md bg-waarschuwing-vlak px-3 py-2 text-waarschuwing'
          }
        >
          {fout ? (
            <XCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          ) : (
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          )}
          <span>{melding}</span>
        </p>
      )}
    </div>
  );
}

type InvoerProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'id'> & {
  meerdereRegels?: false;
};
type TekstvakProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'id'> & {
  meerdereRegels: true;
};

export type VeldProps = VeldMeldingen & {
  waarde: string;
  opWijzig: (waarde: string) => void;
} & (InvoerProps | TekstvakProps);

/** Tekstveld of (met `meerdereRegels`) tekstvak. */
export function Veld({ label, hint, waarschuwing, fout, waarde, opWijzig, ...rest }: VeldProps) {
  return (
    <VeldOmlijsting label={label} hint={hint} waarschuwing={waarschuwing} fout={fout}>
      {(aria) => {
        if (rest.meerdereRegels) {
          const { meerdereRegels, className = '', ...tekstvak } = rest;
          void meerdereRegels; // alleen de keuze, geen HTML-attribuut
          return (
            <textarea
              {...tekstvak}
              {...aria}
              rows={tekstvak.rows ?? 4}
              className={`${invoerKlassen} ${className}`}
              value={waarde}
              onChange={(e) => opWijzig(e.target.value)}
            />
          );
        }
        const { meerdereRegels, className = '', type = 'text', ...invoer } = rest;
        void meerdereRegels;
        return (
          <input
            {...invoer}
            {...aria}
            type={type}
            className={`${invoerKlassen} ${className}`}
            value={waarde}
            onChange={(e) => opWijzig(e.target.value)}
          />
        );
      }}
    </VeldOmlijsting>
  );
}
