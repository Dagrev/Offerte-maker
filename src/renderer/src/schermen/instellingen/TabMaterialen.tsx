import { useId, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Trash2,
} from 'lucide-react';
import type { Categorie, Keuzeoptie, Materiaal, MateriaalTags, Prijspost } from '@shared/types';
import {
  ALLE_TAGS,
  CATEGORIE_OVERIG,
  ONDERGROND_ONBEKEND,
  categorieVan,
  groepeerOpCategorie,
  prijsGroep,
  zetTag,
  type TagGroep,
} from '@shared/werkzaamheden';
import { bewaarPrijspost, usePrijzen } from '../../api/prijzen';
import { alsFout } from '../../api/roep';
import { Bevestiging } from '../../componenten/Bevestiging';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { useInstellingenWeergave } from '../../stores/instellingenWeergave';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';
import { categorieNaamFout, sorteerOpNaam, zoekOpNaam } from './werkzaamhedenGedeeld';
import {
  BtwKeuze,
  Deel,
  EenheidKeuze,
  ItemKnoppen,
  Koppen,
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
  type SetProps,
} from './werkzaamhedenOnderdelen';

// Tab Materialen en prijzen (OFM-056; tot dan het eerste deel van de tab Werkzaamheden en prijzen,
// OFM-048/055). Materialen met naam, eenheid, prijs, btw, categorie en tags (ondergrond en nieuwe
// dakbedekking), doorzoekbaar; daaronder de Overige prijzen (steiger, verzekerde garantie, voorrijkosten)
// via `prijzen:bewaar`. OFM-057: de materialen staan per categorie in inklapbare groepen (standaard open,
// binnen een groep alfabetisch) en bovenaan staat het inklapbare blok Categorieën (toevoegen, hernoemen,
// volgorde, verwijderen; Overig is vast). Welke materialen bij een werkzaamheid kiesbaar zijn, staat in de
// tab Werkzaamheden.

/** Materiaalrij: naam, eenheid, prijs, btw, categorie, knoppen. */
const RIJ_MATERIAAL = 'grid grid-cols-[minmax(0,1fr)_7rem_9rem_5.5rem_11rem_auto] items-center gap-3';
const RIJ_OVERIG = 'grid grid-cols-[minmax(0,1fr)_7rem_9rem_5.5rem] items-center gap-3';
const tc = t.categorie;

export function TabMaterialen() {
  return (
    <div className="flex flex-col gap-10">
      <SetLader kind={(props) => <MaterialenBewerker {...props} />} />
      <OverigePrijzen />
    </div>
  );
}

