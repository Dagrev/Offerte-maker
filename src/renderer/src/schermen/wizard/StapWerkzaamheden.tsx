import { useId, useState } from 'react';
import { Check, Plus, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { bedragWerkzaamheidCent, euroNaarCent, totaalM2 } from '@shared/calc/bedragen';
import { formatEuro } from '@shared/formatteer';
import type {
  Eenheid,
  GekozenMateriaal,
  GekozenWerkzaamheid,
  Keuzelijsten,
  KlusInvoer,
  Werkzaamheid,
  WerkzaamhedenSet,
} from '@shared/types';
import {
  daksysteemHint,
  gebruikDaksysteem,
  kiesMateriaal,
  kiesWerkzaamheid,
  materiaalInfo,
  optieInfo,
  pasBedekkingToe,
  standaardPrijs,
  werkInfo,
  wisselPerUur,
  type DaksysteemHint,
  type WerkCatalogus,
} from '@shared/werkzaamheden';
import { vraagtNieuweBedekking } from '@shared/keuzelijsten';
import { alsFout } from '../../api/roep';
import { alsBewaarInvoer, bewaarWerkzaamheden } from '../../api/werkzaamheden';
import { Foutmelding } from '../../componenten/Foutmelding';
import { GetalVeld } from '../../componenten/GetalVeld';
import { Kaart } from '../../componenten/Kaart';
import { Knop } from '../../componenten/Knop';
import { TegelKeuze } from '../../componenten/TegelKeuze';
import { Veld } from '../../componenten/Veld';
import { Vinkje } from '../../componenten/Vinkje';
import { nl } from '../../teksten/nl';
import { keuzeTegels } from './opties';
import { BEDEKKING_ICONEN, SOORT_WERK_ICONEN } from './StapDak';

const t = nl.wizard.werk;
const e = nl.wizard.extras;
const EENHEDEN: Eenheid[] = ['m²', 'm¹', 'stuk', 'post', 'uur', 'dag'];
const eenheidNaam = nl.instellingen.prijzen.eenheden;
const selectKlasse = 'min-h-14 w-full rounded-knop border-2 border-rand bg-achtergrond px-4 py-3 text-tekst';

export interface StapWerkzaamhedenProps {
  invoer: KlusInvoer;
  opWijzig: (deel: Partial<KlusInvoer>) => void;
  /** De nieuwste invoer, voor wijzigingen na een bewaaractie (Ook opslaan in instellingen). */
  leesInvoer: () => KlusInvoer;
  keuzelijsten: Keuzelijsten;
  /** Werkzaamheden en materialen uit de instellingen (OFM-043). */
  set: WerkzaamhedenSet;
}

const euro = (cent: number | null) => (cent === null ? null : cent / 100);
const cent = (waarde: number | null) => (waarde === null ? null : euroNaarCent(waarde));

/**
 * Stap 3 Werkzaamheden (OFM-044): soort werk, sinds OFM-050 de nieuwe dakbedekking (alleen bij een
 * soort werk met het vinkje "vraagt nieuwe dakbedekking"; het gekozen materiaal wordt bij de
 * werkzaamheden voorgeselecteerd), de gekoppelde werkzaamheden als aanvinkbare tegels, per
 * gekozen werkzaamheid aantal, prijs (alleen voor deze offerte), materialen, opties en een notitie, en
 * eenmalige werkzaamheden en materialen. Onderaan steiger, garantie en gewenste uitvoering (uit de oude
 * stap Extra's).
 */
export function StapWerkzaamheden({
  invoer,
  opWijzig,
  leesInvoer,
  keuzelijsten: k,
  set,
}: StapWerkzaamhedenProps) {
  const [fout, setFout] = useState<ReturnType<typeof alsFout> | null>(null);
  const m2 = totaalM2(invoer.dakvlakken);
  const catalogus: WerkCatalogus = set;
  const gekozen = invoer.werkzaamheden;

  const zetWerkzaamheden = (werkzaamheden: GekozenWerkzaamheid[]) => opWijzig({ werkzaamheden });
  const zetEen = (id: string, deel: Partial<GekozenWerkzaamheid>) =>
    zetWerkzaamheden(leesInvoer().werkzaamheden.map((w) => (w.id === id ? { ...w, ...deel } : w)));

  // Tegels: de zichtbare werkzaamheden bij deze soort werk, plus wat al gekozen is (ook als het er niet
  // (meer) bij hoort of verborgen is), in de ingestelde volgorde.
  const bijSoort = new Set(set.soortenWerk.find((s) => s.sleutel === invoer.soortWerk)?.werkzaamheden ?? []);
  const gekozenSleutels = new Set(gekozen.flatMap((w) => (w.sleutel === null ? [] : [w.sleutel])));
  const tegels = set.werkzaamheden.filter(
    (w) => (bijSoort.has(w.id) && !w.verborgen) || gekozenSleutels.has(w.sleutel),
  );

  const wissel = (werk: Werkzaamheid) => {
    const huidig = leesInvoer().werkzaamheden;
    if (huidig.some((w) => w.sleutel === werk.sleutel)) {
      zetWerkzaamheden(huidig.filter((w) => w.sleutel !== werk.sleutel));
    } else {
      // OFM-050: de gekozen nieuwe dakbedekking is voorgeselecteerd als hij bij deze werkzaamheid hoort;
      // OFM-051: anders het standaardmateriaal bij dit daksysteem (ondergrond × nieuwe bedekking).
      const { ondergrond, nieuweBedekking } = leesInvoer();
      zetWerkzaamheden([
        ...huidig,
        kiesWerkzaamheid(werk, catalogus, m2, { ondergrond, nieuweBedekking }, set.daksystemen),
      ]);
    }
  };

  const vraagtBedekking = vraagtNieuweBedekking(k, invoer.soortWerk);
  const kiesBedekking = (nieuweBedekking: string) =>
    opWijzig({
      nieuweBedekking,
      werkzaamheden: pasBedekkingToe(
        leesInvoer().werkzaamheden,
        set,
        new Set(k.nieuweBedekking.map((o) => o.sleutel)),
        nieuweBedekking,
      ),
    });
  const kiesSoortWerk = (soortWerk: string) => {
    // OFM-050: geen nieuwe bedekking bij een soort werk die er niet om vraagt; vraagt hij er wel om en
    // is er nog niets gekozen, dan de ingestelde standaard (als die er is).
    if (!vraagtNieuweBedekking(k, soortWerk)) return opWijzig({ soortWerk, nieuweBedekking: null });
    opWijzig({ soortWerk });
    const standaard = k.nieuweBedekking.find((o) => o.standaardkeuze && !o.verborgen)?.sleutel;
    if (leesInvoer().nieuweBedekking === null && standaard) kiesBedekking(standaard);
  };

  const voegEenmaligToe = () =>
    zetWerkzaamheden([
      ...leesInvoer().werkzaamheden,
      {
        id: crypto.randomUUID(),
        sleutel: null,
        eenmalig: { label: '', eenheid: 'm²' },
        aantal: m2,
        prijsCent: null,
        perUur: false,
        notitie: '',
        materialen: [],
        opties: [],
      },
    ]);

  /** "Ook opslaan in instellingen" voor een eenmalige werkzaamheid of een eenmalig materiaal. */
  const slaOp = async (werkId: string, materiaalId: string | null) => {
    const werk = leesInvoer().werkzaamheden.find((w) => w.id === werkId);
    const item = materiaalId === null ? werk : werk?.materialen.find((m) => m.id === materiaalId);
    if (!werk || !item?.eenmalig || item.eenmalig.label.trim() === '') return;
    const invoerSet = alsBewaarInvoer(set);
    const nieuwId = crypto.randomUUID();
    const nieuw = {
      id: nieuwId,
      label: item.eenmalig.label.trim(),
      eenheid: item.eenmalig.eenheid,
      prijsCent: item.prijsCent,
      verborgen: false,
    };
    try {
      if (materiaalId === null) {
        invoerSet.werkzaamheden.push({
          ...nieuw,
          uurprijsCent: null,
          soortenWerk: invoer.soortWerk === null ? [] : [invoer.soortWerk],
          opties: [],
          materialen: [],
        });
      } else {
        invoerSet.materialen.push(nieuw);
        // Bij een werkzaamheid uit de instellingen wordt het materiaal daar ook kiesbaar.
        const ouderId =
          werk.sleutel === null ? undefined : set.werkzaamheden.find((x) => x.sleutel === werk.sleutel)?.id;
        invoerSet.werkzaamheden
          .find((w) => w.id === ouderId)
          ?.materialen.push({ materiaalId: nieuwId, standaard: false });
      }
      const uit = await bewaarWerkzaamheden(invoerSet);
      const sleutel =
        materiaalId === null
          ? uit.werkzaamheden.find((w) => w.id === nieuwId)?.sleutel
          : uit.materialen.find((m) => m.id === nieuwId)?.sleutel;
      if (!sleutel) return;
      setFout(null);
      const actueel = leesInvoer().werkzaamheden.find((w) => w.id === werkId);
      if (!actueel) return;
      if (materiaalId === null) zetEen(werkId, { sleutel, eenmalig: null });
      else
        zetEen(werkId, {
          materialen: actueel.materialen.map((m) =>
            m.id === materiaalId ? { ...m, sleutel, eenmalig: null } : m,
          ),
        });
    } catch (fout) {
      setFout(alsFout(fout));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Kaart>
        <TegelKeuze
          label={t.soortWerk}
          opties={keuzeTegels(k.soortWerk, invoer.soortWerk, SOORT_WERK_ICONEN)}
          waarde={invoer.soortWerk}
          opKies={kiesSoortWerk}
        />
        {vraagtBedekking && (
          <TegelKeuze
            label={t.nieuweBedekking}
            hint={t.nieuweBedekkingHint}
            opties={keuzeTegels(k.nieuweBedekking, invoer.nieuweBedekking, BEDEKKING_ICONEN)}
            waarde={invoer.nieuweBedekking}
            opKies={kiesBedekking}
          />
        )}
      </Kaart>

      <Kaart>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-semibold">{t.werkzaamheden}</legend>
          {invoer.soortWerk === null && gekozen.length === 0 ? (
            <p className="text-tekst-zacht">{t.kiesSoortEerst}</p>
          ) : tegels.length === 0 ? (
            <p className="text-tekst-zacht">{t.geenGekoppeld}</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {tegels.map((werk) => {
                const aan = gekozenSleutels.has(werk.sleutel);
                const anders = !bijSoort.has(werk.id) || werk.verborgen;
                return (
                  <button
                    key={werk.id}
                    type="button"
                    aria-pressed={aan}
                    onClick={() => wissel(werk)}
                    className={
                      'relative flex min-h-24 min-w-40 flex-col items-center justify-center gap-1 rounded-knop ' +
                      'bg-achtergrond px-4 py-3 text-center font-semibold ' +
                      (anders ? 'border-dashed ' : '') +
                      (aan
                        ? 'border-3 border-accent text-accent'
                        : 'border-2 border-rand text-tekst hover:border-accent')
                    }
                  >
                    <span>{werk.label}</span>
                    {anders && <span className="text-sm font-normal">{t.nietBijSoort}</span>}
                    {aan && (
                      <span className="absolute top-1.5 right-1.5 rounded-full bg-accent p-0.5 text-white">
                        <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                        <span className="sr-only">{nl.componenten.gekozen}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      </Kaart>

      {fout && <Foutmelding fout={fout} />}

      {gekozen.map((w) => (
        <WerkKaart
          key={w.id}
          werk={w}
          set={set}
          totaalM2={m2}
          hint={daksysteemHint(w, set, invoer)}
          opWijzig={(deel) => zetEen(w.id, deel)}
          opVerwijder={() => zetWerkzaamheden(leesInvoer().werkzaamheden.filter((x) => x.id !== w.id))}
          opSlaOp={(materiaalId) => void slaOp(w.id, materiaalId)}
        />
      ))}

      <div>
        <Knop label={t.andereWerkzaamheid} icoon={Plus} onClick={voegEenmaligToe} />
      </div>

      <Kaart titel={t.overig}>
        <Vinkje
          label={e.steiger}
          aan={invoer.steigerNodig}
          opWijzig={(steigerNodig) => opWijzig({ steigerNodig })}
        />
        <TegelKeuze
          label={e.garantie}
          opties={keuzeTegels(k.garantie, invoer.garantieJaren, {}, undefined, ShieldCheck)}
          waarde={invoer.garantieJaren}
          opKies={(garantieJaren) => opWijzig({ garantieJaren })}
        />
        <Veld
          label={e.gewensteUitvoering}
          hint={e.gewensteUitvoeringHint}
          waarde={invoer.gewensteUitvoering}
          opWijzig={(gewensteUitvoering) => opWijzig({ gewensteUitvoering })}
        />
      </Kaart>
    </div>
  );
}

/**
 * Eén gekozen werkzaamheid: per eenheid of per uur (OFM-048), aantal, prijs, materialen, opties,
 * notitie en subtotaal.
 */
function WerkKaart({
  werk,
  set,
  totaalM2,
  hint,
  opWijzig,
  opVerwijder,
  opSlaOp,
}: {
  werk: GekozenWerkzaamheid;
  set: WerkzaamhedenSet;
  totaalM2: number;
  /** OFM-051: het standaardmateriaal bij het huidige daksysteem is een ander dan gekozen. */
  hint: DaksysteemHint | null;
  opWijzig: (deel: Partial<GekozenWerkzaamheid>) => void;
  opVerwijder: () => void;
  opSlaOp: (materiaalId: string | null) => void;
}) {
  const info = werkInfo(set, werk);
  const item = set.werkzaamheden.find((x) => x.sleutel === werk.sleutel);
  const naam = info.label;
  const eenheid = eenheidNaam[info.eenheid];
  const standaard = item ? standaardPrijs(item, werk.perUur) : null;
  const geenUurprijs = werk.perUur && item !== undefined && item.uurprijsCent === null;
  const prijsHint = geenUurprijs ? undefined : item && standaard === null ? t.geenPrijs : t.prijsHint;
  const rekenwijzeNaam = `rekenwijze-${werk.id}`;

  // Kiesbare materialen: de gekoppelde (niet verborgen) plus wat al gekozen is.
  const gekozenMat = new Set(werk.materialen.flatMap((m) => (m.sleutel === null ? [] : [m.sleutel])));
  const kiesbaar = set.materialen.filter(
    (m) =>
      gekozenMat.has(m.sleutel) || (!m.verborgen && item?.materialen.some((x) => x.materiaalId === m.id)),
  );
  const wisselMateriaal = (sleutel: string, aan: boolean) => {
    const materiaal = set.materialen.find((m) => m.sleutel === sleutel);
    if (!materiaal) return;
    opWijzig({
      materialen: aan
        ? [...werk.materialen, kiesMateriaal(materiaal, info.eenheid, werk.aantal)]
        : werk.materialen.filter((m) => m.sleutel !== sleutel),
    });
  };
  const zetMateriaal = (id: string, deel: Partial<GekozenMateriaal>) =>
    opWijzig({ materialen: werk.materialen.map((m) => (m.id === id ? { ...m, ...deel } : m)) });

  const kiesbareOpties = (item?.opties ?? []).filter(
    (o) => !o.verborgen || werk.opties.some((x) => x.sleutel === o.sleutel),
  );
  const extraOpties = werk.opties.filter((o) => !kiesbareOpties.some((x) => x.sleutel === o.sleutel));

  return (
    <Kaart aria-label={naam}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-xl font-semibold">
          {naam}
          {werk.eenmalig && (
            <span className="ml-3 rounded-full bg-vlak px-3 py-1 text-base font-normal text-tekst-zacht">
              {t.eenmalig}
            </span>
          )}
        </h3>
        {werk.eenmalig && <Knop label={t.verwijder(naam)} icoon={Trash2} alleenIcoon onClick={opVerwijder} />}
      </div>

      {werk.eenmalig && (
        <EenmaligVelden
          soort={t.nieuweWerkzaamheid}
          label={werk.eenmalig.label}
          eenheid={werk.eenmalig.eenheid}
          opWijzig={(deel) => opWijzig({ eenmalig: { ...werk.eenmalig!, ...deel } })}
          opSlaOp={() => opSlaOp(null)}
        />
      )}

      {item && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-2 font-semibold">{t.rekenwijze(naam)}</legend>
          <div className="flex flex-wrap gap-x-8">
            {[false, true].map((perUur) => (
              <label
                key={String(perUur)}
                className="inline-flex min-h-12 cursor-pointer items-center gap-4 self-start pr-2"
              >
                <input
                  type="radio"
                  name={rekenwijzeNaam}
                  className="size-7 shrink-0 cursor-pointer accent-accent"
                  checked={werk.perUur === perUur}
                  onChange={() => opWijzig(wisselPerUur(werk, item, perUur, totaalM2))}
                />
                <span>{perUur ? t.perUur : t.perEenheid(eenheidNaam[item.eenheid])}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <GetalVeld
          label={werk.perUur ? t.urenVan(naam) : t.aantalVan(naam)}
          eenheid={eenheid}
          waarde={werk.aantal}
          opWijzig={(aantal) => opWijzig({ aantal: aantal ?? 0 })}
        />
        <div className="flex flex-col gap-2">
          <GetalVeld
            label={werk.perUur ? t.uurprijsVan(naam) : t.prijsVan(naam)}
            eenheid={`${t.euro} / ${eenheid}`}
            hint={prijsHint}
            waarschuwing={geenUurprijs ? t.geenUurprijs : undefined}
            waarde={euro(werk.prijsCent)}
            opWijzig={(prijs) => opWijzig({ prijsCent: cent(prijs) })}
          />
          {item && standaard !== werk.prijsCent && (
            <div>
              <Knop
                label={t.standaardPrijsVan(naam)}
                icoon={RotateCcw}
                onClick={() => opWijzig({ prijsCent: standaard })}
              />
            </div>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">{t.materialen}</legend>
        {hint && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-knop border-2 border-waarschuwing-rand bg-waarschuwing-vlak px-4 py-3 text-waarschuwing">
            <span className="font-semibold">{t.daksysteemHint(hint.materiaal.label)}</span>
            <Knop
              label={t.gebruik}
              aria-label={t.daksysteemGebruik(hint.materiaal.label, naam)}
              icoon={Check}
              onClick={() => opWijzig({ materialen: gebruikDaksysteem(werk, set, hint).materialen })}
            />
          </div>
        )}
        <div className="grid gap-x-6 md:grid-cols-2">
          {kiesbaar.map((m) => (
            <Vinkje
              key={m.id}
              label={m.label}
              aan={gekozenMat.has(m.sleutel)}
              opWijzig={(aan) => wisselMateriaal(m.sleutel, aan)}
            />
          ))}
        </div>
        {werk.materialen.map((m) => {
          const mi = materiaalInfo(set, m);
          return (
            <div key={m.id} className="flex flex-col gap-3 rounded-knop border border-rand bg-vlak p-4">
              {m.eenmalig && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-achtergrond px-3 py-1 text-tekst-zacht">{t.eenmalig}</span>
                  <Knop
                    label={t.verwijder(mi.label)}
                    icoon={Trash2}
                    alleenIcoon
                    onClick={() => opWijzig({ materialen: werk.materialen.filter((x) => x.id !== m.id) })}
                  />
                </div>
              )}
              {m.eenmalig && (
                <EenmaligVelden
                  soort={t.nieuwMateriaal}
                  label={m.eenmalig.label}
                  eenheid={m.eenmalig.eenheid}
                  opWijzig={(deel) => zetMateriaal(m.id, { eenmalig: { ...m.eenmalig!, ...deel } })}
                  opSlaOp={() => opSlaOp(m.id)}
                />
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <GetalVeld
                  label={t.aantalVan(mi.label)}
                  eenheid={eenheidNaam[mi.eenheid]}
                  waarde={m.aantal}
                  opWijzig={(aantal) => zetMateriaal(m.id, { aantal: aantal ?? 0 })}
                />
                <GetalVeld
                  label={t.prijsVan(mi.label)}
                  eenheid={`${t.euro} / ${eenheidNaam[mi.eenheid]}`}
                  waarde={euro(m.prijsCent)}
                  opWijzig={(prijs) => zetMateriaal(m.id, { prijsCent: cent(prijs) })}
                />
              </div>
            </div>
          );
        })}
        <div>
          <Knop
            label={t.anderMateriaalBij(naam)}
            icoon={Plus}
            onClick={() =>
              opWijzig({
                materialen: [
                  ...werk.materialen,
                  {
                    id: crypto.randomUUID(),
                    sleutel: null,
                    eenmalig: { label: '', eenheid: info.eenheid },
                    aantal: werk.aantal,
                    prijsCent: null,
                  },
                ],
              })
            }
          />
        </div>
      </fieldset>

      {(kiesbareOpties.length > 0 || extraOpties.length > 0) && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-semibold">{t.opties}</legend>
          {[...kiesbareOpties.map((o) => o.sleutel), ...extraOpties.map((o) => o.sleutel)].map((sleutel) => {
            const oi = optieInfo(set, werk.sleutel, sleutel);
            const keuze = werk.opties.find((o) => o.sleutel === sleutel);
            const standaard = kiesbareOpties.find((o) => o.sleutel === sleutel)?.prijsCent ?? null;
            return (
              <div key={sleutel} className="grid items-end gap-4 md:grid-cols-2">
                <Vinkje
                  label={oi.label}
                  aan={keuze !== undefined}
                  opWijzig={(aan) =>
                    opWijzig({
                      opties: aan
                        ? [...werk.opties, { sleutel, prijsCent: standaard }]
                        : werk.opties.filter((o) => o.sleutel !== sleutel),
                    })
                  }
                />
                {keuze && (
                  <GetalVeld
                    label={t.prijsVan(oi.label)}
                    eenheid={`${t.euro} / ${eenheidNaam[oi.eenheid]}`}
                    waarde={euro(keuze.prijsCent)}
                    opWijzig={(prijs) =>
                      opWijzig({
                        opties: werk.opties.map((o) =>
                          o.sleutel === sleutel ? { ...o, prijsCent: cent(prijs) } : o,
                        ),
                      })
                    }
                  />
                )}
              </div>
            );
          })}
        </fieldset>
      )}

      <Veld
        meerdereRegels
        rows={2}
        label={t.notitie}
        hint={t.notitieHint}
        waarde={werk.notitie}
        maxLength={2000}
        opWijzig={(notitie) => opWijzig({ notitie })}
      />

      <p className="self-end text-xl font-semibold" aria-live="polite">
        {t.subtotaal}: {formatEuro(bedragWerkzaamheidCent(werk))}
      </p>
    </Kaart>
  );
}

/** Naam en eenheid van een eenmalig item, met de knop "Ook opslaan in instellingen". */
function EenmaligVelden({
  soort,
  label,
  eenheid,
  opWijzig,
  opSlaOp,
}: {
  soort: string;
  label: string;
  eenheid: Eenheid;
  opWijzig: (deel: { label?: string; eenheid?: Eenheid }) => void;
  opSlaOp: () => void;
}) {
  const leeg = label.trim() === '';
  const eenheidId = useId();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-tekst-zacht">{t.eenmaligUitleg}</p>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <Veld
          label={t.naamVan(soort.toLowerCase())}
          waarde={label}
          maxLength={80}
          opWijzig={(l) => opWijzig({ label: l })}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor={eenheidId} className="font-semibold">
            {t.eenheid}
          </label>
          <select
            id={eenheidId}
            className={selectKlasse}
            value={eenheid}
            onChange={(ev) => opWijzig({ eenheid: ev.target.value as Eenheid })}
          >
            {EENHEDEN.map((x) => (
              <option key={x} value={x}>
                {eenheidNaam[x]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Knop label={t.opslaanInInstellingen} icoon={Save} disabled={leeg} onClick={opSlaOp} />
        <span className="text-tekst-zacht">{leeg ? t.opslaanNaamNodig : t.opslaanUitleg}</span>
      </div>
    </div>
  );
}
