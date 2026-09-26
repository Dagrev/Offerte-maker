import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Keuzeoptie, Materiaal, MateriaalTags, Prijspost } from '@shared/types';
import { ALLE_TAGS, ONDERGROND_ONBEKEND, prijsGroep, zetTag, type TagGroep } from '@shared/werkzaamheden';
import { bewaarPrijspost, usePrijzen } from '../../api/prijzen';
import { alsFout } from '../../api/roep';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';
import { sorteerOpNaam, zoekOpNaam } from './werkzaamhedenGedeeld';
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
// OFM-048/055). Materialen met naam, eenheid, prijs, btw en tags (ondergrond en nieuwe dakbedekking),
// alfabetisch op naam en doorzoekbaar; daaronder de Overige prijzen (steiger, verzekerde garantie,
// voorrijkosten) via `prijzen:bewaar`. Welke materialen bij een werkzaamheid kiesbaar zijn, staat in de tab
// Werkzaamheden.

/** Materiaalrij: naam, eenheid, prijs, btw, knoppen. */
const RIJ_MATERIAAL = 'grid grid-cols-[minmax(0,1fr)_7rem_9rem_5.5rem_auto] items-center gap-3';
const RIJ_OVERIG = 'grid grid-cols-[minmax(0,1fr)_7rem_9rem_5.5rem] items-center gap-3';

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
  const [nieuwMateriaal, setNieuwMateriaal] = useState('');
  const [zoekterm, setZoekterm] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);

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
      tags: ALLE_TAGS,
    };
    setNieuwMateriaal('');
    // Het nieuwe materiaal moet zichtbaar zijn: zoeken wissen.
    setZoekterm('');
    setFocusId(nieuw.id);
    b.wijzig({ ...set, materialen: [...set.materialen, nieuw] }, true);
  };
  const verwijderMateriaal = (id: string) =>
    b.wijzig(
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

  // OFM-055: tags = de niet-verborgen opties zonder "Weet ik niet".
  const tagOndergronden = ondergronden.filter((o) => !o.verborgen && o.sleutel !== ONDERGROND_ONBEKEND);
  const tagBedekkingen = bedekkingen.filter((o) => !o.verborgen);

  const zichtbaar = zoekOpNaam(sorteerOpNaam(set.materialen, b.materiaalNamen), zoekterm);

  return (
    <div className="flex flex-col gap-10">
      <TabKop uitleg={t.uitlegMaterialen} signaal={b.bewaren.signaal} />
      {b.meldingen}

      <Deel titel={t.materialen} uitleg={t.materialenUitleg}>
        <BeschikbareTags ondergronden={tagOndergronden} bedekkingen={tagBedekkingen} />
        {set.materialen.length === 0 ? (
          <p className="text-tekst-zacht">{t.geenMaterialenLijst}</p>
        ) : (
          <>
            <div className="flex max-w-xl flex-col gap-2">
              <label htmlFor="zoek-materiaal" className="font-semibold">
                {t.zoekMateriaal}
              </label>
              <input
                id="zoek-materiaal"
                type="search"
                className={invoerKlasse}
                value={zoekterm}
                autoComplete="off"
                onChange={(e) => setZoekterm(e.target.value)}
              />
            </div>
            {zichtbaar.length === 0 ? (
              <p role="status" className="text-tekst-zacht">
                {t.geenMaterialenGevonden}
              </p>
            ) : (
              <>
                <Koppen klasse={RIJ_MATERIAAL} koppen={[t.naam, t.eenheid, t.prijs, t.btw]} />
                <ul aria-label={t.materialen} className="flex flex-col">
                  {zichtbaar.map((m) => {
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
      {b.verwijderVragen}
    </div>
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
