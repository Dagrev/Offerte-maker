import { XCircle } from 'lucide-react';
import { FOUT_ACTIE, type Fout, type FoutActie } from '@shared/fouten';
import { useNavigatie } from '../stores/navigatie';
import { nl } from '../teksten/nl';
import { Knop } from './Knop';

export interface FoutmeldingProps {
  /** Uit `Resultaat.fout`, of via `alsFout(error)` uit een react-query-fout. */
  fout: Fout;
  /**
   * Handelingen die van de context afhangen (§15.1): "Probeer opnieuw", "Opnieuw" en "Opnieuw
   * inloggen". Zonder handler verschijnt die knop niet.
   */
  opnieuw?: () => void;
  opnieuwInloggen?: () => void;
}

/**
 * Rode kaart met icoon, de melding uit main en een eventuele actieknop (TDO §13.1, §15.1).
 * "Naar Claude-koppeling" en "Naar Overig" navigeren zelf via de store.
 */
export function Foutmelding({ fout, opnieuw, opnieuwInloggen }: FoutmeldingProps) {
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const offerteId = useNavigatie((s) => s.offerteId);

  const handelingen: Record<FoutActie, (() => void) | undefined> = {
    naarClaudeKoppeling: () => gaNaar({ scherm: 'instellingen', instellingenTab: 'claudeKoppeling' }),
    naarOverig: offerteId ? () => gaNaar({ scherm: 'wizard', offerteId, wizardStap: 4 }) : undefined,
    opnieuwInloggen,
    probeerOpnieuw: opnieuw,
    opnieuw,
  };
  const actie = FOUT_ACTIE[fout.code];
  const handeling = actie ? handelingen[actie] : undefined;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-4 rounded-knop border-2 border-fout bg-fout-vlak p-5"
    >
      <XCircle aria-hidden="true" className="size-8 shrink-0 text-fout" />
      <p className="min-w-0 flex-1 font-semibold text-fout-donker">{fout.melding}</p>
      {actie && handeling && <Knop label={nl.componenten.foutActie[actie]} onClick={handeling} />}
    </div>
  );
}
