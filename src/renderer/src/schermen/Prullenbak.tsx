import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { formatDatum, formatEuroHeel } from '@shared/formatteer';
import { usePrullenbak, useZetTerug } from '../api/offerte';
import { alsFout } from '../api/roep';
import { Foutmelding } from '../componenten/Foutmelding';
import { Knop } from '../componenten/Knop';
import { StatusLabel } from '../componenten/StatusLabel';
import { useNavigatie } from '../stores/navigatie';
import { nl } from '../teksten/nl';

// Prullenbak (FO UC-10, TDO §13.4, FE-062): verwijderde offertes met Terugzetten. Opschonen na 90 dagen
// gebeurt bij opstart (db/opschonen.ts). Geen `OfferteRij`: die is als geheel een knop, en een
// Terugzetten-knop mag daar niet in.

const t = nl.prullenbak;

export function Prullenbak() {
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const lijst = usePrullenbak();
  const terug = useZetTerug();
  const [melding, setMelding] = useState<string | null>(null);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-10">
      <div>
        <Knop
          label={t.terugNaarOverzicht}
          icoon={ArrowLeft}
          onClick={() => gaNaar({ scherm: 'overzicht' })}
        />
      </div>
      <h1 className="text-3xl font-semibold">{t.titel}</h1>
      <p>{t.uitleg}</p>

      {melding && (
        <p role="status" className="rounded-knop bg-vlak p-4 font-semibold text-goed">
          {melding}
        </p>
      )}
      {terug.isError && <Foutmelding fout={alsFout(terug.error)} />}
      {lijst.isError && <Foutmelding fout={alsFout(lijst.error)} opnieuw={() => void lijst.refetch()} />}
      {lijst.isPending && (
        <p role="status" className="text-tekst-zacht">
          {t.laden}
        </p>
      )}
      {lijst.data?.length === 0 && <p className="text-tekst-zacht">{t.leeg}</p>}

      {lijst.data && lijst.data.length > 0 && (
        <ul aria-label={t.titel} className="flex flex-col divide-y divide-rand">
          {lijst.data.map((o) => (
            <li
              key={o.id}
              className="grid grid-cols-[11rem_minmax(0,1.3fr)_minmax(0,1fr)_8rem_8rem_8.5rem_auto] items-center gap-4 py-3"
            >
              <span className={o.nummer ? 'font-semibold tabular-nums' : 'text-tekst-zacht'}>
                {o.nummer ?? t.concept}
              </span>
              <span className="truncate font-semibold">{o.klantWeergave}</span>
              <span className="truncate">{o.plaats}</span>
              <span className="tabular-nums">{formatDatum(o.offertedatum)}</span>
              <span className="text-right tabular-nums">
                {o.totaalInclCent === null ? t.nogNietGemaakt : formatEuroHeel(o.totaalInclCent)}
              </span>
              <span className="text-right">
                <StatusLabel status={o.status} />
              </span>
              <Knop
                label={t.terugzetten}
                aria-label={t.terugzettenVan(o.klantWeergave)}
                icoon={RotateCcw}
                disabled={terug.isPending}
                onClick={() =>
                  terug.mutate(o.id, { onSuccess: () => setMelding(t.teruggezet(o.klantWeergave)) })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
