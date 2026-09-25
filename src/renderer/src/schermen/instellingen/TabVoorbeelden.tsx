import { useState, type DragEvent } from 'react';
import { FilePlus2, Star, Trash2 } from 'lucide-react';
import type { Fout, FoutCode } from '@shared/fouten';
import { formatDatum, schrijfDatum } from '@shared/formatteer';
import { FOUTMELDINGEN } from '@shared/teksten/fouten';
import type { VoorbeeldItem } from '@shared/types';
import { alsFout } from '../../api/roep';
import { useVoorbeelden, verwijderVoorbeeld, voegVoorbeeldenToe } from '../../api/voorbeelden';
import { Bevestiging } from '../../componenten/Bevestiging';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { nl } from '../../teksten/nl';
import { VoorbeeldReview } from './VoorbeeldReview';

const t = nl.voorbeelden;

interface Uitkomst {
  toegevoegd: number;
  fouten: { bestandsnaam: string; code: FoutCode }[];
}

/**
 * Tab Voorbeelden (FO UC-13, FE-080 t/m 083, FE-085). Werkt zonder props, zodat het welkomstscherm
 * (OFM-023) hem als stap 3 kan tonen. De review opent binnen de tab.
 */
export function TabVoorbeelden() {
  const lijst = useVoorbeelden();
  const [open, setOpen] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [slepen, setSlepen] = useState(false);
  const [uitkomst, setUitkomst] = useState<Uitkomst | null>(null);
  const [fout, setFout] = useState<Fout | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<VoorbeeldItem | null>(null);

  const voegToe = async (paden?: string[]) => {
    setBezig(true);
    setFout(null);
    setUitkomst(null);
    try {
      const uit = await voegVoorbeeldenToe(paden);
      setUitkomst({ toegevoegd: uit.toegevoegd.length, fouten: uit.fouten });
      // UC-13 stap 2: na toevoegen meteen het (eerste) nieuwe voorbeeld laten controleren.
      if (uit.toegevoegd[0]) setOpen(uit.toegevoegd[0]);
    } catch (e) {
      setFout(alsFout(e));
    } finally {
      setBezig(false);
    }
  };

  const opSleepOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setSlepen(true);
  };
  const opLoslaten = (e: DragEvent) => {
    e.preventDefault();
    setSlepen(false);
    if (bezig) return;
    const paden = Array.from(e.dataTransfer.files)
      .map((bestand) => window.api.padVanBestand(bestand))
      .filter((pad) => pad !== '');
    // Een lege lijst zou in main de bestandsdialoog openen; dan liever niets doen.
    if (paden.length > 0) void voegToe(paden);
  };

  /**
   * Na goedkeuren door naar het volgende voorbeeld dat nog gecontroleerd moet worden. Is er geen,
   * dan blijft de review open, zodat **Gebruik als template** meteen kan.
   */
  const naGoedkeuren = (id: string) => {
    const volgende = lijst.data?.find((v) => v.id !== id && v.status === 'te_controleren');
    if (volgende) setOpen(volgende.id);
  };

  return (
    <section
      aria-label={nl.instellingen.tab.voorbeelden}
      onDragOver={opSleepOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSlepen(false);
      }}
      onDrop={opLoslaten}
      className={`relative flex flex-col gap-6 rounded-knop ${slepen ? 'outline-3 outline-dashed outline-accent' : ''}`}
    >
      {slepen && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-knop bg-achtergrond/90 text-2xl font-semibold text-accent"
        >
          {t.sleepLos}
        </div>
      )}

      {open ? (
        <VoorbeeldReview key={open} id={open} opTerug={() => setOpen(null)} opGoedgekeurd={naGoedkeuren} />
      ) : (
        <>
          <p className="max-w-3xl text-tekst-zacht">{t.uitleg}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Knop
              label={t.toevoegen}
              icoon={FilePlus2}
              variant="hoofd"
              disabled={bezig}
              onClick={() => void voegToe()}
            />
            <p className="text-tekst-zacht">{t.sleepHint}</p>
          </div>

          <div aria-live="polite" className="flex flex-col gap-3">
            {bezig && <p role="status">{t.bezigToevoegen}</p>}
            {uitkomst && uitkomst.toegevoegd > 0 && <p>{t.toegevoegd(uitkomst.toegevoegd)}</p>}
          </div>
          {uitkomst && uitkomst.fouten.length > 0 && <BestandFouten fouten={uitkomst.fouten} />}
          {fout && <Foutmelding fout={fout} />}

          {lijst.isError ? (
            <Foutmelding fout={alsFout(lijst.error)} opnieuw={() => void lijst.refetch()} />
          ) : !lijst.data ? (
            <p role="status">{nl.algemeen.laden}</p>
          ) : lijst.data.length === 0 ? (
            <p className="text-tekst-zacht">{t.leeg}</p>
          ) : (
            <ul aria-label={t.lijstLabel} className="flex flex-col divide-y divide-rand border-y border-rand">
              {lijst.data.map((v) => (
                <VoorbeeldRij
                  key={v.id}
                  voorbeeld={v}
                  opBekijk={() => setOpen(v.id)}
                  opVerwijder={() => setTeVerwijderen(v)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <Bevestiging
        open={teVerwijderen !== null}
        titel={t.verwijderTitel}
        bevestigLabel={t.verwijderJa}
        annuleerLabel={t.verwijderNee}
        gevaar
        opAnnuleer={() => setTeVerwijderen(null)}
        opBevestig={() => {
          const v = teVerwijderen;
          setTeVerwijderen(null);
          if (v) verwijderVoorbeeld(v.id).catch((e: unknown) => setFout(alsFout(e)));
        }}
      >
        <p>{teVerwijderen && t.verwijderTekst(teVerwijderen.bestandsnaam)}</p>
      </Bevestiging>
    </section>
  );
}

function BestandFouten({ fouten }: { fouten: Uitkomst['fouten'] }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-knop border-2 border-fout bg-fout-vlak p-5">
      <p className="font-semibold text-fout-donker">{t.nietToegevoegd}</p>
      <ul className="list-disc pl-6 text-fout-donker">
        {fouten.map((f, i) => (
          <li key={`${f.bestandsnaam}-${i}`}>{t.foutBijBestand(f.bestandsnaam, FOUTMELDINGEN[f.code])}</li>
        ))}
      </ul>
    </div>
  );
}

function VoorbeeldRij({
  voorbeeld,
  opBekijk,
  opVerwijder,
}: {
  voorbeeld: VoorbeeldItem;
  opBekijk: () => void;
  opVerwijder: () => void;
}) {
  const nogControleren = voorbeeld.status === 'te_controleren';
  return (
    <li className="flex flex-wrap items-center gap-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-lg font-semibold">{voorbeeld.bestandsnaam}</span>
        <span className="text-tekst-zacht">
          {t.toegevoegdOp(formatDatum(schrijfDatum(new Date(voorbeeld.aangemaaktOp))))}
        </span>
      </div>
      {voorbeeld.isTemplate && (
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 font-semibold text-white">
          <Star aria-hidden="true" className="size-4" />
          {t.template}
        </span>
      )}
      <span
        className={
          'inline-flex items-center rounded-full border-2 px-3 py-1 font-semibold whitespace-nowrap ' +
          (nogControleren
            ? 'border-waarschuwing-rand bg-waarschuwing-vlak text-waarschuwing'
            : 'border-goed text-goed')
        }
      >
        {t.status[voorbeeld.status]}
      </span>
      <Knop
        label={t.bekijk}
        aria-label={t.bekijkLabel(voorbeeld.bestandsnaam)}
        variant="secundair"
        onClick={opBekijk}
      />
      <Knop label={t.verwijder(voorbeeld.bestandsnaam)} alleenIcoon icoon={Trash2} onClick={opVerwijder} />
    </li>
  );
}
