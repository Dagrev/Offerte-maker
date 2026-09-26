import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { euroNaarCent } from '@shared/calc/bedragen';
import type {
  Eenheid,
  Keuzeoptie,
  Materiaal,
  WerkOptie,
  Werkzaamheid,
  WerkzaamhedenSet,
} from '@shared/types';
import { useKeuzelijsten } from '../../api/keuzelijsten';
import { alsFout } from '../../api/roep';
import { bewaarWerkzaamheden, herstelWerkzaamheden, useWerkzaamheden } from '../../api/werkzaamheden';
import { Bevestiging } from '../../componenten/Bevestiging';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { useSelecteerBijFocus } from '../../componenten/GetalVeld';
import { Knop } from '../../componenten/Knop';
import { Veld } from '../../componenten/Veld';
import { Vinkje } from '../../componenten/Vinkje';
import { leesGetal, schoonGetalInvoer, toonGetal } from '../../componenten/getalNotatie';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';
import { LijstBewerker } from './TabKeuzelijsten';

// Tab Werkzaamheden (OFM-043): (1) soorten werk (de keuzelijst `soortWerk`) met per soort de
// gekoppelde werkzaamheden, (2) werkzaamheden met eenheid, prijs, opties en kiesbare materialen,
// (3) materialen. De hele set bewaart vanzelf via `werkzaamheden:bewaar` (FE-075); namen en prijzen na
// 800 ms of bij verlaten van het veld, vinkjes en knoppen meteen. Een nieuw item krijgt hier al een id.

const t = nl.werkzaamheden;
const EENHEDEN: Eenheid[] = ['m²', 'm¹', 'stuk', 'post', 'uur', 'dag'];
const invoerKlasse =
  'min-h-12 w-full rounded-knop border-2 border-rand bg-achtergrond px-3 py-2 aria-[invalid=true]:border-fout';
const RIJ =
  'grid grid-cols-[minmax(0,1fr)_8rem_10rem_auto] items-center gap-3 border-b border-rand px-2 py-2';

type Item = { id: string; label: string; verborgen: boolean; inGebruik: boolean };
type TeVerwijderen = { label: string; inGebruik: boolean; verwijder: () => void; verberg: () => void };

function naarInvoer(set: WerkzaamhedenSet, soorten: ReadonlySet<string>) {
  return {
    werkzaamheden: set.werkzaamheden.map((w) => ({
      id: w.id,
      label: w.label.trim(),
      eenheid: w.eenheid,
      prijsCent: w.prijsCent,
      verborgen: w.verborgen,
      // Een soort werk die net uit de keuzelijst is verwijderd, valt weg (de database doet dat ook).
      soortenWerk: w.soortenWerk.filter((s) => soorten.has(s)),
      opties: w.opties.map(({ id, label, eenheid, prijsCent, verborgen }) => ({
        id,
        label: label.trim(),
        eenheid,
        prijsCent,
        verborgen,
      })),
      materialen: w.materialen,
    })),
    materialen: set.materialen.map(({ id, label, eenheid, prijsCent, verborgen }) => ({
      id,
      label: label.trim(),
      eenheid,
      prijsCent,
      verborgen,
    })),
  };
}

const allesBenoemd = (set: WerkzaamhedenSet) =>
  [...set.werkzaamheden, ...set.werkzaamheden.flatMap((w) => w.opties), ...set.materialen].every(
    (i) => i.label.trim() !== '',
  );

function verplaats<T>(lijst: T[], index: number, richting: -1 | 1): T[] {
  const kopie = [...lijst];
  const [item] = kopie.splice(index, 1);
  if (item !== undefined) kopie.splice(index + richting, 0, item);
  return kopie;
}

export function TabWerkzaamheden() {
  const werk = useWerkzaamheden();
  const keuzes = useKeuzelijsten();
  // Na "Herstel startset" alles opnieuw uit de database laden.
  const [versie, setVersie] = useState(0);

  const fout = werk.error ?? keuzes.error;
  if (fout) return <Foutmelding fout={alsFout(fout)} opnieuw={() => void werk.refetch()} />;
  if (!werk.data || !keuzes.data) return <p role="status">{nl.algemeen.laden}</p>;
  return (
    <Bewerker
      key={versie}
      beginSet={werk.data}
      soorten={keuzes.data.soortWerk}
      opHersteld={() => void werk.refetch().then(() => setVersie((v) => v + 1))}
    />
  );
}

