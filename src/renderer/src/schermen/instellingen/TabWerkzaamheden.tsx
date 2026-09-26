import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ListChecks,
  RotateCcw,
} from 'lucide-react';
import { formatEuro } from '@shared/formatteer';
import type { Keuzeoptie, Materiaal, WerkOptie, Werkzaamheid } from '@shared/types';
import {
  pastBijSituatie,
  situatieCombinaties,
  zelfdeSituatie,
  type SituatieSleutel,
} from '@shared/werkzaamheden';
import { alsFout } from '../../api/roep';
import { herstelWerkzaamheden } from '../../api/werkzaamheden';
import { Bevestiging } from '../../componenten/Bevestiging';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { Vinkje } from '../../componenten/Vinkje';
import { useInstellingenWeergave } from '../../stores/instellingenWeergave';
import { useNavigatie } from '../../stores/navigatie';
import { sorteerOpNaam } from './werkzaamhedenGedeeld';
import {
  BtwKeuze,
  Deel,
  EenheidKeuze,
  ItemKnoppen,
  Koppen,
  MetKop,
  NaamInvoer,
  NieuwFormulier,
  PrijsInvoer,
  SetLader,
  TabKop,
  chipKlasse,
  eenheidNaam,
  invoerKlasse,
  t,
  useSetBewerker,
  type Item,
  type SetProps,
} from './werkzaamhedenOnderdelen';

// Tab Werkzaamheden (OFM-056; tot dan het tweede deel van de tab Werkzaamheden en prijzen, OFM-048/055).
// Per werkzaamheid een inklapbare kaart (standaard dicht) met in de kop naam, eenheid, prijzen en het
// aantal opties en materialen; open: prijs per eenheid, prijs per uur, btw, bij welke soorten werk hij
// hoort, kiesbare materialen (één standaard of Materiaal per daksituatie) en de opties. Alfabetisch op
// naam. **Herstel startset** herstelt werkzaamheden én materialen. De soorten werk zelf staan onder
// Keuzelijsten.

const RIJ_OPTIE = 'grid grid-cols-[minmax(0,1fr)_7rem_9rem_auto] items-center gap-3';

export function TabWerkzaamheden() {
  return <SetLader kind={(props) => <WerkBewerker {...props} />} />;
}

