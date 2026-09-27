import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
} from 'lucide-react';
import type { Categorie, Keuzeoptie, Materiaal, MateriaalTags, Prijspost } from '@shared/types';
import {
  ALLE_TAGS,
  CATEGORIE_OVERIG,
  ONDERGROND_ONBEKEND,
  categorieVan,
  isAlleSituaties,
  groepeerOpCategorie,
  prijsGroep,
  zetTag,
  type TagGroep,
} from '@shared/werkzaamheden';
import { bewaarPrijspost, usePrijzen } from '../../api/prijzen';
import { alsFout } from '../../api/roep';
import { Bevestiging } from '../../componenten/Bevestiging';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { ContextMenu, type MenuRegel, type SluitReden } from '../../componenten/ContextMenu';
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
// tab Werkzaamheden. OFM-059: een materiaal verplaatsen naar een andere categorie kan ook met het
// contextmenu van de rij (rechtermuisknop, Shift+F10, de menutoets of een klik op de sleepgreep) of door
// de sleepgreep naar een andere groep te slepen (HTML drag-and-drop, geen pakket).

/**
 * Materiaalrij: sleepgreep (OFM-059), naam, eenheid, prijs, btw, categorie, knoppen en (OFM-058) de tags
 * aan het einde van de regel (een vaste kolom, zodat de rijen gelijk blijven). Is de groep smaller dan
 * 64rem, of heeft het materiaal losse tags, dan staan de tags rechts onder de rij (container query).
 */
const RIJ_MATERIAAL =
  'grid grid-cols-[3.5rem_minmax(0,1fr)_7rem_9rem_5.5rem_11rem_auto] items-center gap-x-3 gap-y-1 ' +
  '@5xl:grid-cols-[3.5rem_minmax(0,1fr)_7rem_9rem_5.5rem_11rem_auto_11rem]';
/** Hoe lang de melding "Verplaatst naar …" blijft staan. */
const MELDING_MS = 4000;