function Bewerker({
  beginSet,
  soorten,
  opHersteld,
}: {
  beginSet: WerkzaamhedenSet;
  soorten: Keuzeoptie[];
  opHersteld: () => void;
}) {
  const [set, setSet] = useState(beginSet);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [nieuwWerk, setNieuwWerk] = useState('');
  const [nieuwMateriaal, setNieuwMateriaal] = useState('');
  const [teVerwijderen, setTeVerwijderen] = useState<TeVerwijderen | null>(null);
  const [herstellen, setHerstellen] = useState(false);
  const [herstelFout, setHerstelFout] = useState<ReturnType<typeof alsFout> | null>(null);
  const [soortVersie, setSoortVersie] = useState(0);

  const soortSleutels = useRef(new Set(soorten.map((s) => s.sleutel)));
  useEffect(() => {
    soortSleutels.current = new Set(soorten.map((s) => s.sleutel));
  }, [soorten]);

  const bewaren = useAutoBewaar(
    (waarde: WerkzaamhedenSet) => bewaarWerkzaamheden(naarInvoer(waarde, soortSleutels.current)),
    allesBenoemd,
  );

  const wijzig = (nieuw: WerkzaamhedenSet, direct: boolean) => {
    setSet(nieuw);
    if (direct) bewaren.bewaarDirect(nieuw);
    else bewaren.wijzig(nieuw);
  };
  const zetWerk = (id: string, deel: Partial<Werkzaamheid>, direct: boolean) =>
    wijzig(
      { ...set, werkzaamheden: set.werkzaamheden.map((w) => (w.id === id ? { ...w, ...deel } : w)) },
      direct,
    );
  const zetMateriaal = (id: string, deel: Partial<Materiaal>, direct: boolean) =>
    wijzig({ ...set, materialen: set.materialen.map((m) => (m.id === id ? { ...m, ...deel } : m)) }, direct);

  // Toegankelijke namen uit de bewaarde set: veranderen niet tijdens het typen.
  const naamVan = (item: { id: string; label: string }, bewaard: readonly { id: string; label: string }[]) =>
    bewaard.find((b) => b.id === item.id)?.label ?? (item.label.trim() || t.naam);

  const voegWerkToe = () => {
    const label = nieuwWerk.trim();
    if (label === '') return;
    const nieuw: Werkzaamheid = {
      id: crypto.randomUUID(),
      sleutel: '',
      label,
      eenheid: 'm²',
      prijsCent: null,
      verborgen: false,
      standaard: false,
      inGebruik: false,
      soortenWerk: [],
      opties: [],
      materialen: [],
    };
    setNieuwWerk('');
    wijzig({ ...set, werkzaamheden: [...set.werkzaamheden, nieuw] }, true);
  };
  const voegMateriaalToe = () => {
    const label = nieuwMateriaal.trim();
    if (label === '') return;
    const nieuw: Materiaal = {
      id: crypto.randomUUID(),
      sleutel: '',
      label,
      eenheid: 'm²',
      prijsCent: null,
      verborgen: false,
      standaard: false,
      inGebruik: false,
    };
    setNieuwMateriaal('');
    wijzig({ ...set, materialen: [...set.materialen, nieuw] }, true);
  };
  const verwijderMateriaal = (id: string) =>
    wijzig(
      {
        werkzaamheden: set.werkzaamheden.map((w) => ({
          ...w,
          materialen: w.materialen.filter((m) => m.materiaalId !== id),
        })),
        materialen: set.materialen.filter((m) => m.id !== id),
        soortenWerk: set.soortenWerk,
      },
      true,
    );
  const vraagVerwijderen = (item: Item, naam: string, verwijder: () => void, verberg: () => void) =>
    setTeVerwijderen({ label: naam, inGebruik: item.inGebruik, verwijder, verberg });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-3xl text-tekst-zacht">{t.uitleg}</p>
        <BewaardIndicator signaal={bewaren.signaal} />
      </div>
      {bewaren.fout && <Foutmelding fout={bewaren.fout} />}
      {herstelFout && <Foutmelding fout={herstelFout} />}

      {/* 1. Soorten werk */}
      <Deel titel={t.soorten} uitleg={t.soortenUitleg}>
        <LijstBewerker
          key={soortVersie}
          lijst="soortWerk"
          opties={soorten}
          Kop="h3"
          opHersteld={() => setSoortVersie((v) => v + 1)}
        />
        <h3 className="text-2xl font-semibold">{t.koppelingen}</h3>
        {set.werkzaamheden.length === 0 ? (
          <p className="text-tekst-zacht">{t.geenWerkzaamheden}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {soorten.map((soort) => (
              <fieldset key={soort.id} className="rounded-knop border-2 border-rand px-4 pb-3">
                <legend className="px-2 text-lg font-semibold">
                  {soort.verborgen ? t.verborgenAchter(soort.label) : soort.label}
                </legend>
                {set.werkzaamheden.map((w) => (
                  <Vinkje
                    key={w.id}
                    label={w.verborgen ? t.verborgenAchter(w.label) : w.label}
                    aan={w.soortenWerk.includes(soort.sleutel)}
                    opWijzig={(aan) =>
                      zetWerk(
                        w.id,
                        {
                          soortenWerk: aan
                            ? [...w.soortenWerk, soort.sleutel]
                            : w.soortenWerk.filter((s) => s !== soort.sleutel),
                        },
                        true,
                      )
                    }
                  />
                ))}
              </fieldset>
            ))}
          </div>
        )}
      </Deel>

      {/* 2. Werkzaamheden */}
      <Deel titel={t.werkzaamheden}>
        <ul aria-label={t.werkzaamheden} className="flex flex-col">
          {set.werkzaamheden.map((w, index) => {
            const naam = naamVan(w, beginSetLabels(beginSet.werkzaamheden, set.werkzaamheden));
            const isOpen = open.has(w.id);
            return (
              <li key={w.id} className="flex flex-col">
                <ItemRij
                  naam={naam}
                  item={w}
                  labels={{ naam: t.werkNaam(naam), eenheid: t.werkEenheid(naam), prijs: t.werkPrijs(naam) }}
                  eenheid={w.eenheid}
                  prijsCent={w.prijsCent}
                  eerste={index === 0}
                  laatste={index === set.werkzaamheden.length - 1}
                  opLabel={(label) => zetWerk(w.id, { label }, false)}
                  opEenheid={(eenheid) => zetWerk(w.id, { eenheid }, true)}
                  opPrijs={(prijsCent) => zetWerk(w.id, { prijsCent }, false)}
                  opBlur={bewaren.bewaarNu}
                  opVerplaats={(r) =>
                    wijzig({ ...set, werkzaamheden: verplaats(set.werkzaamheden, index, r) }, true)
                  }
                  opVerberg={() => zetWerk(w.id, { verborgen: !w.verborgen }, true)}
                  opVerwijder={() =>
                    vraagVerwijderen(
                      w,
                      naam,
                      () =>
                        wijzig(
                          { ...set, werkzaamheden: set.werkzaamheden.filter((x) => x.id !== w.id) },
                          true,
                        ),
                      () => zetWerk(w.id, { verborgen: true }, true),
                    )
                  }
                  extra={
                    <Knop
                      label={t.details(naam)}
                      icoon={isOpen ? ChevronUp : ChevronDown}
                      alleenIcoon
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpen((o) => {
                          const n = new Set(o);
                          if (isOpen) n.delete(w.id);
                          else n.add(w.id);
                          return n;
                        })
                      }
                    />
                  }
                />
                {isOpen && (
                  <WerkDetails
                    werk={w}
                    naam={naam}
                    materialen={set.materialen}
                    bewaardeOpties={beginSet.werkzaamheden.find((b) => b.id === w.id)?.opties ?? []}
                    opWijzig={(deel, direct) => zetWerk(w.id, deel, direct)}
                    opBlur={bewaren.bewaarNu}
                    opVerwijderVraag={vraagVerwijderen}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <NieuwFormulier
          label={t.nieuwWerk}
          hint={t.nieuwWerkHint}
          waarde={nieuwWerk}
          opWijzig={setNieuwWerk}
          opToevoegen={voegWerkToe}
        />
      </Deel>

      {/* 3. Materialen */}
      <Deel titel={t.materialen} uitleg={t.materialenUitleg}>
        <ul aria-label={t.materialen} className="flex flex-col">
          {set.materialen.map((m, index) => {
            const naam = naamVan(m, beginSetLabels(beginSet.materialen, set.materialen));
            return (
              <li key={m.id}>
                <ItemRij
                  naam={naam}
                  item={m}
                  labels={{
                    naam: t.materiaalNaam(naam),
                    eenheid: t.materiaalEenheid(naam),
                    prijs: t.materiaalPrijs(naam),
                  }}
                  eenheid={m.eenheid}
                  prijsCent={m.prijsCent}
                  eerste={index === 0}
                  laatste={index === set.materialen.length - 1}
                  opLabel={(label) => zetMateriaal(m.id, { label }, false)}
                  opEenheid={(eenheid) => zetMateriaal(m.id, { eenheid }, true)}
                  opPrijs={(prijsCent) => zetMateriaal(m.id, { prijsCent }, false)}
                  opBlur={bewaren.bewaarNu}
                  opVerplaats={(r) =>
                    wijzig({ ...set, materialen: verplaats(set.materialen, index, r) }, true)
                  }
                  opVerberg={() => zetMateriaal(m.id, { verborgen: !m.verborgen }, true)}
                  opVerwijder={() =>
                    vraagVerwijderen(
                      m,
                      naam,
                      () => verwijderMateriaal(m.id),
                      () => zetMateriaal(m.id, { verborgen: true }, true),
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
        <NieuwFormulier
          label={t.nieuwMateriaal}
          hint={t.nieuwMateriaalHint}
          waarde={nieuwMateriaal}
          opWijzig={setNieuwMateriaal}
          opToevoegen={voegMateriaalToe}
        />
      </Deel>

      <div>
        <Knop label={t.herstel} icoon={RotateCcw} variant="secundair" onClick={() => setHerstellen(true)} />
      </div>

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
      <Bevestiging
        open={herstellen}
        titel={t.herstelTitel}
        bevestigLabel={t.herstelJa}
        annuleerLabel={t.herstelNee}
        opAnnuleer={() => setHerstellen(false)}
        opBevestig={() => {
          setHerstellen(false);
          // Eerst een wachtende wijziging wegschrijven, dan herstellen en opnieuw laden.
          bewaren.bewaarNu();
          herstelWerkzaamheden().then(opHersteld, (e: unknown) => setHerstelFout(alsFout(e)));
        }}
      >
        <p>{t.herstelTekst}</p>
      </Bevestiging>
    </div>
  );
}

/** Labels zoals bij het openen van de tab, aangevuld met nieuwe items (voor stabiele namen). */
function beginSetLabels(begin: readonly Item[], nu: readonly Item[]): readonly Item[] {
  return [...begin, ...nu.filter((n) => !begin.some((b) => b.id === n.id))];
}

function Deel({ titel, uitleg, children }: { titel: string; uitleg?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4" aria-label={titel}>
      <h2 className="text-3xl font-semibold">{titel}</h2>
      {uitleg && <p className="max-w-3xl text-tekst-zacht">{uitleg}</p>}
      {children}
    </section>
  );
}

function NieuwFormulier({
  label,
  hint,
  waarde,
  opWijzig,
  opToevoegen,
  toevoegenLabel = t.toevoegen,
}: {
  label: string;
  hint?: string;
  waarde: string;
  opWijzig: (waarde: string) => void;
  opToevoegen: () => void;
  toevoegenLabel?: string;
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
        <Veld label={label} hint={hint} waarde={waarde} opWijzig={opWijzig} maxLength={80} />
      </div>
      <Knop type="submit" label={toevoegenLabel} icoon={Plus} disabled={waarde.trim() === ''} />
    </form>
  );
}

/** Eén rij: naam, eenheid, prijs, volgorde, verbergen, verwijderen (en eventueel een extra knop). */
function ItemRij({
  naam,
  item,
  labels,
  eenheid,
  prijsCent,
  eerste,
  laatste,
  opLabel,
  opEenheid,
  opPrijs,
  opBlur,
  opVerplaats,
  opVerberg,
  opVerwijder,
  extra,
}: {
  naam: string;
  item: Item;
  labels: { naam: string; eenheid: string; prijs: string };
  eenheid: Eenheid;
  prijsCent: number | null;
  eerste: boolean;
  laatste: boolean;
  opLabel: (label: string) => void;
  opEenheid: (eenheid: Eenheid) => void;
  opPrijs: (prijsCent: number | null) => void;
  opBlur: () => void;
  opVerplaats?: (richting: -1 | 1) => void;
  opVerberg: () => void;
  opVerwijder: () => void;
  extra?: ReactNode;
}) {
  const leeg = item.label.trim() === '';
  return (
    <div className={RIJ}>
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${invoerKlasse} max-w-xl ${item.verborgen ? 'text-tekst-zacht' : ''}`}
          aria-label={labels.naam}
          aria-invalid={leeg || undefined}
          title={leeg ? t.naamFout : undefined}
          value={item.label}
          maxLength={80}
          onChange={(e) => opLabel(e.target.value)}
          onBlur={opBlur}
        />
        {item.verborgen && (
          <span className="rounded-full bg-vlak px-3 py-1 text-tekst-zacht">{t.verborgen}</span>
        )}
      </div>
      <select
        className={invoerKlasse}
        aria-label={labels.eenheid}
        value={eenheid}
        onChange={(e) => opEenheid(e.target.value as Eenheid)}
      >
        {EENHEDEN.map((e) => (
          <option key={e} value={e}>
            {nl.instellingen.prijzen.eenheden[e]}
          </option>
        ))}
      </select>
      <PrijsInvoer label={labels.prijs} prijsCent={prijsCent} opWijzig={opPrijs} opBlur={opBlur} />
      <div className="flex items-center gap-2">
        {opVerplaats && (
          <>
            <Knop
              label={t.omhoog(naam)}
              icoon={ArrowUp}
              alleenIcoon
              disabled={eerste}
              onClick={() => opVerplaats(-1)}
            />
            <Knop
              label={t.omlaag(naam)}
              icoon={ArrowDown}
              alleenIcoon
              disabled={laatste}
              onClick={() => opVerplaats(1)}
            />
          </>
        )}
        <Knop
          label={item.verborgen ? t.toon(naam) : t.verberg(naam)}
          icoon={item.verborgen ? Eye : EyeOff}
          alleenIcoon
          onClick={opVerberg}
        />
        <Knop label={t.verwijder(naam)} icoon={Trash2} alleenIcoon onClick={opVerwijder} />
        {extra}
      </div>
    </div>
  );
}

function PrijsInvoer({
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

/** Uitklapdeel van een werkzaamheid: opties en kiesbare materialen met één standaardmateriaal. */
function WerkDetails({
  werk,
  naam,
  materialen,
  bewaardeOpties,
  opWijzig,
  opBlur,
  opVerwijderVraag,
}: {
  werk: Werkzaamheid;
  naam: string;
  materialen: Materiaal[];
  bewaardeOpties: WerkOptie[];
  opWijzig: (deel: Partial<Werkzaamheid>, direct: boolean) => void;
  opBlur: () => void;
  opVerwijderVraag: (item: Item, naam: string, verwijder: () => void, verberg: () => void) => void;
}) {
  const [nieuweOptie, setNieuweOptie] = useState('');
  const zetOptie = (id: string, deel: Partial<WerkOptie>, direct: boolean) =>
    opWijzig({ opties: werk.opties.map((o) => (o.id === id ? { ...o, ...deel } : o)) }, direct);
  const voegOptieToe = () => {
    const label = nieuweOptie.trim();
    if (label === '') return;
    setNieuweOptie('');
    opWijzig(
      {
        opties: [
          ...werk.opties,
          {
            id: crypto.randomUUID(),
            sleutel: '',
            label,
            eenheid: 'stuk',
            prijsCent: null,
            verborgen: false,
            inGebruik: false,
          },
        ],
      },
      true,
    );
  };
  const gekozen = new Set(werk.materialen.map((m) => m.materiaalId));
  const standaard = werk.materialen.find((m) => m.standaard)?.materiaalId ?? '';
  const zetMaterialen = (ids: Set<string>, standaardId: string) =>
    opWijzig(
      {
        // In de volgorde van de materialenlijst.
        materialen: materialen
          .filter((m) => ids.has(m.id))
          .map((m) => ({ materiaalId: m.id, standaard: m.id === standaardId })),
      },
      true,
    );

  return (
    <div className="mb-4 ml-6 flex flex-col gap-6 border-l-4 border-rand py-4 pl-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-xl font-semibold">{t.opties}</h3>
        <p className="text-tekst-zacht">{t.optiesUitleg}</p>
        {werk.opties.length === 0 ? (
          <p className="text-tekst-zacht">{t.geenOpties}</p>
        ) : (
          <ul aria-label={`${t.opties} ${naam}`} className="flex flex-col">
            {werk.opties.map((o) => {
              const optieNaam =
                bewaardeOpties.find((b) => b.id === o.id)?.label ?? (o.label.trim() || t.naam);
              return (
                <li key={o.id}>
                  <ItemRij
                    naam={optieNaam}
                    item={o}
                    labels={{
                      naam: t.optieNaam(optieNaam, naam),
                      eenheid: t.optieEenheid(optieNaam, naam),
                      prijs: t.optiePrijs(optieNaam, naam),
                    }}
                    eenheid={o.eenheid}
                    prijsCent={o.prijsCent}
                    eerste
                    laatste
                    opLabel={(label) => zetOptie(o.id, { label }, false)}
                    opEenheid={(eenheid) => zetOptie(o.id, { eenheid }, true)}
                    opPrijs={(prijsCent) => zetOptie(o.id, { prijsCent }, false)}
                    opBlur={opBlur}
                    opVerberg={() => zetOptie(o.id, { verborgen: !o.verborgen }, true)}
                    opVerwijder={() =>
                      opVerwijderVraag(
                        o,
                        optieNaam,
                        () => opWijzig({ opties: werk.opties.filter((x) => x.id !== o.id) }, true),
                        () => zetOptie(o.id, { verborgen: true }, true),
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        <NieuwFormulier
          label={t.nieuweOptie(naam)}
          waarde={nieuweOptie}
          opWijzig={setNieuweOptie}
          opToevoegen={voegOptieToe}
          toevoegenLabel={t.optieToevoegen}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xl font-semibold">{t.kiesbareMaterialen(naam)}</legend>
        {materialen.length === 0 && <p className="text-tekst-zacht">{t.geenMaterialen}</p>}
        <div className="grid gap-x-6 md:grid-cols-2">
          {materialen.map((m) => (
            <Vinkje
              key={m.id}
              label={m.verborgen ? t.verborgenAchter(m.label) : m.label}
              aan={gekozen.has(m.id)}
              opWijzig={(aan) => {
                const ids = new Set(gekozen);
                if (aan) ids.add(m.id);
                else ids.delete(m.id);
                zetMaterialen(ids, standaard);
              }}
            />
          ))}
        </div>
      </fieldset>
      {gekozen.size > 0 && (
        <div className="flex max-w-md flex-col gap-2">
          <label htmlFor={`standaard-${werk.id}`} className="font-semibold">
            {t.standaardMateriaal(naam)}
          </label>
          <select
            id={`standaard-${werk.id}`}
            className={invoerKlasse}
            value={standaard}
            aria-describedby={`standaard-${werk.id}-hint`}
            onChange={(e) => zetMaterialen(gekozen, e.target.value)}
          >
            <option value="">{t.geenStandaard}</option>
            {materialen
              .filter((m) => gekozen.has(m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
          </select>
          <p id={`standaard-${werk.id}-hint`} className="text-tekst-zacht">
            {t.standaardMateriaalHint}
          </p>
        </div>
      )}
    </div>
  );
}