function WerkBewerker({ beginSet, soorten, ondergronden, bedekkingen, opHersteld }: SetProps) {
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const openWerk = useInstellingenWeergave((s) => s.openWerk);
  const zetWerkOpen = useInstellingenWeergave((s) => s.zetWerkOpen);
  const zetAlleWerk = useInstellingenWeergave((s) => s.zetAlleWerk);
  const b = useSetBewerker(beginSet, soorten);
  const { set } = b;
  const [nieuwWerk, setNieuwWerk] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [herstellen, setHerstellen] = useState(false);
  const [herstelFout, setHerstelFout] = useState<ReturnType<typeof alsFout> | null>(null);

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
      perSituatie: false,
      situaties: [],
    };
    setNieuwWerk('');
    zetWerkOpen(nieuw.id, true);
    setFocusId(nieuw.id);
    b.wijzig({ ...set, werkzaamheden: [...set.werkzaamheden, nieuw] }, true);
  };

  const combinaties = situatieCombinaties(ondergronden, bedekkingen);
  const gesorteerd = sorteerOpNaam(set.werkzaamheden, b.werkNamen);
  const ids = set.werkzaamheden.map((w) => w.id);

  return (
    <div className="flex flex-col gap-10">
      <TabKop uitleg={t.uitlegWerkzaamheden} signaal={b.bewaren.signaal} />
      {b.meldingen}
      {herstelFout && <Foutmelding fout={herstelFout} />}

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
          <>
            <div className="flex flex-wrap gap-3">
              <Knop
                label={t.allesOpenen}
                icoon={ChevronsUpDown}
                variant="secundair"
                onClick={() => zetAlleWerk(ids, true)}
              />
              <Knop
                label={t.allesSluiten}
                icoon={ChevronsDownUp}
                variant="secundair"
                onClick={() => zetAlleWerk(ids, false)}
              />
            </div>
            <ul aria-label={t.werkzaamheden} className="flex flex-col gap-4">
              {gesorteerd.map((w) => {
                const naam = b.werkNaam(w);
                return (
                  <WerkKaart
                    key={w.id}
                    werk={w}
                    naam={naam}
                    open={openWerk[w.id] === true}
                    focus={focusId === w.id}
                    opOpen={(open) => zetWerkOpen(w.id, open)}
                    soorten={soorten}
                    materialen={set.materialen}
                    combinaties={combinaties}
                    ondergronden={ondergronden}
                    bedekkingen={bedekkingen}
                    bewaardeOpties={beginSet.werkzaamheden.find((x) => x.id === w.id)?.opties ?? []}
                    opWijzig={(deel, direct) => b.zetWerk(w.id, deel, direct)}
                    opBlur={b.bewaren.bewaarNu}
                    opVerwijder={() =>
                      b.vraagVerwijderen(
                        w,
                        naam,
                        () =>
                          b.wijzig(
                            { ...set, werkzaamheden: set.werkzaamheden.filter((x) => x.id !== w.id) },
                            true,
                          ),
                        () => b.zetWerk(w.id, { verborgen: true }, true),
                      )
                    }
                    opVerwijderVraag={b.vraagVerwijderen}
                  />
                );
              })}
            </ul>
          </>
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

      <div className="flex flex-col gap-2">
        <p className="max-w-3xl text-tekst-zacht">{t.herstelUitleg}</p>
        <div>
          <Knop label={t.herstel} icoon={RotateCcw} variant="secundair" onClick={() => setHerstellen(true)} />
        </div>
      </div>

      {b.verwijderVragen}
      <Bevestiging
        open={herstellen}
        titel={t.herstelTitel}
        bevestigLabel={t.herstelJa}
        annuleerLabel={t.herstelNee}
        opAnnuleer={() => setHerstellen(false)}
        opBevestig={() => {
          setHerstellen(false);
          // Eerst een wachtende wijziging wegschrijven, dan herstellen en opnieuw laden.
          b.bewaren.bewaarNu();
          herstelWerkzaamheden().then(opHersteld, (e: unknown) => setHerstelFout(alsFout(e)));
        }}
      >
        <p>{t.herstelTekst}</p>
      </Bevestiging>
    </div>
  );
}

/** Korte samenvatting in de kop van een dichte kaart. */
function samenvatting(werk: Werkzaamheid): string {
  const prijs = (cent: number | null) => (cent === null ? t.geenPrijs : formatEuro(cent));
  return [
    eenheidNaam[werk.eenheid],
    t.kopPrijs(prijs(werk.prijsCent)),
    t.kopUurprijs(prijs(werk.uurprijsCent)),
    t.aantalOpties(werk.opties.length),
    t.aantalMaterialen(werk.materialen.length),
  ].join(' · ');
}

/**
 * Eén werkzaamheid als inklapbare kaart: in de kop de naam (knop met `aria-expanded`) en de samenvatting;
 * open de velden, soorten werk, materialen en opties.
 */
