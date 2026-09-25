import type { ClaudeStatus } from '@shared/types';
import { nl } from '../teksten/nl';

export interface ClaudeBolletjeProps {
  /** Uitkomst van `claude:status`; `null` zolang die nog niet bekend is. Koppeling: OFM-020. */
  status: ClaudeStatus | null;
  /** Optioneel: klikken opent bijv. de Claude-koppeling. Zonder handler is het geen knop. */
  opKlik?: () => void;
}

/**
 * Bolletje rechtsboven op het hoofdscherm: groen = gekoppeld, rood = niet gekoppeld, grijs =
 * onbekend. De kleur staat nooit alleen: de tekst "Claude" staat erbij en de volledige toestand is
 * de toegankelijke naam en tooltip.
 */
export function ClaudeBolletje({ status, opKlik }: ClaudeBolletjeProps) {
  const t = nl.componenten.claude;
  const [kleur, omschrijving] =
    status === null
      ? ['bg-status-concept', t.onbekend]
      : status.toestand === 'gekoppeld'
        ? ['bg-goed', t.gekoppeld]
        : ['bg-fout', t.nietGekoppeld];

  const inhoud = (
    <>
      <span aria-hidden="true" className={`size-4 shrink-0 rounded-full ${kleur}`} />
      <span aria-hidden="true">{t.kort}</span>
    </>
  );
  const klassen =
    'inline-flex min-h-12 min-w-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-knop px-3 font-semibold';

  if (opKlik) {
    return (
      <button
        type="button"
        onClick={opKlik}
        aria-label={omschrijving}
        title={omschrijving}
        className={`${klassen} hover:bg-vlak`}
      >
        {inhoud}
      </button>
    );
  }
  return (
    <span role="img" aria-label={omschrijving} title={omschrijving} className={klassen}>
      {inhoud}
    </span>
  );
}
