import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { euroNaarCent } from '@shared/calc/bedragen';
import type {
  BtwTarief,
  Eenheid,
  Keuzeoptie,
  Materiaal,
  Werkzaamheid,
  WerkzaamhedenSet,
} from '@shared/types';
import { geldigeSituaties } from '@shared/werkzaamheden';
import { useKeuzelijsten } from '../../api/keuzelijsten';
import { alsFout } from '../../api/roep';
import {
  alsBewaarInvoer,
  bewaarWerkzaamheden,
  useWerkzaamheden,
  meldWachtend,
  useWerkzaamhedenBezig,
} from '../../api/werkzaamheden';
import { Bevestiging } from '../../componenten/Bevestiging';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { useSelecteerBijFocus } from '../../componenten/GetalVeld';
import { Knop } from '../../componenten/Knop';
import { Veld } from '../../componenten/Veld';
import { leesGetal, schoonGetalInvoer, toonGetal } from '../../componenten/getalNotatie';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';
import { allesBenoemd, beginSetLabels, naamVan } from './werkzaamhedenGedeeld';

// Gedeelde onderdelen van de tabs Materialen en prijzen en Werkzaamheden (OFM-056; tot dan één tab
// Werkzaamheden en prijzen, OFM-048/055). Beide tabs bewerken dezelfde set (`werkzaamheden:haal`) en
// bewaren hem als geheel via `werkzaamheden:bewaar` (FE-075): namen en prijzen na 800 ms of bij verlaten
// van het veld, vinkjes en knoppen meteen. Een nieuw item krijgt hier al een id.

export const t = nl.werkzaamheden;
export const eenheidNaam = nl.instellingen.prijzen.eenheden;
const EENHEDEN: Eenheid[] = ['m²', 'm¹', 'stuk', 'post', 'uur', 'dag'];
const TARIEVEN: BtwTarief[] = [21, 9, 0];
export const invoerKlasse =
  'min-h-12 w-full rounded-knop border-2 border-rand bg-achtergrond px-3 py-2 aria-[invalid=true]:border-fout';

export type Item = { id: string; label: string; verborgen: boolean; inGebruik: boolean };
type TeVerwijderen = { label: string; inGebruik: boolean; verwijder: () => void; verberg: () => void };

export type SetProps = {
  beginSet: WerkzaamhedenSet;
  soorten: Keuzeoptie[];
  ondergronden: Keuzeoptie[];
  bedekkingen: Keuzeoptie[];
  /** Na "Herstel startset": opnieuw laden en de bewerker opnieuw beginnen. */
  opHersteld: () => void;
};

/**
 * Laadt de set en de keuzelijsten en begint de bewerker pas als er geen bewaaractie meer loopt (bijv. de
 * laatste wijziging van de andere tab), zodat hij met de verse set begint.
 */
export function SetLader({ kind }: { kind: (props: SetProps) => ReactNode }) {
  const werk = useWerkzaamheden();
  const keuzes = useKeuzelijsten();
  const bezig = useWerkzaamhedenBezig();
  const [klaar, setKlaar] = useState(false);
  // Na "Herstel startset" alles opnieuw uit de database laden.
  const [versie, setVersie] = useState(0);
  // Eenmalig: daarna blijft de bewerker staan, ook als hij zelf bewaart (bijwerken tijdens de render).
  if (!klaar && werk.data && !werk.isFetching && bezig === 0) setKlaar(true);

  const fout = werk.error ?? keuzes.error;
  if (fout) return <Foutmelding fout={alsFout(fout)} opnieuw={() => void werk.refetch()} />;
  if (!klaar || !werk.data || !keuzes.data) return <p role="status">{nl.algemeen.laden}</p>;
  return (
    <div key={versie}>
      {kind({
        beginSet: werk.data,
        soorten: keuzes.data.soortWerk,
        ondergronden: keuzes.data.ondergrond,
        bedekkingen: keuzes.data.nieuweBedekking,
        opHersteld: () => void werk.refetch().then(() => setVersie((v) => v + 1)),
      })}
    </div>
  );
}

