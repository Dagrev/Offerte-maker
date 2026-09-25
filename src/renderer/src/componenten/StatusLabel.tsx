import type { Status } from '@shared/types';
import { nl } from '../teksten/nl';

// Witte tekst op de statuskleur (TDO §13.2); elk paar haalt ≥ 4,5:1.
const kleur: Record<Status, string> = {
  concept: 'bg-status-concept',
  klaar: 'bg-status-klaar',
  verstuurd: 'bg-status-verstuurd',
  akkoord: 'bg-status-akkoord',
  afgewezen: 'bg-status-afgewezen',
};

export function StatusLabel({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-semibold whitespace-nowrap text-white ${kleur[status]}`}
    >
      {nl.componenten.status[status]}
    </span>
  );
}
