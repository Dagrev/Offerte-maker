import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Resultaat } from '@shared/fouten';
import { FOUTMELDINGEN } from '@shared/teksten/fouten';
import { queryKeys } from '../api/queryKeys';
import { Knop } from '../componenten/Knop';
import { formatVerstreken, lopendeAgentTaak, startAgentTaak, type AgentTaak } from '../stores/agentTaken';
import { useNavigatie, type Bezig as BezigTaak } from '../stores/navigatie';
import { nl } from '../teksten/nl';

// Bezig-scherm (FO S3, TDO §13.4, V-07, V-23). Wacht op de agenttaak voor `bezig.id`, toont de
// verstreken tijd uit `offerte:voortgang` en heeft alleen de knop Stoppen: de rest van de app is
// intussen niet te bedienen. Na afloop kiest `bezigKlaar` het vervolgscherm, voor alle soorten.

const ONBEKEND: Resultaat<never> = { ok: false, fout: { code: 'ONBEKEND', melding: FOUTMELDINGEN.ONBEKEND } };

function taakVoor(bezig: BezigTaak): AgentTaak {
  const bestaand = lopendeAgentTaak(bezig.id);
  if (bestaand) return bestaand;
  switch (bezig.soort) {
    case 'maken':
      return startAgentTaak(bezig, () => window.api.offerteMaak({ id: bezig.id }));
    case 'zonder_claude':
      return startAgentTaak(bezig, () => window.api.offerteMaakZonderClaude({ id: bezig.id }));
    default:
      // Aanpassen en teksten-uit-template hebben eigen invoer; het startscherm registreert die taak.
      return { belofte: Promise.resolve(ONBEKEND) };
  }
}

export function Bezig() {
  const bezig = useNavigatie((s) => s.bezig);
  const bezigKlaar = useNavigatie((s) => s.bezigKlaar);
  const queryClient = useQueryClient();
  const [verstrekenS, setVerstrekenS] = useState(0);
  const [stoppen, setStoppen] = useState(false);

  useEffect(() => {
    if (!bezig) return;
    let actief = true;
    const afmelden = window.api.opVoortgang((v) => {
      if (actief && v.id === bezig.id) setVerstrekenS(v.verstrekenS);
    });
    const taak = taakVoor(bezig);
    void taak.belofte
      .catch(() => ONBEKEND)
      .then(async (resultaat) => {
        if (!actief) return;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.offerte(bezig.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.overzicht() }),
        ]);
        if (!actief) return;
        if (resultaat.ok) {
          taak.bijSucces?.(resultaat.data);
          bezigKlaar();
        } else {
          bezigKlaar(resultaat.fout);
        }
      });
    return () => {
      actief = false;
      afmelden();
    };
  }, [bezig, bezigKlaar, queryClient]);

  if (!bezig) return null;

  const stop = () => {
    setStoppen(true);
    void window.api.offerteStop({ id: bezig.id });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-10 text-center">
      <LoaderCircle
        aria-hidden="true"
        className="size-20 animate-spin text-accent motion-reduce:animate-none"
      />
      <div className="flex flex-col gap-3" role="status" aria-live="polite">
        <h1 className="text-3xl font-semibold">{nl.bezig.kop[bezig.soort]}</h1>
        <p className="text-xl text-tekst-zacht">{nl.bezig.duur}</p>
        <p className="text-xl tabular-nums">{nl.bezig.verstreken(formatVerstreken(verstrekenS))}</p>
      </div>
      <Knop
        label={stoppen ? nl.bezig.bezigMetStoppen : nl.bezig.stoppen}
        icoon={Square}
        disabled={stoppen}
        onClick={stop}
      />
    </main>
  );
}
