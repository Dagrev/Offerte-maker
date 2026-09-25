import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { FOUT_CODES, type FoutCode } from '@shared/fouten';
import { FOUTMELDINGEN } from '@shared/teksten/fouten';
import type { PrivacylogItem } from '@shared/types';
import { usePrivacylogLijst, usePrivacylogRegel } from '../../api/privacylog';
import { alsFout } from '../../api/roep';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Kaart } from '../../componenten/Kaart';
import { Knop } from '../../componenten/Knop';
import { nl } from '../../teksten/nl';

// Geavanceerd › Wat is naar Claude gestuurd (FO UC-15, TDO V-18, V-27). Eigenaar: OFM-021.

const t = nl.privacylog;
const LIMIET = 500; // gelijk aan PRIVACYLOG_LIMIET in main (V-18)
const KOLOMMEN = 'grid grid-cols-[11rem_9rem_14rem_minmax(0,1fr)] items-center gap-4';

/** Lokale datum en tijd van een ISO-tijdstip (alleen weergave). */
function tijd(iso: string): string {
  return format(new Date(iso), 'dd-MM-yyyy HH:mm');
}

function offerteKolom(item: PrivacylogItem): string {
  if (item.soort === 'test' || item.soort === 'template_teksten') return t.geenOfferte;
  return item.offerteNummer ?? t.concept;
}

function resultaatTekst(item: PrivacylogItem): string {
  if (item.resultaat === 'ok') return t.gelukt;
  if (item.resultaat === 'afgebroken') return t.gestopt;
  const code = (FOUT_CODES as readonly string[]).includes(item.foutcode ?? '')
    ? (item.foutcode as FoutCode)
    : 'ONBEKEND';
  return t.mislukt(FOUTMELDINGEN[code]);
}

export function Privacylog() {
  const [open, setOpen] = useState<PrivacylogItem | null>(null);
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">{t.titel}</h2>
      {open ? <Detail item={open} opTerug={() => setOpen(null)} /> : <Lijst opOpen={setOpen} />}
    </section>
  );
}

function Lijst({ opOpen }: { opOpen: (item: PrivacylogItem) => void }) {
  const lijst = usePrivacylogLijst();
  if (lijst.isError) return <Foutmelding fout={alsFout(lijst.error)} opnieuw={() => void lijst.refetch()} />;
  if (!lijst.data) return <p role="status">{nl.algemeen.laden}</p>;

  return (
    <>
      <p className="max-w-4xl text-tekst-zacht">{t.uitleg}</p>
      {lijst.data.length === 0 ? (
        <p className="rounded-knop bg-vlak p-8 text-center">{t.leeg}</p>
      ) : (
        <div className="flex flex-col">
          <div aria-hidden="true" className={`${KOLOMMEN} border-b-2 border-rand px-4 pb-2 font-semibold`}>
            <span>{t.kolommen.tijdstip}</span>
            <span>{t.kolommen.offerte}</span>
            <span>{t.kolommen.soort}</span>
            <span>{t.kolommen.resultaat}</span>
          </div>
          <ul className="flex flex-col divide-y divide-rand">
            {lijst.data.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => opOpen(item)}
                  aria-label={t.openen(tijd(item.tijdstip), t.soort[item.soort])}
                  className={`${KOLOMMEN} min-h-14 w-full rounded-knop px-4 py-3 text-left hover:bg-vlak`}
                >
                  <span className="tabular-nums">{tijd(item.tijdstip)}</span>
                  <span className="tabular-nums">{offerteKolom(item)}</span>
                  <span>{t.soort[item.soort]}</span>
                  <span className={item.resultaat === 'fout' ? 'text-fout' : ''}>{resultaatTekst(item)}</span>
                </button>
              </li>
            ))}
          </ul>
          {lijst.data.length >= LIMIET && <p className="mt-3 text-tekst-zacht">{t.limiet(LIMIET)}</p>}
        </div>
      )}
    </>
  );
}

function Detail({ item, opTerug }: { item: PrivacylogItem; opTerug: () => void }) {
  const regel = usePrivacylogRegel(item.id);
  return (
    <>
      <div className="flex flex-wrap items-center gap-6">
        <Knop label={t.terug} icoon={ArrowLeft} onClick={opTerug} autoFocus />
        <p className="font-semibold">
          {tijd(item.tijdstip)} · {offerteKolom(item)} · {t.soort[item.soort]} · {resultaatTekst(item)}
        </p>
      </div>
      {regel.isError && <Foutmelding fout={alsFout(regel.error)} opnieuw={() => void regel.refetch()} />}
      {!regel.data && !regel.isError && <p role="status">{nl.algemeen.laden}</p>}
      {regel.data && (
        <>
          <Tekstblok titel={t.verstuurd} tekst={regel.data.opdracht} />
          <Tekstblok titel={t.antwoord} tekst={regel.data.antwoord} />
        </>
      )}
    </>
  );
}

/** Platte tekst, regeleinden behouden, vaste-breedteletter; nooit als HTML (V-18). */
function Tekstblok({ titel, tekst }: { titel: string; tekst: string | null }) {
  return (
    <Kaart titel={titel}>
      {tekst === null ? (
        <p className="text-tekst-zacht">{t.geenAntwoord}</p>
      ) : (
        <pre
          tabIndex={0}
          className="max-h-[32rem] overflow-auto rounded-md bg-vlak p-4 font-mono text-base break-words whitespace-pre-wrap"
        >
          {tekst}
        </pre>
      )}
    </Kaart>
  );
}
