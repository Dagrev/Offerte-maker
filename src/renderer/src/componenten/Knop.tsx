import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

export type KnopVariant = 'hoofd' | 'secundair' | 'gevaar';

export interface KnopProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Zichtbare tekst (uit `teksten/`); bij `alleenIcoon` het toegankelijke label. */
  label: string;
  variant?: KnopVariant;
  icoon?: LucideIcon;
  /** Alleen het icoon tonen (minimaal 48 × 48 px); `label` wordt dan `aria-label` en tooltip. */
  alleenIcoon?: boolean;
  /** Over de volle breedte van de ouder. */
  breed?: boolean;
}

const basis =
  'inline-flex shrink-0 items-center justify-center gap-3 rounded-knop border-2 font-semibold ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const varianten: Record<KnopVariant, string> = {
  // Hoofdknop: 72 px hoog, één per scherm (FO §3).
  hoofd:
    'min-h-[72px] text-xl border-accent bg-accent text-white hover:enabled:bg-accent-donker ' +
    'hover:enabled:border-accent-donker',
  secundair: 'min-h-14 border-accent bg-achtergrond text-accent hover:enabled:bg-vlak',
  gevaar:
    'min-h-14 border-fout bg-fout text-white hover:enabled:bg-fout-donker ' +
    'hover:enabled:border-fout-donker',
};

/** Knop (TDO §13.2/§13.3): ≥ 56 px hoog (hoofdknop 72 px), radius 10 px, focusring 3 px. */
export function Knop({
  label,
  variant = 'secundair',
  icoon: Icoon,
  alleenIcoon = false,
  breed = false,
  type = 'button',
  className = '',
  ...rest
}: KnopProps) {
  const maat = alleenIcoon ? 'min-w-14 px-2' : variant === 'hoofd' ? 'px-8' : 'px-6';
  const klassen = [basis, varianten[variant], maat, breed ? 'w-full' : '', className].join(' ');
  return (
    <button
      type={type}
      className={klassen}
      aria-label={alleenIcoon ? label : undefined}
      title={alleenIcoon ? label : undefined}
      {...rest}
    >
      {Icoon && <Icoon aria-hidden="true" className="size-6 shrink-0" />}
      {!alleenIcoon && <span>{label}</span>}
    </button>
  );
}
