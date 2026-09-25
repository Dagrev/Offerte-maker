import { Check } from 'lucide-react';
import type { Status } from '@shared/types';
import { useZetStatus } from '../../api/offerte';
import { alsFout } from '../../api/roep';
import { Foutmelding } from '../../componenten/Foutmelding';
import { nl } from '../../teksten/nl';

// Vijf grote statusknoppen (FO UC-08, FE-060, §13.2). Concept is alleen een aanduiding; de andere vier
// zijn te kiezen zodra de offerte definitief is. Een keuze wordt direct bewaard.

const t = nl.detail;
const STATUSSEN: Status[] = ['concept', 'klaar', 'verstuurd', 'akkoord', 'afgewezen'];

const gekozenKleur: Record<Status, string> = {
  concept: 'bg-status-concept border-status-concept',
  klaar: 'bg-status-klaar border-status-klaar',
  verstuurd: 'bg-status-verstuurd border-status-verstuurd',
  akkoord: 'bg-status-akkoord border-status-akkoord',
  afgewezen: 'bg-status-afgewezen border-status-afgewezen',
};
const randKleur: Record<Status, string> = {
  concept: 'border-status-concept text-status-concept',
  klaar: 'border-status-klaar text-status-klaar',
  verstuurd: 'border-status-verstuurd text-status-verstuurd',
  akkoord: 'border-status-akkoord text-status-akkoord',
  afgewezen: 'border-status-afgewezen text-status-afgewezen',
};

export function StatusKnoppen({
  id,
  status,
  definitief,
}: {
  id: string;
  status: Status;
  definitief: boolean;
}) {
  const zet = useZetStatus(id);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="status-kiezen">
      <h2 id="status-kiezen" className="font-semibold">
        {t.statusKiezen}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {STATUSSEN.map((s) => {
          const gekozen = s === status;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={gekozen}
              disabled={!definitief || s === 'concept' || zet.isPending}
              onClick={() => s !== 'concept' && !gekozen && zet.mutate(s)}
              className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-knop border-2 px-3 font-semibold disabled:cursor-not-allowed ${
                gekozen
                  ? `${gekozenKleur[s]} text-white`
                  : `${randKleur[s]} bg-achtergrond disabled:opacity-50`
              } ${s === 'concept' ? 'col-span-2' : ''}`}
            >
              {gekozen && <Check aria-hidden="true" className="size-5" />}
              {nl.componenten.status[s]}
            </button>
          );
        })}
      </div>
      {!definitief && <p className="text-tekst-zacht">{t.statusAlleenDefinitief}</p>}
      {zet.isError && <Foutmelding fout={alsFout(zet.error)} />}
    </section>
  );
}
