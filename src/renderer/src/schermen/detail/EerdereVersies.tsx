import { RotateCcw } from 'lucide-react';
import type { OfferteDetail } from '@shared/types';
import { useZetVersieTerug } from '../../api/offerte';
import { alsFout } from '../../api/roep';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { nl } from '../../teksten/nl';

// Eerdere versies (FE-053, OFM-017): alle versies behalve de huidige (de nieuwste), met Terugzetten.
// Terugzetten maakt een nieuwe versie met de inhoud van de gekozen versie; er gaat niets verloren.

const t = nl.detail;

/** Opgeslagen tijdstip (ISO) in lokale tijd, bijv. "25-09-2026 14:32". */
function tijdstip(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
}

export function EerdereVersies({ id, versies }: { id: string; versies: OfferteDetail['versies'] }) {
  const terug = useZetVersieTerug(id);
  // `versies` is nieuwste eerst (OFM-010); de eerste is de huidige.
  const eerdere = versies.slice(1);
  if (eerdere.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{t.eerdereVersies}</h2>
      {terug.isError && <Foutmelding fout={alsFout(terug.error)} />}
      <ul className="flex flex-col gap-2">
        {eerdere.map((v) => (
          <li key={v.id} className="flex flex-col gap-2 rounded-knop border border-rand p-3">
            <div>
              <p className="font-semibold">{t.versie(v.versieNr)}</p>
              <p className="text-tekst-zacht">
                {t.versieBron[v.bron] ?? v.bron} · {tijdstip(v.aangemaaktOp)}
              </p>
            </div>
            <Knop
              label={t.terugzetten}
              aria-label={t.terugzettenVersie(v.versieNr)}
              icoon={RotateCcw}
              disabled={terug.isPending}
              onClick={() => terug.mutate(v.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