/** Het open contextmenu van een materiaalrij: waar, voor welk materiaal en waar de focus terug moet. */
interface MateriaalMenu {
  materiaalId: string;
  positie: { x: number; y: number };
  terug: HTMLElement;
}
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
  // OFM-059: contextmenu, slepen en de melding na verplaatsen.
  const [menu, setMenu] = useState<MateriaalMenu | null>(null);
  const [sleept, setSleept] = useState<string | null>(null);
  const [sleepDoel, setSleepDoel] = useState<string | null>(null);
  // Een nieuw object per verplaatsing, zodat hetzelfde materiaal twee keer na elkaar de focus krijgt.
  const [focusGreep, setFocusGreep] = useState<{ id: string } | null>(null);
  const [melding, setMelding] = useState<{ nr: number; tekst: string } | null>(null);

  // Na verplaatsen: focus op de sleepgreep van het materiaal in zijn nieuwe groep.
  useEffect(() => {
    if (focusGreep === null) return;
    document.querySelector<HTMLElement>(`[data-greep="${focusGreep.id}"]`)?.focus();
  }, [focusGreep]);
  useEffect(() => {
    if (melding === null) return;
    const klok = window.setTimeout(() => setMelding(null), MELDING_MS);
    return () => window.clearTimeout(klok);
  }, [melding]);

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
  const naamVanCategorie = (c: Categorie) => categorieNaam(c.id) || c.naam;

  // OFM-059: een materiaal naar een andere categorie. Bewaart direct; de doelgroep gaat open en de
  // sleepgreep van het materiaal krijgt daarna de focus. De melding noemt de nieuwe categorie (ook voor
  // schermlezers), zodat een verplaatsing tijdens het zoeken niet onopgemerkt blijft.
  const plaatsBij = (materiaalId: string, categorieId: string) => {
    const m = set.materialen.find((x) => x.id === materiaalId);
    const doel = set.categorieen.find((c) => c.id === categorieId);
    if (!m || !doel || categorieVan(m, set.categorieen) === categorieId) return;
    zetCategorieOpen(categorieId, true);
    b.zetMateriaal(m.id, { categorieId: categorieId === CATEGORIE_OVERIG ? null : categorieId }, true);
    setFocusGreep({ id: m.id });
    setMelding((oud) => ({ nr: (oud?.nr ?? 0) + 1, tekst: tc.verplaatst(naamVanCategorie(doel)) }));
  };
  const vraagVerwijderen = (m: Materiaal, naam: string) =>
    b.vraagVerwijderen(
      m,
      naam,
      () => verwijderMateriaal(m.id),
      () => b.zetMateriaal(m.id, { verborgen: true }, true),
    );
  const menuMateriaal = menu ? set.materialen.find((m) => m.id === menu.materiaalId) : undefined;
  const menuRegels = (m: Materiaal): MenuRegel[] => {
    const huidig = categorieVan(m, set.categorieen);
    const naam = b.materiaalNaam(m);
    return [
      {
        soort: 'groep',
        label: tc.plaatsBij,
        keuzes: set.categorieen.map((c) => ({
          label: naamVanCategorie(c),
          gekozen: c.id === huidig,
          uitReden: c.id === huidig ? tc.alHier : undefined,
          opKies: () => plaatsBij(m.id, c.id),
        })),
      },
      { soort: 'scheiding' },
      {
        soort: 'actie',
        label: m.verborgen ? tc.menuToon : tc.menuVerberg,
        icoon: m.verborgen ? Eye : EyeOff,
        opKies: () => b.zetMateriaal(m.id, { verborgen: !m.verborgen }, true),
      },
      {
        soort: 'actie',
        label: tc.menuVerwijder,
        icoon: Trash2,
        gevaar: true,
        opKies: () => vraagVerwijderen(m, naam),
      },
    ];
  };
  const sluitMenu = (reden: SluitReden) => {
    const terug = menu?.terug;
    setMenu(null);
    // Na Escape of een keuze terug naar waar het menu vandaan kwam (een verplaatsing zet daarna de focus
    // op de sleepgreep in de nieuwe groep).
    if ((reden === 'escape' || reden === 'keuze') && terug?.isConnected) terug.focus();
  };
  /** Bij het toetsenbord of de sleepgreep opent het menu onder het element. */
  const onder = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + 16, y: r.bottom };
  };

  return (
    <div className="flex flex-col gap-10">
      <TabKop uitleg={t.uitlegMaterialen} signaal={b.bewaren.signaal} />
      {b.meldingen}

      <Deel titel={t.materialen} uitleg={t.materialenUitleg}>
        <p className="max-w-3xl text-tekst-zacht">{t.tags.uitleg}</p>
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
            <p role="status" className="flex min-h-14 items-center gap-1 font-semibold text-goed">
              {melding && (
                <>
                  <Check aria-hidden="true" className="size-5" strokeWidth={3} />
                  {melding.tekst}
                </>
              )}
            </p>
          </div>
        )}
        {set.materialen.length === 0 && <p className="text-tekst-zacht">{t.geenMaterialenLijst}</p>}
        {zoekend && getoond.length === 0 && (
          <p role="status" className="text-tekst-zacht">
            {t.geenMaterialenGevonden}
          </p>
        )}
        {getoond.map((g) => {
          const sleepMateriaal = sleept ? set.materialen.find((m) => m.id === sleept) : undefined;
          // Alleen een andere groep is een doel; de eigen groep en alles buiten een groep doen niets.
          const kanDoel =
            sleepMateriaal !== undefined && categorieVan(sleepMateriaal, set.categorieen) !== g.categorie.id;
          return (
            <Groep
              key={g.categorie.id}
              categorieId={g.categorie.id}
              naam={categorieNaam(g.categorie.id) || g.categorie.naam}
              aantal={g.materialen.length}
              open={dicht[g.categorie.id] !== true}
              opOpen={(open) => zetCategorieOpen(g.categorie.id, open)}
              opToevoegen={(label) => voegMateriaalToe(label, g.categorie.id)}
              sleep={
                kanDoel
                  ? {
                      doel: sleepDoel === g.categorie.id,
                      opOver: () => setSleepDoel(g.categorie.id),
                      opWeg: () => setSleepDoel((d) => (d === g.categorie.id ? null : d)),
                      opLos: () => {
                        setSleepDoel(null);
                        setSleept(null);
                        plaatsBij(sleepMateriaal.id, g.categorie.id);
                      },
                    }
                  : null
              }
            >
              {g.zichtbaar.length === 0 ? (
                <p className="text-tekst-zacht">{tc.leeg}</p>
              ) : (
                <>
                  <Koppen klasse={RIJ_MATERIAAL} koppen={['', t.naam, t.eenheid, t.prijs, t.btw, tc.kop]} />
                  <ul aria-label={tc.materialenIn(g.categorie.naam)} className="flex flex-col">
                    {g.zichtbaar.map((m) => {
                      const naam = b.materiaalNaam(m);
                      return (
                        <li
                          key={m.id}
                          aria-keyshortcuts="Shift+F10"
                          onContextMenu={(e) => {
                            e.preventDefault();
                            const muis = e.clientX !== 0 || e.clientY !== 0;
                            const terug =
                              e.target instanceof HTMLElement && e.target.matches('input, select, button')
                                ? e.target
                                : e.currentTarget.querySelector<HTMLElement>(`[data-greep="${m.id}"]`);
                            if (!terug) return;
                            setMenu({
                              materiaalId: m.id,
                              positie: muis ? { x: e.clientX, y: e.clientY } : onder(terug),
                              terug,
                            });
                          }}
                          onKeyDown={(e) => {
                            if (!(e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) return;
                            if (!(e.target instanceof HTMLElement)) return;
                            e.preventDefault();
                            setMenu({ materiaalId: m.id, positie: onder(e.target), terug: e.target });
                          }}
                          className={`${RIJ_MATERIAAL} border-b border-rand px-2 py-2 ${
                            sleept === m.id ? 'opacity-50' : ''
                          }`}
                        >
                          <Knop
                            label={tc.greep(naam)}
                            icoon={GripVertical}
                            alleenIcoon
                            data-greep={m.id}
                            aria-haspopup="menu"
                            draggable
                            onClick={(e) => {
                              const el = e.currentTarget;
                              setMenu({ materiaalId: m.id, positie: onder(el), terug: el });
                            }}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', m.id);
                              const rij = e.currentTarget.closest('li');
                              if (rij) e.dataTransfer.setDragImage(rij, 24, 24);
                              setMenu(null);
                              setSleept(m.id);
                            }}
                            onDragEnd={() => {
                              setSleept(null);
                              setSleepDoel(null);
                            }}
                            className="cursor-grab"
                          />
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
                              b.zetMateriaal(
                                m.id,
                                { categorieId: id === CATEGORIE_OVERIG ? null : id },
                                true,
                              );
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
                            opVerwijder={() => vraagVerwijderen(m, naam)}
                          />
                          <TagChips
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
          );
        })}
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
      {menu && menuMateriaal && (
        <ContextMenu
          label={tc.menu(b.materiaalNaam(menuMateriaal))}
          positie={menu.positie}
          regels={menuRegels(menuMateriaal)}
          opSluit={sluitMenu}
        />
      )}
    </div>
  );
}

/** OFM-059: een groep als doel tijdens het slepen van een materiaal uit een andere groep. */
interface SleepDoel {
  /** De sleepgreep is boven deze groep: de groep licht op. */
  doel: boolean;
  opOver: () => void;
  opWeg: () => void;
  opLos: () => void;
}

/**
 * OFM-057: één categorie als inklapbare groep met een eigen "Materiaal toevoegen". OFM-059: tijdens het
 * slepen van een materiaal uit een andere groep is de hele groep (kop en inhoud, ook ingeklapt) een doel.
 */
function Groep({
  categorieId,
  naam,
  aantal,
  open,
  opOpen,
  opToevoegen,
  sleep,
  children,
}: {
  categorieId: string;
  naam: string;
  aantal: number;
  open: boolean;
  opOpen: (open: boolean) => void;
  opToevoegen: (label: string) => void;
  sleep: SleepDoel | null;
  children: ReactNode;
}) {
  const [nieuw, setNieuw] = useState('');
  const inhoudId = useId();
  return (
    <section
      aria-label={tc.groep(naam)}
      data-categorie-id={categorieId}
      onDragOver={(e) => {
        if (!sleep) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!sleep.doel) sleep.opOver();
      }}
      onDragLeave={(e) => {
        if (sleep && !e.currentTarget.contains(e.relatedTarget as Node | null)) sleep.opWeg();
      }}
      onDrop={(e) => {
        if (!sleep) return;
        e.preventDefault();
        sleep.opLos();
      }}
      className={`flex flex-col rounded-knop border-2 ${
        sleep?.doel ? 'border-accent bg-vlak ring-2 ring-accent' : 'border-rand'
      }`}
    >
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
        <div id={inhoudId} className="@container flex flex-col gap-4 border-t-2 border-rand p-4">
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

/**
 * OFM-058: de tags van één materiaal als compacte aan/uit-knoppen aan het einde van de rij. Staan alle tags
 * aan, dan alleen de knop **Alle situaties** (aan). Uitzetten toont de losse tags (alles aan) om er een paar
 * uit te zetten; staan ze daarna weer allemaal aan, dan klapt het terug naar Alle situaties. Bij een
 * materiaal met specifieke tags zet Alle situaties alles weer aan. De laatste tag van een groep kan niet uit
 * (geen tags = alle, dat zou het omgekeerde doen).
 */
function TagChips({
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
  const alle = isAlleSituaties({ tags });
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const losZichtbaar = !alle || uitgeklapt;
  const groep = (groep: TagGroep, titel: string, opties: Keuzeoptie[]) => {
    if (opties.length === 0) return null;
    const waarde = tags[groep];
    const aan = (sleutel: string) => waarde === 'alle' || waarde.includes(sleutel);
    const aantalAan = opties.filter((o) => aan(o.sleutel)).length;
    const sleutels = opties.map((o) => o.sleutel);
    return (
      <span
        role="group"
        aria-label={t.tags.groepVan(titel, naam)}
        className="flex flex-wrap items-center gap-1"
      >
        {opties.map((o) => {
          const isAan = aan(o.sleutel);
          const laatste = isAan && aantalAan === 1 && waarde !== 'alle';
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={isAan}
              aria-label={t.tags.tag(o.label, naam)}
              title={laatste ? t.tags.laatste : titel}
              disabled={laatste}
              onClick={() => {
                const nieuw = zetTag(tags, groep, o.sleutel, !isAan, sleutels);
                // Alles weer aan: terug naar Alle situaties.
                if (isAlleSituaties({ tags: nieuw })) setUitgeklapt(false);
                opWijzig(nieuw);
              }}
              className={chipKlein(isAan)}
            >
              {o.label}
            </button>
          );
        })}
      </span>
    );
  };
  return (
    <div
      role="group"
      aria-label={t.tags.vanMateriaal(naam)}
      className={
        'col-span-full flex flex-wrap items-center justify-end gap-1' +
        // Alleen de knop Alle situaties: in de laatste kolom; losse tags: rechts onder de rij.
        (losZichtbaar ? '' : ' @5xl:col-span-1')
      }
    >
      <button
        type="button"
        aria-pressed={alle && !uitgeklapt}
        aria-label={t.tags.alleVan(naam)}
        onClick={() => {
          if (alle) setUitgeklapt(!uitgeklapt);
          else {
            setUitgeklapt(false);
            opWijzig(ALLE_TAGS);
          }
        }}
        className={chipKlein(alle && !uitgeklapt)}
      >
        {alle && !uitgeklapt && <Check aria-hidden="true" className="size-4" strokeWidth={3} />}
        {t.tags.alle}
      </button>
      {losZichtbaar && groep('ondergrond', t.tags.ondergrond, ondergronden)}
      {losZichtbaar && groep('bedekking', t.tags.bedekking, bedekkingen)}
    </div>
  );
}

/** Compacte aan/uit-knop (kleine tekst; wel een klikdoel van 48 px). */
const chipKlein = (aan: boolean) =>
  'inline-flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold ' +
  'disabled:cursor-not-allowed ' +
  (aan
    ? 'border-2 border-accent bg-achtergrond text-accent'
    : 'border-2 border-rand bg-achtergrond text-tekst-zacht hover:border-accent');

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
