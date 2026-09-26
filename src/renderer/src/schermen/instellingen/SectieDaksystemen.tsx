import { useState } from 'react';
import type { DaksysteemRegel, Keuzeoptie, WerkzaamhedenSet } from '@shared/types';
import { daksysteemStandaard } from '@shared/werkzaamheden';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { nl } from '../../teksten/nl';

// Sectie Standaardmaterialen per daksysteem (OFM-051) in de tab Werkzaamheden en prijzen. Bovenaan twee
// rijen chips (ondergrond en nieuwe dakbedekking, elk met "Alle …"), daaronder per werkzaamheid met twee
// of meer kiesbare materialen een keuzeveld voor het standaardmateriaal bij die combinatie ("Geen
// afwijking" = geen regel) en waar de huidige waarde vandaan komt. Alleen afwijkingen worden bewaard; ze
// gaan mee in `werkzaamheden:bewaar` (de set van de tab), dus zelfde autosave als de rest van de tab.

const t = nl.werkzaamheden.daksysteem;
const invoerKlasse =
  'min-h-12 w-full rounded-knop border-2 border-rand bg-achtergrond px-3 py-2 aria-[invalid=true]:border-fout';
const RIJ = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-3';

export interface SectieDaksystemenProps {
  set: WerkzaamhedenSet;
  ondergronden: Keuzeoptie[];
  bedekkingen: Keuzeoptie[];
  /** Nieuwe lijst regels; bewaart meteen. */
  opWijzig: (daksystemen: DaksysteemRegel[]) => void;
  /** Signaal van de autosave van de tab (voor "Bewaard ✓"). */
  signaal: number;
  /** Melding na een wijziging elders in de tab waardoor regels vervielen. */
  melding: string | null;
}

