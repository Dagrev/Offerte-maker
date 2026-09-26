import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Search, Settings, Trash2, X } from 'lucide-react';
import type { OfferteLijstItem } from '@shared/types';
import { formatEuroHeel } from '@shared/formatteer';
import { periodeVan, verschuif } from '@shared/periode';
import { useClaudeStatus } from '../api/claude';
import { useNieuweOfferte, useOverzicht, useZoekOffertes, type OverzichtFilter } from '../api/overzicht';
import { alsFout } from '../api/roep';
import { ClaudeBolletje } from '../componenten/ClaudeBolletje';
import { Foutmelding } from '../componenten/Foutmelding';
import { Knop } from '../componenten/Knop';
import { OfferteRij, offerteRijKolommen, type RijMenu } from '../componenten/OfferteRij';
import { PeriodeKiezer } from '../componenten/PeriodeKiezer';
import { useNavigatie, type Weergave } from '../stores/navigatie';
import { FILTER_STATUSSEN, ORDENINGEN, useOverzichtFilter } from '../stores/overzichtFilter';
import { nl } from '../teksten/nl';
import { BedrijfHint } from './BedrijfHint';
import { OfferteMenu } from './OfferteMenu';

// Hoofdscherm (FO S1, UC-02, UC-03; TDO §8.2, §13.4). Eigenaar: OFM-009. Contextmenu per rij: OFM-052.

/** Wat een rij in de lijst kan: openen (klik) en het contextmenu (OFM-052). */
interface RijActies {
  opKies: (o: OfferteLijstItem) => void;
  opMenu: (menu: RijMenu) => void;
}

const WEERGAVEN: Weergave[] = ['dag', 'week', 'maand', 'jaar'];
const ZOEK_DEBOUNCE_MS = 200;
const ZOEK_LIMIET = 200; // gelijk aan de limiet in main (§8.2)

const t = nl.overzicht;

export function Overzicht() {
  const weergave = useNavigatie((s) => s.weergave);
  const datum = useNavigatie((s) => s.datum);
  const vandaag = useNavigatie((s) => s.vandaag);
  const zetPeriode = useNavigatie((s) => s.zetPeriode);
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const claudeStatus = useClaudeStatus();
  const nieuw = useNieuweOfferte();

  const [kiezerOpen, setKiezerOpen] = useState(false);
  const [zoekInvoer, setZoekInvoer] = useState('');
  const [zoekTekst, setZoekTekst] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setZoekTekst(zoekInvoer.trim()), ZOEK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [zoekInvoer]);
  const zoekend = zoekTekst.length > 0;

  const openOfferte = (offerte: OfferteLijstItem) =>
    // Nog niet gemaakt (geen bedrag) → wizard op de opgeslagen stap (OFM-010); een gemaakt concept en
    // alle andere offertes → detailscherm (FO UC-02 stap 6), anders kan een gemaakt concept niet meer
    // definitief worden gemaakt zonder opnieuw te laten maken (OFM-027).
    offerte.status === 'concept' && offerte.totaalInclCent === null
      ? gaNaar({ scherm: 'wizard', offerteId: offerte.id })
      : gaNaar({ scherm: 'detail', offerteId: offerte.id });

  // OFM-052: één contextmenu tegelijk; elk nieuw menu krijgt een eigen `OfferteMenu` (key = nr), dat
  // na het sluiten blijft staan voor bevestigingen en foutmeldingen tot het volgende menu.
  const [menu, setMenu] = useState<{ nr: number; doel: RijMenu } | null>(null);
  const acties: RijActies = {
    opKies: openOfferte,
    opMenu: (doel) => setMenu((m) => ({ nr: (m?.nr ?? 0) + 1, doel })),
  };

  const maakNieuw = () =>
    nieuw.mutate(undefined, {
      onSuccess: ({ id }) => gaNaar({ scherm: 'wizard', offerteId: id, wizardStap: 1 }),
    });

  const opVandaag = periodeVan(weergave, datum).van === periodeVan(weergave, vandaag).van;

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-10 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{nl.algemeen.appNaam}</h1>
        <div className="flex items-center gap-3">
          <ClaudeBolletje
            status={claudeStatus}
            opKlik={() => gaNaar({ scherm: 'instellingen', instellingenTab: 'claudeKoppeling' })}
          />
          <Knop label={t.instellingen} icoon={Settings} onClick={() => gaNaar({ scherm: 'instellingen' })} />
        </div>
      </header>

      <BedrijfHint />

      <div>
        <Knop
          label={t.nieuweOfferte}
          variant="hoofd"
          icoon={Plus}
          onClick={maakNieuw}
          disabled={nieuw.isPending}
        />
      </div>
      {nieuw.isError && <Foutmelding fout={alsFout(nieuw.error)} opnieuw={maakNieuw} />}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label={t.weergaven} className="flex gap-2">
          {WEERGAVEN.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={w === weergave && !zoekend}
              onClick={() => {
                setZoekInvoer('');
                setZoekTekst('');
                zetPeriode({ weergave: w });
              }}
              className={
                'min-h-14 min-w-28 rounded-knop border-2 px-5 font-semibold ' +
                (w === weergave && !zoekend
                  ? 'border-accent bg-accent text-white'
                  : 'border-rand bg-achtergrond text-tekst hover:border-accent')
              }
            >
              {t.weergave[w]}
            </button>
          ))}
        </div>
        <ZoekVeld waarde={zoekInvoer} opWijzig={setZoekInvoer} />
      </div>

      <FilterBalk />

      {menu && <OfferteMenu key={menu.nr} menu={menu.doel} />}

      {zoekend ? (
        <Zoekresultaten tekst={zoekTekst} acties={acties} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Knop
              label={t.vorige}
              alleenIcoon
              icoon={ChevronLeft}
              onClick={() => zetPeriode({ datum: verschuif(weergave, datum, -1) })}
            />
            <h2 aria-live="polite" className="min-w-72 text-center text-xl font-semibold">
              {/* Klikbaar label opent de periodekiezer (OFM-037). */}
              <button
                type="button"
                aria-haspopup="dialog"
                title={t.kiesPeriode}
                onClick={() => setKiezerOpen(true)}
                className="min-h-14 w-full rounded-knop px-3 first-letter:uppercase hover:bg-vlak"
              >
                {periodeVan(weergave, datum).label}
              </button>
            </h2>
            <Knop
              label={t.volgende}
              alleenIcoon
              icoon={ChevronRight}
              onClick={() => zetPeriode({ datum: verschuif(weergave, datum, 1) })}
            />
            <Knop label={t.vandaag} onClick={() => zetPeriode({ datum: vandaag })} disabled={opVandaag} />
            <Knop
              label={t.kiesPeriode}
              alleenIcoon
              icoon={CalendarDays}
              aria-haspopup="dialog"
              onClick={() => setKiezerOpen(true)}
            />
            <PeriodeKiezer
              open={kiezerOpen}
              weergave={weergave}
              datum={datum}
              vandaag={vandaag}
              opKies={(gekozen) => {
                zetPeriode({ datum: gekozen });
                setKiezerOpen(false);
              }}
              opSluit={() => setKiezerOpen(false)}
            />
          </div>
          <Periodelijst weergave={weergave} datum={datum} acties={acties} />
        </>
      )}
    </div>
  );
}

