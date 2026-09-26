import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ListChecks, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { euroNaarCent } from '@shared/calc/bedragen';
import type {
  BtwTarief,
  Eenheid,
  Keuzeoptie,
  Materiaal,
  Prijspost,
  WerkOptie,
  Werkzaamheid,
  WerkzaamhedenSet,
} from '@shared/types';
import { geldigeDaksystemen, prijsGroep } from '@shared/werkzaamheden';
import { useKeuzelijsten } from '../../api/keuzelijsten';
import { bewaarPrijspost, usePrijzen } from '../../api/prijzen';
import { alsFout } from '../../api/roep';
import {
  alsBewaarInvoer,
  bewaarWerkzaamheden,
  herstelWerkzaamheden,
  useWerkzaamheden,
} from '../../api/werkzaamheden';
import { Bevestiging } from '../../componenten/Bevestiging';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { useSelecteerBijFocus } from '../../componenten/GetalVeld';
import { Knop } from '../../componenten/Knop';
import { Veld } from '../../componenten/Veld';
import { Vinkje } from '../../componenten/Vinkje';
import { leesGetal, schoonGetalInvoer, toonGetal } from '../../componenten/getalNotatie';
import { useNavigatie } from '../../stores/navigatie';
import { SectieDaksystemen } from './SectieDaksystemen';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';

// Tab Werkzaamheden en prijzen (OFM-048, vervangt de tabs Prijzen (OFM-018) en Werkzaamheden (OFM-043)).
// Drie secties: (1) Materialen met naam, eenheid, prijs en btw; (2) Werkzaamheden met naam, eenheid,
// prijs per eenheid, prijs per uur, btw, bij welke soorten werk ze horen, kiesbare materialen (één
// standaard) en daaronder de opties; (3) Overige prijzen: de vaste posten (steiger, verzekerde garantie,
// voorrijkosten) via `prijzen:bewaar`. Sinds OFM-051 tussen 2 en 3 de sectie Standaardmaterialen per
// daksysteem (`SectieDaksystemen.tsx`), die met de set meebewaart. Secties 1 en 2 bewaren als geheel via `werkzaamheden:bewaar`
// (FE-075): namen en prijzen na 800 ms of bij verlaten van het veld, vinkjes en knoppen meteen. Een nieuw
// item krijgt hier al een id. De soorten werk zelf staan onder Keuzelijsten.

const t = nl.werkzaamheden;
const eenheidNaam = nl.instellingen.prijzen.eenheden;
const EENHEDEN: Eenheid[] = ['m²', 'm¹', 'stuk', 'post', 'uur', 'dag'];
const TARIEVEN: BtwTarief[] = [21, 9, 0];
const invoerKlasse =
  'min-h-12 w-full rounded-knop border-2 border-rand bg-achtergrond px-3 py-2 aria-[invalid=true]:border-fout';
/** Materiaalrij en optierij: naam, eenheid, prijs, (btw,) knoppen. */
const RIJ_MATERIAAL = 'grid grid-cols-[minmax(0,1fr)_7rem_9rem_5.5rem_auto] items-center gap-3';
const RIJ_OPTIE = 'grid grid-cols-[minmax(0,1fr)_7rem_9rem_auto] items-center gap-3';
const RIJ_OVERIG = 'grid grid-cols-[minmax(0,1fr)_7rem_9rem_5.5rem] items-center gap-3';

type Item = { id: string; label: string; verborgen: boolean; inGebruik: boolean };
type TeVerwijderen = { label: string; inGebruik: boolean; verwijder: () => void; verberg: () => void };

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

export function TabWerkzaamhedenPrijzen() {
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
      ondergronden={keuzes.data.ondergrond}
      bedekkingen={keuzes.data.nieuweBedekking}
      opHersteld={() => void werk.refetch().then(() => setVersie((v) => v + 1))}
      overig={<OverigePrijzen />}
    />
  );
}