export function SectieDaksystemen({
  set,
  ondergronden,
  bedekkingen,
  opWijzig,
  signaal,
  melding,
}: SectieDaksystemenProps) {
  const [ondergrond, setOndergrond] = useState<string | null>(null);
  const [bedekking, setBedekking] = useState<string | null>(null);
  const regels = set.daksystemen;

  const labelVan = (opties: Keuzeoptie[], sleutel: string | null, alle: string) =>
    sleutel === null ? alle : (opties.find((o) => o.sleutel === sleutel)?.label ?? sleutel);
  const combinatie = (o: string | null, b: string | null) =>
    t.combinatie(
      labelVan(ondergronden, o, t.alleOndergronden),
      labelVan(bedekkingen, b, t.alleBedekkingen),
    );
  const materiaalNaam = (id: string | null) =>
    set.materialen.find((m) => m.id === id)?.label ?? t.geenMateriaal;

  const werken = set.werkzaamheden.filter((w) => w.materialen.length >= 2);
  const beideAlle = ondergrond === null && bedekking === null;

  const zet = (werkzaamheidId: string, materiaalId: string) => {
    const zonder = regels.filter(
      (r) => !(r.werkzaamheidId === werkzaamheidId && r.ondergrond === ondergrond && r.bedekking === bedekking),
    );
    opWijzig(
      materiaalId === '' ? zonder : [...zonder, { werkzaamheidId, ondergrond, bedekking, materiaalId }],
    );
  };

  return (
    <section className="flex flex-col gap-4" aria-label={t.titel}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl font-semibold">{t.titel}</h2>
        <BewaardIndicator signaal={signaal} />
      </div>
      <p className="max-w-3xl text-tekst-zacht">{t.uitleg}</p>
      {melding && (
        <p
          role="status"
          className="rounded-knop border-2 border-waarschuwing-rand bg-waarschuwing-vlak px-4 py-3 text-waarschuwing"
        >
          {melding}
        </p>
      )}

      <Chips
        legenda={t.ondergrond}
        alle={t.alleOndergronden}
        opties={ondergronden}
        waarde={ondergrond}
        aantal={(sleutel) => regels.filter((r) => r.ondergrond === sleutel).length}
        opKies={setOndergrond}
      />
      <Chips
        legenda={t.bedekking}
        alle={t.alleBedekkingen}
        opties={bedekkingen}
        waarde={bedekking}
        aantal={(sleutel) => regels.filter((r) => r.bedekking === sleutel).length}
        opKies={setBedekking}
      />

      {beideAlle ? (
        <p className="text-tekst-zacht">{t.kiesCombinatie}</p>
      ) : werken.length === 0 ? (
        <p className="text-tekst-zacht">{t.geenWerkzaamheden}</p>
      ) : (
        <>
          <h3 className="text-xl font-semibold">{combinatie(ondergrond, bedekking)}</h3>
          <div aria-hidden="true" className={`${RIJ} border-b-2 border-rand px-2 pb-2 font-semibold`}>
            <span>{t.werkzaamheid}</span>
            <span>{t.standaardmateriaal}</span>
            <span>{t.waarVandaan}</span>
          </div>
          <ul aria-label={t.titel} className="flex flex-col">
            {werken.map((w) => {
              const eigen = regels.find(
                (r) => r.werkzaamheidId === w.id && r.ondergrond === ondergrond && r.bedekking === bedekking,
              );
              // Wat zonder eigen regel zou gelden (voor "Geen afwijking (nu: …)").
              const zonderEigen = daksysteemStandaard(
                w,
                ondergrond,
                bedekking,
                regels.filter((r) => r !== eigen),
              );
              const nu = daksysteemStandaard(w, ondergrond, bedekking, regels);
              const bron =
                nu.bron === 'combinatie'
                  ? t.bronCombinatie
                  : nu.bron === 'geerfd' && nu.regel
                    ? `${t.bronGeerfd(combinatie(nu.regel.ondergrond, nu.regel.bedekking))}: ${materiaalNaam(nu.materiaalId)}`
                    : `${t.bronGewoon}: ${materiaalNaam(nu.materiaalId)}`;
              const kiesbaar = set.materialen.filter((m) => w.materialen.some((x) => x.materiaalId === m.id));
              return (
                <li key={w.id} className={`${RIJ} border-b border-rand px-2 py-2`}>
                  <span className="font-semibold">{w.label}</span>
                  <select
                    className={invoerKlasse}
                    aria-label={t.keuzeLabel(w.label, combinatie(ondergrond, bedekking))}
                    value={eigen?.materiaalId ?? ''}
                    onChange={(e) => zet(w.id, e.target.value)}
                  >
                    <option value="">{t.geenAfwijkingNu(materiaalNaam(zonderEigen.materiaalId))}</option>
                    {kiesbaar.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <span className={nu.bron === 'combinatie' ? 'font-semibold' : 'text-tekst-zacht'}>{bron}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Eén rij chips: "Alle …" plus de (zichtbare, of al gebruikte) opties van de keuzelijst, met een teller. */
function Chips({
  legenda,
  alle,
  opties,
  waarde,
  aantal,
  opKies,
}: {
  legenda: string;
  alle: string;
  opties: Keuzeoptie[];
  waarde: string | null;
  aantal: (sleutel: string | null) => number;
  opKies: (sleutel: string | null) => void;
}) {
  const chips: { sleutel: string | null; label: string }[] = [
    { sleutel: null, label: alle },
    ...opties
      .filter((o) => !o.verborgen || aantal(o.sleutel) > 0 || o.sleutel === waarde)
      .map((o) => ({ sleutel: o.sleutel, label: o.label })),
  ];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-lg font-semibold">{legenda}</legend>
      <div className="flex flex-wrap gap-3">
        {chips.map((chip) => {
          const aan = chip.sleutel === waarde;
          const n = aantal(chip.sleutel);
          return (
            <button
              key={chip.sleutel ?? ''}
              type="button"
              aria-pressed={aan}
              onClick={() => opKies(chip.sleutel)}
              className={
                'inline-flex min-h-12 items-center gap-2 rounded-full px-4 py-2 font-semibold ' +
                (aan
                  ? 'border-3 border-accent bg-achtergrond text-accent'
                  : 'border-2 border-rand bg-achtergrond text-tekst hover:border-accent')
              }
            >
              <span>{chip.label}</span>
              <span className="rounded-full bg-vlak px-2 text-tekst">
                <span aria-hidden="true">{n}</span>
                <span className="sr-only">{`, ${nl.werkzaamheden.daksysteem.teller(n)}`}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