function ZoekVeld({ waarde, opWijzig }: { waarde: string; opWijzig: (w: string) => void }) {
  return (
    <div className="relative w-full max-w-md">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-tekst-zacht"
      />
      <input
        type="search"
        aria-label={t.zoeken}
        placeholder={t.zoeken}
        maxLength={100}
        value={waarde}
        onChange={(e) => opWijzig(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') opWijzig('');
        }}
        className="min-h-14 w-full rounded-knop border-2 border-rand bg-achtergrond py-3 pr-14 pl-12 [&::-webkit-search-cancel-button]:hidden"
      />
      {waarde && (
        <button
          type="button"
          aria-label={t.zoekWissen}
          title={t.zoekWissen}
          onClick={() => opWijzig('')}
          className="absolute top-1/2 right-1 flex size-12 -translate-y-1/2 items-center justify-center rounded-knop hover:bg-vlak"
        >
          <X aria-hidden="true" className="size-6" />
        </button>
      )}
    </div>
  );
}

/** Het filter uit de store (OFM-053); één object per render is genoeg voor de query-keys. */
function useFilter(): OverzichtFilter {
  const statussen = useOverzichtFilter((s) => s.statussen);
  const ordening = useOverzichtFilter((s) => s.ordening);
  return { statussen, ordening };
}

const knopKlasse = (aan: boolean) =>
  'min-h-12 rounded-knop border-2 px-4 font-semibold ' +
  (aan ? 'border-accent bg-accent text-white' : 'border-rand bg-achtergrond text-tekst hover:border-accent');

/**
 * OFM-053: statusfilter (aan/uit-knoppen, niets aan = alle) en ordening (één van drie). Geldt voor de
 * periodelijst en de zoekresultaten; de keuze staat in `stores/overzichtFilter.ts`.
 */