function Bewerker({
  beginSet,
  soorten,
  ondergronden,
  bedekkingen,
  opHersteld,
  overig,
}: {
  beginSet: WerkzaamhedenSet;
  soorten: Keuzeoptie[];
  ondergronden: Keuzeoptie[];
  bedekkingen: Keuzeoptie[];
  opHersteld: () => void;
  overig: ReactNode;
}) {
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const [set, setSet] = useState(beginSet);
  const [nieuwWerk, setNieuwWerk] = useState('');
  const [nieuwMateriaal, setNieuwMateriaal] = useState('');
  const [teVerwijderen, setTeVerwijderen] = useState<TeVerwijderen | null>(null);
  const [herstellen, setHerstellen] = useState(false);
  const [herstelFout, setHerstelFout] = useState<ReturnType<typeof alsFout> | null>(null);
  const [vervallen, setVervallen] = useState<string | null>(null);
  // "Bewaard ✓" bij de sectie waar de wijziging vandaan kwam (niet twee keer tegelijk).
  const [inDaksysteem, setInDaksysteem] = useState(false);

  const soortSleutels = useRef(new Set(soorten.map((s) => s.sleutel)));
  useEffect(() => {
    soortSleutels.current = new Set(soorten.map((s) => s.sleutel));
  }, [soorten]);

  const bewaren = useAutoBewaar(
    (waarde: WerkzaamhedenSet) => bewaarWerkzaamheden(alsBewaarInvoer(waarde, soortSleutels.current)),
    allesBenoemd,
  );

  const wijzig = (gewijzigd: WerkzaamhedenSet, direct: boolean, daksysteem = false) => {
    setInDaksysteem(daksysteem);
    // OFM-051: een afwijking per daksysteem met een materiaal dat niet meer kiesbaar is, vervalt (melding).
    const { regels, vervallen: aantal } = geldigeDaksystemen(gewijzigd.daksystemen, gewijzigd.werkzaamheden);
    const nieuw = { ...gewijzigd, daksystemen: regels };
    setVervallen(aantal > 0 ? t.daksysteem.vervallen(aantal) : null);
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
      uurprijsCent: null,
      btwTarief: 21,
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
      btwTarief: 21,
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
        daksystemen: set.daksystemen,
      },
      true,
    );
  const vraagVerwijderen = (item: Item, naam: string, verwijder: () => void, verberg: () => void) =>
    setTeVerwijderen({ label: naam, inGebruik: item.inGebruik, verwijder, verberg });

  const materiaalNamen = beginSetLabels(beginSet.materialen, set.materialen);
  const werkNamen = beginSetLabels(beginSet.werkzaamheden, set.werkzaamheden);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-3xl text-tekst-zacht">{t.uitleg}</p>
        <BewaardIndicator signaal={inDaksysteem ? 0 : bewaren.signaal} />
      </div>
      {bewaren.fout && <Foutmelding fout={bewaren.fout} />}
      {herstelFout && <Foutmelding fout={herstelFout} />}

      {/* 1. Materialen */}
      <Deel titel={t.materialen} uitleg={t.materialenUitleg}>
        {set.materialen.length === 0 ? (
          <p className="text-tekst-zacht">{t.geenMaterialenLijst}</p>
        ) : (
          <>
            <Koppen klasse={RIJ_MATERIAAL} koppen={[t.naam, t.eenheid, t.prijs, t.btw]} />
            <ul aria-label={t.materialen} className="flex flex-col">
              {set.materialen.map((m, index) => {
                const naam = naamVan(m, materiaalNamen);
                return (
                  <li key={m.id} className={`${RIJ_MATERIAAL} border-b border-rand px-2 py-2`}>
                    <NaamInvoer
                      label={t.materiaalNaam(naam)}
                      item={m}
                      opWijzig={(label) => zetMateriaal(m.id, { label }, false)}
                      opBlur={bewaren.bewaarNu}
                    />
                    <EenheidKeuze
                      label={t.materiaalEenheid(naam)}
                      waarde={m.eenheid}
                      opWijzig={(eenheid) => zetMateriaal(m.id, { eenheid }, true)}
                    />
                    <PrijsInvoer
                      label={t.materiaalPrijs(naam)}
                      prijsCent={m.prijsCent}
                      opWijzig={(prijsCent) => zetMateriaal(m.id, { prijsCent }, false)}
                      opBlur={bewaren.bewaarNu}
                    />
                    <BtwKeuze
                      label={t.materiaalBtw(naam)}
                      waarde={m.btwTarief}
                      opWijzig={(btwTarief) => zetMateriaal(m.id, { btwTarief }, true)}
                    />
                    <ItemKnoppen
                      naam={naam}
                      item={m}
                      eerste={index === 0}
                      laatste={index === set.materialen.length - 1}
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
          </>
        )}
        <NieuwFormulier
          label={t.nieuwMateriaal}
          hint={t.nieuwMateriaalHint}
          waarde={nieuwMateriaal}
          opWijzig={setNieuwMateriaal}
          opToevoegen={voegMateriaalToe}
          toevoegenLabel={t.materiaalToevoegen}
        />
      </Deel>

      {/* 2. Werkzaamheden */}
      <Deel titel={t.werkzaamheden} uitleg={t.werkzaamhedenUitleg}>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-tekst-zacht">{t.soortenElders}</p>
          <Knop
            label={t.naarKeuzelijsten}
            icoon={ListChecks}
            variant="secundair"
            onClick={() => gaNaar({ scherm: 'instellingen', instellingenTab: 'keuzelijsten' })}
          />
        </div>
        {set.werkzaamheden.length === 0 ? (
          <p className="text-tekst-zacht">{t.geenWerkzaamheden}</p>
        ) : (
          <ul aria-label={t.werkzaamheden} className="flex flex-col gap-6">
            {set.werkzaamheden.map((w, index) => {
              const naam = naamVan(w, werkNamen);
              return (
                <WerkKaart
                  key={w.id}
                  werk={w}
                  naam={naam}
                  soorten={soorten}
                  materialen={set.materialen}
                  bewaardeOpties={beginSet.werkzaamheden.find((b) => b.id === w.id)?.opties ?? []}
                  eerste={index === 0}
                  laatste={index === set.werkzaamheden.length - 1}
                  opWijzig={(deel, direct) => zetWerk(w.id, deel, direct)}
                  opBlur={bewaren.bewaarNu}
                  opVerplaats={(r) =>
                    wijzig({ ...set, werkzaamheden: verplaats(set.werkzaamheden, index, r) }, true)
                  }
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
                  opVerwijderVraag={vraagVerwijderen}
                />
              );
            })}
          </ul>
        )}
        <NieuwFormulier
          label={t.nieuwWerk}
          hint={t.nieuwWerkHint}
          waarde={nieuwWerk}
          opWijzig={setNieuwWerk}
          opToevoegen={voegWerkToe}
          toevoegenLabel={t.werkToevoegen}
        />
      </Deel>

      {/* OFM-051: Standaardmaterialen per daksysteem */}
      <SectieDaksystemen
        set={set}
        ondergronden={ondergronden}
        bedekkingen={bedekkingen}
        opWijzig={(daksystemen) => wijzig({ ...set, daksystemen }, true, true)}
        signaal={inDaksysteem ? bewaren.signaal : 0}
        melding={vervallen}
      />

      {/* 3. Overige prijzen */}
      {overig}

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

/** Kolomkoppen boven een lijst (alleen visueel; elk veld heeft een eigen toegankelijke naam). */
function Koppen({ klasse, koppen }: { klasse: string; koppen: string[] }) {
  return (
    <div aria-hidden="true" className={`${klasse} border-b-2 border-rand px-2 pb-2 font-semibold`}>
      {koppen.map((kop) => (
        <span key={kop}>{kop}</span>
      ))}
    </div>
  );
}

function NieuwFormulier({
  label,
  hint,
  waarde,
  opWijzig,
  opToevoegen,
  toevoegenLabel,
}: {
  label: string;
  hint?: string;
  waarde: string;
  opWijzig: (waarde: string) => void;
  opToevoegen: () => void;
  toevoegenLabel: string;
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

function NaamInvoer({
  label,
  item,
  opWijzig,
  opBlur,
}: {
  label: string;
  item: Item;
  opWijzig: (label: string) => void;
  opBlur: () => void;
}) {
  const leeg = item.label.trim() === '';
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <input
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

function EenheidKeuze({
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

function BtwKeuze({
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

/** Volgorde, verbergen en verwijderen. */
function ItemKnoppen({
  naam,
  item,
  eerste,
  laatste,
  opVerplaats,
  opVerberg,
  opVerwijder,
}: {
  naam: string;
  item: Item;
  eerste: boolean;
  laatste: boolean;
  opVerplaats?: (richting: -1 | 1) => void;
  opVerberg: () => void;
  opVerwijder: () => void;
}) {
  return (
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
    </div>
  );
}

/** Eén veld met een zichtbaar kopje erboven (de toegankelijke naam staat op het veld zelf). */
function MetKop({ kop, children }: { kop: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden="true" className="font-semibold">
        {kop}
      </span>
      {children}
    </div>
  );
}

/**
 * Eén werkzaamheid: naam en knoppen, eenheid, prijs per eenheid, prijs per uur en btw, bij welke soorten
 * werk hij hoort, kiesbare materialen met één standaard, en daaronder de opties.
 */
function WerkKaart({
  werk,
  naam,
  soorten,
  materialen,
  bewaardeOpties,
  eerste,
  laatste,
  opWijzig,
  opBlur,
  opVerplaats,
  opVerwijder,
  opVerwijderVraag,
}: {
  werk: Werkzaamheid;
  naam: string;
  soorten: Keuzeoptie[];
  materialen: Materiaal[];
  bewaardeOpties: WerkOptie[];
  eerste: boolean;
  laatste: boolean;
  opWijzig: (deel: Partial<Werkzaamheid>, direct: boolean) => void;
  opBlur: () => void;
  opVerplaats: (richting: -1 | 1) => void;
  opVerwijder: () => void;
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
  const standaardId = `standaard-${werk.id}`;

  return (
    <li aria-label={naam} className="flex flex-col gap-5 rounded-knop border-2 border-rand p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-72 flex-1">
          <NaamInvoer
            label={t.werkNaam(naam)}
            item={werk}
            opWijzig={(label) => opWijzig({ label }, false)}
            opBlur={opBlur}
          />
        </div>
        <ItemKnoppen
          naam={naam}
          item={werk}
          eerste={eerste}
          laatste={laatste}
          opVerplaats={opVerplaats}
          opVerberg={() => opWijzig({ verborgen: !werk.verborgen }, true)}
          opVerwijder={opVerwijder}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetKop kop={t.eenheid}>
          <EenheidKeuze
            label={t.werkEenheid(naam)}
            waarde={werk.eenheid}
            opWijzig={(eenheid) => opWijzig({ eenheid }, true)}
          />
        </MetKop>
        <MetKop kop={t.prijsPerEenheid}>
          <PrijsInvoer
            label={t.werkPrijs(naam)}
            prijsCent={werk.prijsCent}
            opWijzig={(prijsCent) => opWijzig({ prijsCent }, false)}
            opBlur={opBlur}
          />
        </MetKop>
        <MetKop kop={t.prijsPerUur}>
          <PrijsInvoer
            label={t.werkUurprijs(naam)}
            prijsCent={werk.uurprijsCent}
            opWijzig={(uurprijsCent) => opWijzig({ uurprijsCent }, false)}
            opBlur={opBlur}
          />
        </MetKop>
        <MetKop kop={t.btw}>
          <BtwKeuze
            label={t.werkBtw(naam)}
            waarde={werk.btwTarief}
            opWijzig={(btwTarief) => opWijzig({ btwTarief }, true)}
          />
        </MetKop>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-lg font-semibold">{t.hoortBij(naam)}</legend>
        <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {soorten.map((soort) => (
            <Vinkje
              key={soort.id}
              label={soort.verborgen ? t.verborgenAchter(soort.label) : soort.label}
              aan={werk.soortenWerk.includes(soort.sleutel)}
              opWijzig={(aan) =>
                opWijzig(
                  {
                    soortenWerk: aan
                      ? [...werk.soortenWerk, soort.sleutel]
                      : werk.soortenWerk.filter((s) => s !== soort.sleutel),
                  },
                  true,
                )
              }
            />
          ))}
        </div>
        {!werk.soortenWerk.some((s) => soorten.some((x) => x.sleutel === s)) && (
          <p className="text-tekst-zacht">{t.hoortBijNiets}</p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-lg font-semibold">{t.kiesbareMaterialen(naam)}</legend>
        {materialen.length === 0 && <p className="text-tekst-zacht">{t.geenMaterialen}</p>}
        <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
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
          <label htmlFor={standaardId} className="font-semibold">
            {t.standaardMateriaal(naam)}
          </label>
          <select
            id={standaardId}
            className={invoerKlasse}
            value={standaard}
            aria-describedby={`${standaardId}-hint`}
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
          <p id={`${standaardId}-hint`} className="text-tekst-zacht">
            {t.standaardMateriaalHint}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-l-4 border-rand pl-4">
        <h3 className="text-lg font-semibold">{t.opties(naam)}</h3>
        <p className="text-tekst-zacht">{t.optiesUitleg}</p>
        {werk.opties.length === 0 ? (
          <p className="text-tekst-zacht">{t.geenOpties}</p>
        ) : (
          <>
            <Koppen klasse={RIJ_OPTIE} koppen={[t.naam, t.eenheid, t.prijs]} />
            <ul aria-label={t.opties(naam)} className="flex flex-col">
              {werk.opties.map((o) => {
                const optieNaam =
                  bewaardeOpties.find((b) => b.id === o.id)?.label ?? (o.label.trim() || t.naam);
                return (
                  <li key={o.id} className={`${RIJ_OPTIE} border-b border-rand px-2 py-2`}>
                    <NaamInvoer
                      label={t.optieNaam(optieNaam, naam)}
                      item={o}
                      opWijzig={(label) => zetOptie(o.id, { label }, false)}
                      opBlur={opBlur}
                    />
                    <EenheidKeuze
                      label={t.optieEenheid(optieNaam, naam)}
                      waarde={o.eenheid}
                      opWijzig={(eenheid) => zetOptie(o.id, { eenheid }, true)}
                    />
                    <PrijsInvoer
                      label={t.optiePrijs(optieNaam, naam)}
                      prijsCent={o.prijsCent}
                      opWijzig={(prijsCent) => zetOptie(o.id, { prijsCent }, false)}
                      opBlur={opBlur}
                    />
                    <ItemKnoppen
                      naam={optieNaam}
                      item={o}
                      eerste
                      laatste
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
          </>
        )}
        <NieuwFormulier
          label={t.nieuweOptie(naam)}
          waarde={nieuweOptie}
          opWijzig={setNieuweOptie}
          opToevoegen={voegOptieToe}
          toevoegenLabel={t.optieToevoegen}
        />
      </div>
    </li>
  );
}

/** Sectie 3: de vaste posten (steiger, verzekerde garantie, voorrijkosten) via `prijzen:bewaar`. */
function OverigePrijzen() {
  const prijzen = usePrijzen();
  const [signaal, setSignaal] = useState(0);
  const [fout, setFout] = useState<ReturnType<typeof alsFout> | null>(null);
  const opBewaard = () => {
    setFout(null);
    setSignaal((s) => s + 1);
  };

  if (prijzen.isError)
    return <Foutmelding fout={alsFout(prijzen.error)} opnieuw={() => void prijzen.refetch()} />;
  if (!prijzen.data) return <p role="status">{nl.algemeen.laden}</p>;
  const posten = prijzen.data.filter((p) => prijsGroep(p.sleutel) === null);
  if (posten.length === 0) return null;

  return (
    <Deel titel={t.overig} uitleg={t.overigUitleg}>
      <div className="flex justify-end">
        <BewaardIndicator signaal={signaal} />
      </div>
      {fout && <Foutmelding fout={fout} />}
      <Koppen klasse={RIJ_OVERIG} koppen={[t.naam, t.eenheid, t.prijs, t.btw]} />
      <ul aria-label={t.overig} className="flex flex-col">
        {posten.map((post) => (
          <OverigeRij key={post.id} post={post} opBewaard={opBewaard} opFout={setFout} />
        ))}
      </ul>
    </Deel>
  );
}

function OverigeRij({
  post,
  opBewaard,
  opFout,
}: {
  post: Prijspost;
  opBewaard: () => void;
  opFout: (fout: ReturnType<typeof alsFout>) => void;
}) {
  const [rij, setRij] = useState(post);
  const bewaren = useAutoBewaar(
    (waarde: Prijspost) => bewaarPrijspost(waarde).then(opBewaard, (e: unknown) => opFout(alsFout(e))),
    (waarde) => waarde.omschrijving.trim() !== '',
  );
  const naam = post.omschrijving;
  const wijzig = (deel: Partial<Prijspost>, direct = false) => {
    const nieuw = { ...rij, ...deel };
    setRij(nieuw);
    if (direct) bewaren.bewaarDirect(nieuw);
    else bewaren.wijzig(nieuw);
  };
  const leeg = rij.omschrijving.trim() === '';

  return (
    <li className={`${RIJ_OVERIG} border-b border-rand px-2 py-2`}>
      <input
        className={invoerKlasse}
        aria-label={t.postOmschrijving(naam)}
        aria-invalid={leeg || undefined}
        title={leeg ? t.omschrijvingFout : undefined}
        value={rij.omschrijving}
        onChange={(e) => wijzig({ omschrijving: e.target.value })}
        onBlur={bewaren.bewaarNu}
      />
      <span className="px-3">{eenheidNaam[rij.eenheid]}</span>
      <PrijsInvoer
        label={t.postPrijs(naam)}
        prijsCent={rij.prijsCent}
        opWijzig={(prijsCent) => wijzig({ prijsCent })}
        opBlur={bewaren.bewaarNu}
      />
      <BtwKeuze
        label={t.postBtw(naam)}
        waarde={rij.btwTarief}
        opWijzig={(btwTarief) => wijzig({ btwTarief }, true)}
      />
    </li>
  );
}