function WerkKaart({
  werk,
  naam,
  open,
  focus,
  opOpen,
  soorten,
  materialen,
  combinaties,
  ondergronden,
  bedekkingen,
  bewaardeOpties,
  opWijzig,
  opBlur,
  opVerwijder,
  opVerwijderVraag,
}: {
  werk: Werkzaamheid;
  naam: string;
  open: boolean;
  /** Net toegevoegd: focus op het naamveld. */
  focus: boolean;
  opOpen: (open: boolean) => void;
  soorten: Keuzeoptie[];
  materialen: Materiaal[];
  /** OFM-055: de situatieknoppen (ondergrond × bedekking). */
  combinaties: SituatieSleutel[];
  ondergronden: Keuzeoptie[];
  bedekkingen: Keuzeoptie[];
  bewaardeOpties: WerkOptie[];
  opWijzig: (deel: Partial<Werkzaamheid>, direct: boolean) => void;
  opBlur: () => void;
  opVerwijder: () => void;
  opVerwijderVraag: (item: Item, naam: string, verwijder: () => void, verberg: () => void) => void;
}) {
  const inhoudId = `werk-inhoud-${werk.id}`;
  return (
    <li aria-label={naam} className="flex flex-col rounded-knop border-2 border-rand">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 p-2">
        <h3 className="text-xl font-semibold">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={inhoudId}
            onClick={() => opOpen(!open)}
            className="inline-flex min-h-12 items-center gap-2 rounded-knop px-2 text-left hover:text-accent"
          >
            {open ? (
              <ChevronDown aria-hidden="true" className="size-6" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-6" />
            )}
            <span>{naam}</span>
          </button>
        </h3>
        {werk.verborgen && (
          <span className="rounded-full bg-vlak px-3 py-1 text-tekst-zacht">{t.verborgen}</span>
        )}
        <span className="text-tekst-zacht tabular-nums">{samenvatting(werk)}</span>
      </div>
      {open && (
        <div id={inhoudId} className="border-t-2 border-rand p-4">
          <WerkInhoud
            werk={werk}
            naam={naam}
            focus={focus}
            soorten={soorten}
            materialen={materialen}
            combinaties={combinaties}
            ondergronden={ondergronden}
            bedekkingen={bedekkingen}
            bewaardeOpties={bewaardeOpties}
            opWijzig={opWijzig}
            opBlur={opBlur}
            opVerwijder={opVerwijder}
            opVerwijderVraag={opVerwijderVraag}
          />
        </div>
      )}
    </li>
  );
}