/** Staat en bewaren van de set, gedeeld door beide tabs. */
export function useSetBewerker(beginSet: WerkzaamhedenSet, soorten: Keuzeoptie[]) {
  const [set, setSet] = useState(beginSet);
  const [vervallen, setVervallen] = useState<string | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<TeVerwijderen | null>(null);
  const [bewerker] = useState(() => Symbol('werkzaamheden'));

  const soortSleutels = useRef(new Set(soorten.map((s) => s.sleutel)));
  useEffect(() => {
    soortSleutels.current = new Set(soorten.map((s) => s.sleutel));
  }, [soorten]);

  const bewaren = useAutoBewaar((waarde: WerkzaamhedenSet) => {
    // Eerst als lopend tellen (synchroon in `bewaarWerkzaamheden`), dan pas niet meer als wachtend.
    const klaar = bewaarWerkzaamheden(alsBewaarInvoer(waarde, soortSleutels.current));
    meldWachtend(bewerker, false);
    return klaar;
  }, allesBenoemd);
  // Na het opruimen van `useAutoBewaar` (die bewaart een wachtende wijziging): niets meer wachtend, ook
  // als die wijziging ongeldig was en niet is bewaard.
  useEffect(() => () => meldWachtend(bewerker, false), [bewerker]);

  const wijzig = (gewijzigd: WerkzaamhedenSet, direct: boolean) => {
    // OFM-055: een standaardmateriaal bij een daksituatie dat niet meer kiesbaar is of niet meer bij de
    // tags past, vervalt (melding).
    const { werkzaamheden, vervallen: aantal } = geldigeSituaties(
      gewijzigd.werkzaamheden,
      gewijzigd.materialen,
    );
    const nieuw = { ...gewijzigd, werkzaamheden };
    setVervallen(aantal > 0 ? t.situatie.vervallen(aantal) : null);
    setSet(nieuw);
    if (direct) bewaren.bewaarDirect(nieuw);
    else {
      meldWachtend(bewerker, true);
      bewaren.wijzig(nieuw);
    }
  };
  const zetWerk = (id: string, deel: Partial<Werkzaamheid>, direct: boolean) =>
    wijzig(
      { ...set, werkzaamheden: set.werkzaamheden.map((w) => (w.id === id ? { ...w, ...deel } : w)) },
      direct,
    );
  const zetMateriaal = (id: string, deel: Partial<Materiaal>, direct: boolean) =>
    wijzig({ ...set, materialen: set.materialen.map((m) => (m.id === id ? { ...m, ...deel } : m)) }, direct);
  const vraagVerwijderen = (item: Item, naam: string, verwijder: () => void, verberg: () => void) =>
    setTeVerwijderen({ label: naam, inGebruik: item.inGebruik, verwijder, verberg });

  // Toegankelijke namen uit de bewaarde set: veranderen niet tijdens het typen.
  const materiaalNamen = beginSetLabels(beginSet.materialen, set.materialen);
  const werkNamen = beginSetLabels(beginSet.werkzaamheden, set.werkzaamheden);

  const meldingen = (
    <>
      {bewaren.fout && <Foutmelding fout={bewaren.fout} />}
      {vervallen && (
        <p
          role="status"
          className="rounded-knop border-2 border-waarschuwing-rand bg-waarschuwing-vlak px-4 py-3 text-waarschuwing"
        >
          {vervallen}
        </p>
      )}
    </>
  );

  const verwijderVragen = (
    <>
      <Bevestiging
        open={teVerwijderen !== null && !teVerwijderen.inGebruik}
        titel={t.verwijderTitel}
        bevestigLabel={t.verwijderJa}
        annuleerLabel={t.verwijderNee}
        gevaar
        opAnnuleer={() => setTeVerwijderen(null)}
        opBevestig={() => {
          teVerwijderen?.verwijder();
          setTeVerwijderen(null);
        }}
      >
        <p>{teVerwijderen && t.verwijderTekst(teVerwijderen.label)}</p>
      </Bevestiging>
      <Bevestiging
        open={teVerwijderen !== null && teVerwijderen.inGebruik}
        titel={t.verwijderTitel}
        bevestigLabel={t.verbergInPlaats}
        annuleerLabel={t.sluiten}
        opAnnuleer={() => setTeVerwijderen(null)}
        opBevestig={() => {
          teVerwijderen?.verberg();
          setTeVerwijderen(null);
        }}
      >
        <p>{teVerwijderen && t.inGebruik(teVerwijderen.label)}</p>
      </Bevestiging>
    </>
  );

  return {
    set,
    bewaren,
    wijzig,
    zetWerk,
    zetMateriaal,
    vraagVerwijderen,
    materiaalNaam: (m: { id: string; label: string }) => naamVan(m, materiaalNamen, t.naam),
    werkNaam: (w: { id: string; label: string }) => naamVan(w, werkNamen, t.naam),
    materiaalNamen,
    werkNamen,
    meldingen,
    verwijderVragen,
  };
}

/** Kop van een tab: uitleg en "Bewaard ✓". */
export function TabKop({ uitleg, signaal }: { uitleg: string; signaal: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="max-w-3xl text-tekst-zacht">{uitleg}</p>
      <BewaardIndicator signaal={signaal} />
    </div>
  );
}

export function Deel({ titel, uitleg, children }: { titel: string; uitleg?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4" aria-label={titel}>
      <h2 className="text-3xl font-semibold">{titel}</h2>
      {uitleg && <p className="max-w-3xl text-tekst-zacht">{uitleg}</p>}
      {children}
    </section>
  );
}

/** Kolomkoppen boven een lijst (alleen visueel; elk veld heeft een eigen toegankelijke naam). */
export function Koppen({ klasse, koppen }: { klasse: string; koppen: string[] }) {
  return (
    <div aria-hidden="true" className={`${klasse} border-b-2 border-rand px-2 pb-2 font-semibold`}>
      {koppen.map((kop) => (
        <span key={kop}>{kop}</span>
      ))}
    </div>
  );
}