function FilterBalk() {
  const { statussen, ordening } = useFilter();
  const wisselStatus = useOverzichtFilter((s) => s.wisselStatus);
  const wisStatussen = useOverzichtFilter((s) => s.wisStatussen);
  const zetOrdening = useOverzichtFilter((s) => s.zetOrdening);
  const f = t.filter;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
      <div
        role="group"
        aria-label={`${f.status}: ${f.statusAantal(statussen.length)}`}
        className="flex flex-wrap items-center gap-2"
      >
        <span aria-hidden="true" className="font-semibold">
          {f.status}
          {statussen.length > 0 && (
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-sm text-white tabular-nums">
              {statussen.length}
            </span>
          )}
        </span>
        <button
          type="button"
          aria-pressed={statussen.length === 0}
          onClick={wisStatussen}
          className={knopKlasse(statussen.length === 0)}
        >
          {f.alle}
        </button>
        {FILTER_STATUSSEN.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={statussen.includes(status)}
            onClick={() => wisselStatus(status)}
            className={knopKlasse(statussen.includes(status))}
          >
            {nl.componenten.status[status]}
          </button>
        ))}
      </div>
      <div role="group" aria-label={f.ordening} className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="font-semibold">
          {f.ordening}
        </span>
        {ORDENINGEN.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={o === ordening}
            onClick={() => zetOrdening(o)}
            className={knopKlasse(o === ordening)}
          >
            {f.ordeningen[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Periodelijst({ weergave, datum, acties }: { weergave: Weergave; datum: string; acties: RijActies }) {
  const filter = useFilter();
  const lijst = useOverzicht(weergave, datum, filter);
  const gaNaar = useNavigatie((s) => s.gaNaar);

  if (lijst.isError) return <Foutmelding fout={alsFout(lijst.error)} opnieuw={() => void lijst.refetch()} />;
  if (!lijst.data)
    return (
      <p role="status" className="text-tekst-zacht">
        {t.laden}
      </p>
    );

  const { items, groepen, samenvatting } = lijst.data;
  // `aria-busy` zolang de vorige lijst nog staat (keepPreviousData); ook het meetpunt van NFE-004.
  return (
    <div className="contents" aria-busy={lijst.isFetching} data-lijst="periode">
      {items.length === 0 ? (
        <p className="rounded-knop bg-vlak p-8 text-center text-lg">
          {filter.statussen.length > 0 ? t.filter.geenMetFilter : t.leeg}
        </p>
      ) : groepen ? (
        <div className="flex flex-col gap-6">
          {groepen.map((groep) => (
            <section key={groep.maand} aria-label={groep.label} className="flex flex-col gap-1">
              <h3 className="flex items-baseline justify-between border-b-2 border-rand px-4 pb-2 font-semibold">
                <span className="first-letter:uppercase">{groep.label}</span>
                <span className="font-normal text-tekst-zacht tabular-nums">
                  {t.subtotaal(formatEuroHeel(groep.subtotaalCent))}
                </span>
              </h3>
              <Lijst items={groep.items} acties={acties} />
            </section>
          ))}
        </div>
      ) : (
        <Lijst items={items} acties={acties} kop />
      )}
      <footer className="mt-auto flex items-center justify-between gap-4 border-t border-rand pt-4">
        <p className="font-semibold">
          {t.samenvatting(
            samenvatting.aantal,
            formatEuroHeel(samenvatting.totaalCent),
            samenvatting.aantalAkkoord,
          )}
        </p>
        <PrullenbakKnop opKlik={() => gaNaar({ scherm: 'prullenbak' })} />
      </footer>
    </div>
  );
}

function Zoekresultaten({ tekst, acties }: { tekst: string; acties: RijActies }) {
  const zoek = useZoekOffertes(tekst, useFilter());
  const gaNaar = useNavigatie((s) => s.gaNaar);

  if (zoek.isError) return <Foutmelding fout={alsFout(zoek.error)} opnieuw={() => void zoek.refetch()} />;
  if (!zoek.data)
    return (
      <p role="status" className="text-tekst-zacht">
        {t.laden}
      </p>
    );

  return (
    <div className="contents" aria-busy={zoek.isFetching} data-lijst="zoek">
      <p role="status" className="font-semibold">
        {zoek.data.length === 0 ? t.geenTreffers : t.zoekResultaten(zoek.data.length)}
      </p>
      {zoek.data.length > 0 && <Lijst items={zoek.data} acties={acties} kop />}
      {zoek.data.length >= ZOEK_LIMIET && <p className="text-tekst-zacht">{t.zoekLimiet(ZOEK_LIMIET)}</p>}
      <footer className="mt-auto flex justify-end border-t border-rand pt-4">
        <PrullenbakKnop opKlik={() => gaNaar({ scherm: 'prullenbak' })} />
      </footer>
    </div>
  );
}

function Lijst({
  items,
  acties,
  kop = false,
}: {
  items: OfferteLijstItem[];
  acties: RijActies;
  kop?: boolean;
}) {
  return (
    <div className="flex flex-col">
      {kop && (
        <div aria-hidden="true" className={`${offerteRijKolommen} px-4 pb-2 text-base text-tekst-zacht`}>
          <span>{t.kolommen.nummer}</span>
          <span>{t.kolommen.klant}</span>
          <span>{t.kolommen.plaats}</span>
          <span>{t.kolommen.omschrijving}</span>
          <span className="text-right">{t.kolommen.totaal}</span>
          <span className="text-right">{t.kolommen.status}</span>
        </div>
      )}
      <ul aria-label={t.titel} className="flex flex-col divide-y divide-rand">
        {items.map((item) => (
          <li key={item.id}>
            <OfferteRij offerte={item} opKies={acties.opKies} opMenu={acties.opMenu} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrullenbakKnop({ opKlik }: { opKlik: () => void }) {
  return (
    <button
      type="button"
      onClick={opKlik}
      className="inline-flex min-h-12 items-center gap-2 rounded-knop px-3 text-accent underline underline-offset-4 hover:bg-vlak"
    >
      <Trash2 aria-hidden="true" className="size-5" />
      {t.prullenbak}
    </button>
  );
}