function WerkInhoud({
  werk,
  naam,
  focus,
  soorten,
  materialen,
  combinaties,
  ondergronden,
  bedekkingen,
  bewaardeOpties,
  opWijzig,
  opBlur,
  opVerwijder,
  opVerwijderVraag,
}: {
  werk: Werkzaamheid;
  naam: string;
  focus: boolean;
  soorten: Keuzeoptie[];
  materialen: Materiaal[];
  combinaties: SituatieSleutel[];
  ondergronden: Keuzeoptie[];
  bedekkingen: Keuzeoptie[];
  bewaardeOpties: WerkOptie[];
  opWijzig: (deel: Partial<Werkzaamheid>, direct: boolean) => void;
  opBlur: () => void;
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
  // OFM-056: ook de materialen alfabetisch.
  const materialenAbc = sorteerOpNaam(materialen);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-72 flex-1">
          <NaamInvoer
            label={t.werkNaam(naam)}
            item={werk}
            focus={focus}
            opWijzig={(label) => opWijzig({ label }, false)}
            opBlur={opBlur}
          />
        </div>
        <ItemKnoppen
          naam={naam}
          item={werk}
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
          {materialenAbc.map((m) => (
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
        <Vinkje
          label={t.situatie.vinkje}
          hint={t.situatie.vinkjeHint}
          aan={werk.perSituatie}
          opWijzig={(perSituatie) => opWijzig({ perSituatie }, true)}
        />
      )}
      {gekozen.size > 0 && werk.perSituatie && (
        <SituatieBlok
          werk={werk}
          naam={naam}
          materialen={materialen.filter((m) => gekozen.has(m.id))}
          combinaties={combinaties}
          ondergronden={ondergronden}
          bedekkingen={bedekkingen}
          opWijzig={(situaties) => opWijzig({ situaties }, true)}
        />
      )}
      {gekozen.size > 0 && !werk.perSituatie && (
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
            {materialenAbc
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
        <h4 className="text-lg font-semibold">{t.opties(naam)}</h4>
        <p className="text-tekst-zacht">{t.optiesUitleg}</p>
        {werk.opties.length === 0 ? (
          <p className="text-tekst-zacht">{t.geenOpties}</p>
        ) : (
          <>
            <Koppen klasse={RIJ_OPTIE} koppen={[t.naam, t.eenheid, t.prijs]} />
            <ul aria-label={t.opties(naam)} className="flex flex-col">
              {werk.opties.map((o) => {
                const optieNaam =
                  bewaardeOpties.find((x) => x.id === o.id)?.label ?? (o.label.trim() || t.naam);
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
    </div>
  );
}

/**
 * OFM-055: bij een werkzaamheid met Materiaal per daksituatie één knop per combinatie ondergrond ×
 * nieuwe dakbedekking (met het aantal materialen) en voor de gekozen situatie vinkjes voor de kiesbare
 * materialen waarvan de tags passen.
 */
function SituatieBlok({
  werk,
  naam,
  materialen,
  combinaties,
  ondergronden,
  bedekkingen,
  opWijzig,
}: {
  werk: Werkzaamheid;
  naam: string;
  /** De kiesbare materialen van deze werkzaamheid. */
  materialen: Materiaal[];
  combinaties: SituatieSleutel[];
  ondergronden: Keuzeoptie[];
  bedekkingen: Keuzeoptie[];
  opWijzig: (situaties: Werkzaamheid['situaties']) => void;
}) {
  const [gekozen, setGekozen] = useState<SituatieSleutel | null>(null);
  const actief = combinaties.find((c) => gekozen !== null && zelfdeSituatie(c, gekozen)) ?? combinaties[0];
  const label = (lijst: Keuzeoptie[], sleutel: string) =>
    lijst.find((o) => o.sleutel === sleutel)?.label ?? sleutel;
  const naamVan = (c: SituatieSleutel) =>
    t.situatie.combinatie(label(ondergronden, c.ondergrond), label(bedekkingen, c.bedekking));
  const idsVan = (c: SituatieSleutel) => werk.situaties.find((s) => zelfdeSituatie(s, c))?.materiaalIds ?? [];

  if (!actief) return <p className="text-tekst-zacht">{t.situatie.geenCombinaties}</p>;
  const passend = sorteerOpNaam(
    materialen.filter((m) =>
      pastBijSituatie(m, { ondergrond: actief.ondergrond, nieuweBedekking: actief.bedekking }),
    ),
  );
  const ids = new Set(idsVan(actief));
  const zet = (materiaalId: string, aan: boolean) => {
    const nieuw = new Set(ids);
    if (aan) nieuw.add(materiaalId);
    else nieuw.delete(materiaalId);
    const materiaalIds = materialen.filter((m) => nieuw.has(m.id)).map((m) => m.id);
    const zonder = werk.situaties.filter((s) => !zelfdeSituatie(s, actief));
    opWijzig(materiaalIds.length > 0 ? [...zonder, { ...actief, materiaalIds }] : zonder);
  };

  return (
    <div className="flex flex-col gap-4 border-l-4 border-accent pl-4">
      <div role="group" aria-label={t.situatie.knoppen(naam)} className="flex flex-wrap gap-3">
        {combinaties.map((c) => {
          const aan = zelfdeSituatie(c, actief);
          const n = idsVan(c).length;
          return (
            <button
              key={`${c.ondergrond}|${c.bedekking}`}
              type="button"
              aria-pressed={aan}
              onClick={() => setGekozen(c)}
              className={chipKlasse(aan).replace('text-tekst-zacht', 'text-tekst')}
            >
              <span>{naamVan(c)}</span>
              <span className="rounded-full bg-vlak px-2 text-tekst">
                <span aria-hidden="true">{n}</span>
                <span className="sr-only">{`, ${t.situatie.teller(n)}`}</span>
              </span>
            </button>
          );
        })}
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 font-semibold">{t.situatie.materialen(naamVan(actief), naam)}</legend>
        {passend.length === 0 ? (
          <p className="text-tekst-zacht">{t.situatie.geenPassend}</p>
        ) : (
          <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {passend.map((m) => (
              <Vinkje key={m.id} label={m.label} aan={ids.has(m.id)} opWijzig={(aan) => zet(m.id, aan)} />
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