export function NieuwFormulier({
  label,
  hint,
  waarde,
  opWijzig,
  opToevoegen,
  toevoegenLabel,
  fout,
}: {
  label: string;
  hint?: string;
  waarde: string;
  opWijzig: (waarde: string) => void;
  opToevoegen: () => void;
  toevoegenLabel: string;
  /** OFM-057: een fout bij de naam (bijv. al in gebruik); de knop is dan uit. */
  fout?: string;
}) {
  return (
    <form
      className="flex flex-wrap items-end gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        opToevoegen();
      }}
    >
      <div className="min-w-72 flex-1">
        <Veld label={label} hint={hint} fout={fout} waarde={waarde} opWijzig={opWijzig} maxLength={80} />
      </div>
      <Knop
        type="submit"
        label={toevoegenLabel}
        icoon={Plus}
        disabled={waarde.trim() === '' || fout !== undefined}
      />
    </form>
  );
}

export function NaamInvoer({
  label,
  item,
  opWijzig,
  opBlur,
  focus = false,
}: {
  label: string;
  item: Item;
  opWijzig: (label: string) => void;
  opBlur: () => void;
  /** OFM-056: een net toegevoegd item krijgt de focus op zijn naamveld. */
  focus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  const leeg = item.label.trim() === '';
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <input
        ref={ref}
        className={`${invoerKlasse} max-w-xl ${item.verborgen ? 'text-tekst-zacht' : ''}`}
        aria-label={label}
        aria-invalid={leeg || undefined}
        title={leeg ? t.naamFout : undefined}
        value={item.label}
        maxLength={80}
        onChange={(e) => opWijzig(e.target.value)}
        onBlur={opBlur}
      />
      {item.verborgen && (
        <span className="rounded-full bg-vlak px-3 py-1 text-tekst-zacht">{t.verborgen}</span>
      )}
    </div>
  );
}

export function EenheidKeuze({
  label,
  waarde,
  opWijzig,
}: {
  label: string;
  waarde: Eenheid;
  opWijzig: (eenheid: Eenheid) => void;
}) {
  return (
    <select
      className={invoerKlasse}
      aria-label={label}
      value={waarde}
      onChange={(e) => opWijzig(e.target.value as Eenheid)}
    >
      {EENHEDEN.map((e) => (
        <option key={e} value={e}>
          {eenheidNaam[e]}
        </option>
      ))}
    </select>
  );
}

export function BtwKeuze({
  label,
  waarde,
  opWijzig,
}: {
  label: string;
  waarde: BtwTarief;
  opWijzig: (btw: BtwTarief) => void;
}) {
  return (
    <select
      className={invoerKlasse}
      aria-label={label}
      value={waarde}
      onChange={(e) => opWijzig(Number(e.target.value) as BtwTarief)}
    >
      {TARIEVEN.map((tarief) => (
        <option key={tarief} value={tarief}>
          {t.btwTarief(tarief)}
        </option>
      ))}
    </select>
  );
}

export function PrijsInvoer({
  label,
  prijsCent,
  opWijzig,
  opBlur,
}: {
  label: string;
  prijsCent: number | null;
  opWijzig: (prijsCent: number | null) => void;
  opBlur: () => void;
}) {
  const [tekst, setTekst] = useState(toonGetal(prijsCent === null ? null : prijsCent / 100, 2));
  const selecteer = useSelecteerBijFocus();
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="text-tekst-zacht">
        €
      </span>
      <input
        className={`${invoerKlasse} text-right tabular-nums`}
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        onFocus={selecteer.onFocus}
        onMouseUp={selecteer.onMouseUp}
        onKeyDown={selecteer.onKeyDown}
        value={tekst}
        onChange={(e) => {
          const schoon = schoonGetalInvoer(e.target.value, 2);
          setTekst(schoon);
          const euro = leesGetal(schoon);
          opWijzig(euro === null ? null : euroNaarCent(euro));
        }}
        onBlur={() => {
          setTekst(toonGetal(leesGetal(tekst), 2));
          opBlur();
        }}
      />
    </span>
  );
}

/** Verbergen en verwijderen (de volgorde is sinds OFM-056 alfabetisch, dus geen pijlen meer). */
export function ItemKnoppen({
  naam,
  item,
  opVerberg,
  opVerwijder,
}: {
  naam: string;
  item: Item;
  opVerberg: () => void;
  opVerwijder: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Knop
        label={item.verborgen ? t.toon(naam) : t.verberg(naam)}
        icoon={item.verborgen ? Eye : EyeOff}
        alleenIcoon
        onClick={opVerberg}
      />
      <Knop label={t.verwijder(naam)} icoon={Trash2} alleenIcoon onClick={opVerwijder} />
    </div>
  );
}

/** Eén veld met een zichtbaar kopje erboven (de toegankelijke naam staat op het veld zelf). */
export function MetKop({ kop, children }: { kop: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden="true" className="font-semibold">
        {kop}
      </span>
      {children}
    </div>
  );
}

export const chipKlasse = (aan: boolean) =>
  'inline-flex min-h-12 items-center gap-2 rounded-full px-4 py-2 font-semibold disabled:cursor-not-allowed ' +
  (aan
    ? 'border-3 border-accent bg-achtergrond text-accent'
    : 'border-2 border-rand bg-achtergrond text-tekst-zacht hover:border-accent');