function MaterialenBewerker({ beginSet, soorten, ondergronden, bedekkingen }: SetProps) {
  const b = useSetBewerker(beginSet, soorten);
  const { set } = b;
  const dicht = useInstellingenWeergave((s) => s.dichteCategorieen);
  const zetCategorieOpen = useInstellingenWeergave((s) => s.zetCategorieOpen);
  const openCategorieen = useInstellingenWeergave((s) => s.openCategorieen);
  const zetAlleCategorieen = useInstellingenWeergave((s) => s.zetAlleCategorieen);
  const [nieuwMateriaal, setNieuwMateriaal] = useState('');
  const [zoekterm, setZoekterm] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);

  const voegMateriaalToe = (label: string, categorieId: string | null) => {
    const naam = label.trim();
    if (naam === '') return;
    const nieuw: Materiaal = {
      id: crypto.randomUUID(),
      sleutel: '',
      label: naam,
      eenheid: 'm²',
      prijsCent: null,
      btwTarief: 21,
      verborgen: false,
      standaard: false,
      inGebruik: false,
      tags: ALLE_TAGS,
      categorieId: categorieId === CATEGORIE_OVERIG ? null : categorieId,
    };
    // Het nieuwe materiaal moet zichtbaar zijn: zoeken wissen en zijn groep openen.
    setZoekterm('');
    zetCategorieOpen(categorieId ?? CATEGORIE_OVERIG, true);
    setFocusId(nieuw.id);
    b.wijzig({ ...set, materialen: [...set.materialen, nieuw] }, true);
  };
  const verwijderMateriaal = (id: string) =>
    b.wijzig(
      {
        ...set,
        werkzaamheden: set.werkzaamheden.map((w) => ({
          ...w,
          materialen: w.materialen.filter((m) => m.materiaalId !== id),
        })),
        materialen: set.materialen.filter((m) => m.id !== id),
      },
      true,
    );

  // OFM-055: tags = de niet-verborgen opties zonder "Weet ik niet".
  const tagOndergronden = ondergronden.filter((o) => !o.verborgen && o.sleutel !== ONDERGROND_ONBEKEND);
  const tagBedekkingen = bedekkingen.filter((o) => !o.verborgen);

  const zoekend = zoekterm.trim() !== '';
  const groepen = groepeerOpCategorie(sorteerOpNaam(set.materialen, b.materiaalNamen), set.categorieen).map(
    (g) => ({ ...g, zichtbaar: zoekOpNaam(g.materialen, zoekterm) }),
  );
  const getoond = zoekend ? groepen.filter((g) => g.zichtbaar.length > 0) : groepen;
  const zoek = (term: string) => {
    setZoekterm(term);
    // Groepen met treffers gaan open.
    if (term.trim() !== '') {
      openCategorieen(
        groepen.filter((g) => zoekOpNaam(g.materialen, term).length > 0).map((g) => g.categorie.id),
      );
    }
  };
  const categorieNaam = (id: string) =>
    beginSet.categorieen.find((c) => c.id === id)?.naam ??
    set.categorieen.find((c) => c.id === id)?.naam ??
    '';

  return (
    <div className="flex flex-col gap-10">
      <TabKop uitleg={t.uitlegMaterialen} signaal={b.bewaren.signaal} />
      {b.meldingen}

      <Deel titel={t.materialen} uitleg={t.materialenUitleg}>
        <BeschikbareTags ondergronden={tagOndergronden} bedekkingen={tagBedekkingen} />
        <CategorieBeheer
          categorieen={set.categorieen}
          bewaard={beginSet.categorieen}
          materialen={set.materialen}
          opWijzig={(categorieen, materialen, direct) =>
            b.wijzig({ ...set, categorieen, materialen: materialen ?? set.materialen }, direct)
          }
          opBlur={b.bewaren.bewaarNu}
        />
        {set.materialen.length > 0 && (
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-72 max-w-xl flex-1 flex-col gap-2">
              <label htmlFor="zoek-materiaal" className="font-semibold">
                {t.zoekMateriaal}
              </label>
              <input
                id="zoek-materiaal"
                type="search"
                className={invoerKlasse}
                value={zoekterm}
                autoComplete="off"
                onChange={(e) => zoek(e.target.value)}
              />
            </div>
            <Knop
              label={t.allesOpenen}
              icoon={ChevronsUpDown}
              variant="secundair"
              onClick={() => zetAlleCategorieen([], true)}
            />
            <Knop
              label={t.allesSluiten}
              icoon={ChevronsDownUp}
              variant="secundair"
              onClick={() =>
                zetAlleCategorieen(
                  groepen.map((g) => g.categorie.id),
                  false,
                )
              }
            />
          </div>
        )}
        {set.materialen.length === 0 && <p className="text-tekst-zacht">{t.geenMaterialenLijst}</p>}
        {zoekend && getoond.length === 0 && (
          <p role="status" className="text-tekst-zacht">
            {t.geenMaterialenGevonden}
          </p>
        )}
        {getoond.map((g) => (
          <Groep
            key={g.categorie.id}
            naam={categorieNaam(g.categorie.id) || g.categorie.naam}
            aantal={g.materialen.length}
            open={dicht[g.categorie.id] !== true}
            opOpen={(open) => zetCategorieOpen(g.categorie.id, open)}
            opToevoegen={(label) => voegMateriaalToe(label, g.categorie.id)}
          >
            {g.zichtbaar.length === 0 ? (
              <p className="text-tekst-zacht">{tc.leeg}</p>
            ) : (
              <>
                <Koppen klasse={RIJ_MATERIAAL} koppen={[t.naam, t.eenheid, t.prijs, t.btw, tc.kop]} />
                <ul aria-label={tc.materialenIn(g.categorie.naam)} className="flex flex-col">
                  {g.zichtbaar.map((m) => {
                    const naam = b.materiaalNaam(m);
                    return (
                      <li key={m.id} className={`${RIJ_MATERIAAL} border-b border-rand px-2 py-2`}>
                        <NaamInvoer
                          label={t.materiaalNaam(naam)}
                          item={m}
                          focus={focusId === m.id}
                          opWijzig={(label) => b.zetMateriaal(m.id, { label }, false)}
                          opBlur={b.bewaren.bewaarNu}
                        />
                        <EenheidKeuze
                          label={t.materiaalEenheid(naam)}
                          waarde={m.eenheid}
                          opWijzig={(eenheid) => b.zetMateriaal(m.id, { eenheid }, true)}
                        />
                        <PrijsInvoer
                          label={t.materiaalPrijs(naam)}
                          prijsCent={m.prijsCent}
                          opWijzig={(prijsCent) => b.zetMateriaal(m.id, { prijsCent }, false)}
                          opBlur={b.bewaren.bewaarNu}
                        />
                        <BtwKeuze
                          label={t.materiaalBtw(naam)}
                          waarde={m.btwTarief}
                          opWijzig={(btwTarief) => b.zetMateriaal(m.id, { btwTarief }, true)}
                        />
                        <select
                          className={invoerKlasse}
                          aria-label={tc.vanMateriaal(naam)}
                          value={categorieVan(m, set.categorieen)}
                          onChange={(e) => {
                            const id = e.target.value;
                            zetCategorieOpen(id, true);
                            b.zetMateriaal(m.id, { categorieId: id === CATEGORIE_OVERIG ? null : id }, true);
                          }}
                        >
                          {set.categorieen.map((c) => (
                            <option key={c.id} value={c.id}>
                              {categorieNaam(c.id) || c.naam}
                            </option>
                          ))}
                        </select>
                        <ItemKnoppen
                          naam={naam}
                          item={m}
                          opVerberg={() => b.zetMateriaal(m.id, { verborgen: !m.verborgen }, true)}
                          opVerwijder={() =>
                            b.vraagVerwijderen(
                              m,
                              naam,
                              () => verwijderMateriaal(m.id),
                              () => b.zetMateriaal(m.id, { verborgen: true }, true),
                            )
                          }
                        />
                        <TagKnoppen
                          naam={naam}
                          tags={m.tags}
                          ondergronden={tagOndergronden}
                          bedekkingen={tagBedekkingen}
                          opWijzig={(tags) => b.zetMateriaal(m.id, { tags }, true)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Groep>
        ))}
        <NieuwFormulier
          label={t.nieuwMateriaal}
          hint={t.nieuwMateriaalHint}
          waarde={nieuwMateriaal}
          opWijzig={setNieuwMateriaal}
          opToevoegen={() => {
            voegMateriaalToe(nieuwMateriaal, null);
            setNieuwMateriaal('');
          }}
          toevoegenLabel={t.materiaalToevoegen}
        />
      </Deel>
      {b.verwijderVragen}
    </div>
  );
}

/** OFM-057: één categorie als inklapbare groep met een eigen "Materiaal toevoegen". */
function Groep({
  naam,
  aantal,
  open,
  opOpen,
  opToevoegen,
  children,
}: {
  naam: string;
  aantal: number;
  open: boolean;
  opOpen: (open: boolean) => void;
  opToevoegen: (label: string) => void;
  children: ReactNode;
}) {
  const [nieuw, setNieuw] = useState('');
  const inhoudId = useId();
  return (
    <section aria-label={tc.groep(naam)} className="flex flex-col rounded-knop border-2 border-rand">
      <h3 className="p-2 text-xl font-semibold">
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
          <span className="font-normal text-tekst-zacht">{`(${tc.aantal(aantal)})`}</span>
        </button>
      </h3>
      {open && (
        <div id={inhoudId} className="flex flex-col gap-4 border-t-2 border-rand p-4">
          {children}
          <NieuwFormulier
            label={tc.nieuwIn(naam)}
            waarde={nieuw}
            opWijzig={setNieuw}
            opToevoegen={() => {
              opToevoegen(nieuw);
              setNieuw('');
            }}
            toevoegenLabel={tc.toevoegenIn(naam)}
          />
        </div>
      )}
    </section>
  );
}

/**
 * OFM-057: inklapbaar blok Categorieën: toevoegen (naam uniek en niet leeg), hernoemen, volgorde en
 * verwijderen (materialen naar Overig, bevestiging met het aantal). Overig staat vast onderaan.
 */
function CategorieBeheer({
  categorieen,
  bewaard,
  materialen,
  opWijzig,
  opBlur,
}: {
  categorieen: Categorie[];
  bewaard: Categorie[];
  materialen: Materiaal[];
  opWijzig: (categorieen: Categorie[], materialen: Materiaal[] | null, direct: boolean) => void;
  opBlur: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [nieuw, setNieuw] = useState('');
  const [teVerwijderen, setTeVerwijderen] = useState<Categorie | null>(null);
  const inhoudId = useId();
  const eigen = categorieen.filter((c) => c.id !== CATEGORIE_OVERIG);
  const naamVan = (c: Categorie) => bewaard.find((x) => x.id === c.id)?.naam ?? (c.naam.trim() || t.naam);
  const aantalIn = (id: string) => materialen.filter((m) => categorieVan(m, categorieen) === id).length;
  const nieuwFout = nieuw.trim() === '' ? null : categorieNaamFout(nieuw, null, categorieen);
  const overig = categorieen.find((c) => c.id === CATEGORIE_OVERIG);

  const verplaats = (index: number, richting: -1 | 1) => {
    const kopie = [...eigen];
    const [item] = kopie.splice(index, 1);
    if (item) kopie.splice(index + richting, 0, item);
    opWijzig([...kopie, ...(overig ? [overig] : [])], null, true);
  };
  const voegToe = () => {
    if (nieuw.trim() === '' || nieuwFout !== null) return;
    const categorie: Categorie = { id: crypto.randomUUID(), naam: nieuw.trim(), standaard: false };
    setNieuw('');
    opWijzig([...eigen, categorie, ...(overig ? [overig] : [])], null, true);
  };

  return (
    <section aria-label={tc.beheer} className="flex flex-col rounded-knop border-2 border-rand">
      <h3 className="p-2 text-lg font-semibold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={inhoudId}
          onClick={() => setOpen(!open)}
          className="inline-flex min-h-12 items-center gap-2 rounded-knop px-2 text-left hover:text-accent"
        >
          {open ? (
            <ChevronDown aria-hidden="true" className="size-6" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-6" />
          )}
          <span>{tc.beheer}</span>
          <span className="font-normal text-tekst-zacht">{`(${categorieen.length})`}</span>
        </button>
      </h3>
      {open && (
        <div id={inhoudId} className="flex flex-col gap-4 border-t-2 border-rand p-4">
          <p className="max-w-3xl text-tekst-zacht">{tc.beheerUitleg}</p>
          <ul aria-label={tc.beheer} className="flex flex-col">
            {eigen.map((c, index) => {
              const naam = naamVan(c);
              const fout = categorieNaamFout(c.naam, c.id, categorieen);
              return (
                <li
                  key={c.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-rand px-2 py-2"
                >
                  <input
                    className={`${invoerKlasse} max-w-xl`}
                    aria-label={tc.naamVan(naam)}
                    aria-invalid={fout !== null || undefined}
                    title={fout === null ? undefined : tc.fout[fout]}
                    value={c.naam}
                    maxLength={40}
                    onChange={(e) =>
                      opWijzig(
                        categorieen.map((x) => (x.id === c.id ? { ...x, naam: e.target.value } : x)),
                        null,
                        false,
                      )
                    }
                    onBlur={opBlur}
                  />
                  <span className="text-tekst-zacht">{tc.aantal(aantalIn(c.id))}</span>
                  <div className="flex items-center gap-2">
                    <Knop
                      label={t.omhoog(naam)}
                      icoon={ArrowUp}
                      alleenIcoon
                      disabled={index === 0}
                      onClick={() => verplaats(index, -1)}
                    />
                    <Knop
                      label={t.omlaag(naam)}
                      icoon={ArrowDown}
                      alleenIcoon
                      disabled={index === eigen.length - 1}
                      onClick={() => verplaats(index, 1)}
                    />
                    <Knop
                      label={t.verwijder(naam)}
                      icoon={Trash2}
                      alleenIcoon
                      onClick={() => setTeVerwijderen(c)}
                    />
                  </div>
                </li>
              );
            })}
            {overig && (
              <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2 py-2">
                <span className="px-3">
                  {overig.naam} <span className="text-tekst-zacht">{`— ${tc.overigVast}`}</span>
                </span>
                <span className="text-tekst-zacht">{tc.aantal(aantalIn(CATEGORIE_OVERIG))}</span>
              </li>
            )}
          </ul>
          <NieuwFormulier
            label={tc.nieuw}
            waarde={nieuw}
            opWijzig={setNieuw}
            opToevoegen={voegToe}
            toevoegenLabel={tc.toevoegen}
            fout={nieuwFout === null ? undefined : tc.fout[nieuwFout]}
          />
        </div>
      )}
      <Bevestiging
        open={teVerwijderen !== null}
        titel={tc.verwijderTitel}
        bevestigLabel={t.verwijderJa}
        annuleerLabel={t.verwijderNee}
        gevaar
        opAnnuleer={() => setTeVerwijderen(null)}
        opBevestig={() => {
          const weg = teVerwijderen;
          setTeVerwijderen(null);
          if (!weg) return;
          opWijzig(
            categorieen.filter((c) => c.id !== weg.id),
            materialen.map((m) => (m.categorieId === weg.id ? { ...m, categorieId: null } : m)),
            true,
          );
        }}
      >
        <p>{teVerwijderen && tc.verwijderTekst(naamVan(teVerwijderen), aantalIn(teVerwijderen.id))}</p>
      </Bevestiging>
    </section>
  );
}

/** OFM-055: bovenaan de materialen de tags die er zijn (de opties van twee keuzelijsten). */
function BeschikbareTags({
  ondergronden,
  bedekkingen,
}: {
  ondergronden: Keuzeoptie[];
  bedekkingen: Keuzeoptie[];
}) {
  const groep = (titel: string, opties: Keuzeoptie[]) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-48 font-semibold">{titel}</span>
      {opties.length === 0 ? (
        <span className="text-tekst-zacht">{t.tags.geen}</span>
      ) : (
        <ul aria-label={titel} className="flex flex-wrap gap-2">
          {opties.map((o) => (
            <li key={o.id} className="rounded-full bg-vlak px-3 py-1">
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <section aria-label={t.tags.titel} className="flex flex-col gap-2 rounded-knop border-2 border-rand p-4">
      <h3 className="text-lg font-semibold">{t.tags.titel}</h3>
      <p className="max-w-3xl text-tekst-zacht">{t.tags.uitleg}</p>
      {groep(t.tags.ondergrond, ondergronden)}
      {groep(t.tags.bedekking, bedekkingen)}
    </section>
  );
}

/**
 * OFM-055: de tags van één materiaal als aan/uit-knoppen, onder de rij. De laatste tag van een groep kan
 * niet uit (geen tags = alle, dat zou het omgekeerde doen).
 */
function TagKnoppen({
  naam,
  tags,
  ondergronden,
  bedekkingen,
  opWijzig,
}: {
  naam: string;
  tags: MateriaalTags;
  ondergronden: Keuzeoptie[];
  bedekkingen: Keuzeoptie[];
  opWijzig: (tags: MateriaalTags) => void;
}) {
  const groep = (groep: TagGroep, titel: string, opties: Keuzeoptie[]) => {
    if (opties.length === 0) return null;
    const waarde = tags[groep];
    const aan = (sleutel: string) => waarde === 'alle' || waarde.includes(sleutel);
    const aantalAan = opties.filter((o) => aan(o.sleutel)).length;
    const alle = opties.map((o) => o.sleutel);
    return (
      <div
        role="group"
        aria-label={t.tags.groepVan(titel, naam)}
        className="flex flex-wrap items-center gap-2"
      >
        <span aria-hidden="true" className="min-w-48 text-tekst-zacht">
          {titel}
        </span>
        {opties.map((o) => {
          const isAan = aan(o.sleutel);
          const laatste = isAan && aantalAan === 1 && waarde !== 'alle';
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={isAan}
              aria-label={t.tags.tag(o.label, naam)}
              title={laatste ? t.tags.laatste : undefined}
              disabled={laatste}
              onClick={() => opWijzig(zetTag(tags, groep, o.sleutel, !isAan, alle))}
              className={chipKlasse(isAan)}
            >
              {isAan && <Check aria-hidden="true" className="size-4" strokeWidth={3} />}
              {o.label}
            </button>
          );
        })}
      </div>
    );
  };
  return (
    <div className="col-span-full flex flex-col gap-2 pb-2">
      {groep('ondergrond', t.tags.ondergrond, ondergronden)}
      {groep('bedekking', t.tags.bedekking, bedekkingen)}
    </div>
  );
}

/** De vaste posten (steiger, verzekerde garantie, voorrijkosten) via `prijzen:bewaar`. */
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
