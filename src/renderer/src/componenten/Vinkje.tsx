import { useId, type InputHTMLAttributes } from 'react';

export type VinkjeProps = {
  label: string;
  hint?: string;
  aan: boolean;
  opWijzig: (aan: boolean) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange' | 'id'>;

/** Aanvinkvak met label; het hele label is klikbaar en minimaal 48 px hoog (NFE-005). */
export function Vinkje({ label, hint, aan, opWijzig, className = '', ...rest }: VinkjeProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="inline-flex min-h-12 cursor-pointer items-center gap-4 self-start pr-2">
        <input
          {...rest}
          id={id}
          type="checkbox"
          className={`size-7 shrink-0 cursor-pointer accent-accent ${className}`}
          checked={aan}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => opWijzig(e.target.checked)}
        />
        <span>{label}</span>
      </label>
      {hint && (
        <p id={hintId} className="pl-11 text-tekst-zacht">
          {hint}
        </p>
      )}
    </div>
  );
}
