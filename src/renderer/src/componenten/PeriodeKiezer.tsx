import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  kiesbareJaren,
  maandenVanJaar,
  maandRaster,
  periodeVan,
  verschuif,
  weeknummer,
  zelfdePeriode,
} from '@shared/periode';
import type { Weergave } from '../stores/navigatie';
import { nl } from '../teksten/nl';
import { Knop } from './Knop';

// Periodekiezer van het hoofdscherm (OFM-037, FO UC-02). Eigen component op `date-fns` via
// `shared/periode.ts` (geen nieuw pakket, V-03); alle datumrekenwerk zit daar.

const t = nl.overzicht.kiezer;

export interface PeriodeKiezerProps {
  open: boolean;
  weergave: Weergave;
  /** Een datum in de periode die nu op het hoofdscherm staat. */
  datum: string;
  /** Vandaag volgens main (V-10). */
  vandaag: string;
  /** Gekozen periode, als één datum erin (de eerste dag). */
  opKies: (datum: string) => void;
  opSluit: () => void;
}

/**
 * Modaal venster (native `<dialog>` met `showModal()`, zoals `Bevestiging`): focus blijft erin, Escape
 * en klikken buiten sluiten zonder wijziging. De inhoud past bij de weergave: dag- of weekkalender van
 * een maand, twaalf maanden van een jaar, of een lijst van jaren.
 */
export function PeriodeKiezer({ open, weergave, datum, vandaag, opKies, opSluit }: PeriodeKiezerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titelId = useId();

  useEffect(() => {
    const dialoog = ref.current;
    if (!dialoog) return;
    if (open && !dialoog.open) {
      dialoog.showModal();
      // `showModal` zet de focus op de eerste knop (Sluiten); de gekozen periode is handiger.
      dialoog.querySelector<HTMLElement>('[data-sleutel][tabindex="0"]')?.focus();
    }
    if (!open && dialoog.open) dialoog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titelId}
      data-periodekiezer={weergave}
      onCancel={(e) => {
        e.preventDefault();
        opSluit();
      }}
      // Zonder padding op de dialog zelf is hij alleen het doel van een klik op de achtergrond.
      onClick={(e) => {
        if (e.target === e.currentTarget) opSluit();
      }}
      className="m-auto max-w-[95vw] rounded-knop border border-rand bg-achtergrond p-0 text-tekst shadow-xl backdrop:bg-black/40"
    >
      {open && (
        <Inhoud
          titelId={titelId}
          weergave={weergave}
          datum={datum}
          vandaag={vandaag}
          opKies={opKies}
          opSluit={opSluit}
        />
      )}
    </dialog>
  );
}

type InhoudProps = Omit<PeriodeKiezerProps, 'open'> & { titelId: string };

/** Pijltjestoetsen per weergave: [links/rechts, omhoog/omlaag, PageUp/PageDown] als (eenheid, stappen). */
const STAPPEN: Record<
  Weergave,
  { horizontaal: [Weergave, number]; verticaal: [Weergave, number]; pagina: [Weergave, number] }
> = {
  dag: { horizontaal: ['dag', 1], verticaal: ['week', 1], pagina: ['maand', 1] },
  week: { horizontaal: ['week', 1], verticaal: ['week', 1], pagina: ['maand', 1] },
  maand: { horizontaal: ['maand', 1], verticaal: ['maand', 3], pagina: ['jaar', 1] },
  jaar: { horizontaal: ['jaar', 1], verticaal: ['jaar', 4], pagina: ['jaar', 4] },
};

function Inhoud({ titelId, weergave, datum, vandaag, opKies, opSluit }: InhoudProps) {
  const gekozen = periodeVan(weergave, datum).van;
  // `zicht`: welke maand (dag/week) of welk jaar (maand) in beeld is; `focus`: de knop met de focus.
  const [zicht, setZicht] = useState(datum);
  const [focus, setFocus] = useState(gekozen);
  // Alleen na een pijltjestoets de focus verplaatsen; bij openen doet `PeriodeKiezer` dat.
  const verplaatsFocus = useRef(false);
  const rasterRef = useRef<HTMLDivElement>(null);

  const raster = weergave === 'dag' || weergave === 'week' ? maandRaster(zicht) : [];
  const sleutels =
    weergave === 'dag'
      ? raster.flat()
      : weergave === 'week'
        ? raster.map((week) => week[0] ?? '')
        : weergave === 'maand'
          ? maandenVanJaar(zicht)
          : kiesbareJaren(vandaag, datum);
  // Eén tabstop in het raster: de focus, anders de gekozen periode, anders de eerste knop.
  const tabstop = sleutels.includes(focus)
    ? focus
    : sleutels.includes(gekozen)
      ? gekozen
      : (sleutels[0] ?? '');

  useLayoutEffect(() => {
    if (!verplaatsFocus.current) return;
    verplaatsFocus.current = false;
    rasterRef.current?.querySelector<HTMLButtonElement>(`[data-sleutel="${tabstop}"]`)?.focus();
  }, [tabstop]);

  const opToets = (e: KeyboardEvent<HTMLDivElement>) => {
    const stap = STAPPEN[weergave];
    const [eenheid, aantal] =
      e.key === 'ArrowLeft' || e.key === 'ArrowRight'
        ? stap.horizontaal
        : e.key === 'ArrowUp' || e.key === 'ArrowDown'
          ? stap.verticaal
          : e.key === 'PageUp' || e.key === 'PageDown'
            ? stap.pagina
            : [null, 0];
    if (eenheid === null) return;
    e.preventDefault();
    const terug = e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp';
    const nieuw = periodeVan(weergave, verschuif(eenheid, tabstop, terug ? -aantal : aantal)).van;
    if (weergave === 'jaar' && !sleutels.includes(nieuw)) return;
    verplaatsFocus.current = true;
    setFocus(nieuw);
    // Buiten beeld: de maand (of het jaar) van de nieuwe focus in beeld; bij een week vooruit de maand
    // waarin die week eindigt, zodat de week niet als laatste rij van de vorige maand terugkomt.
    if (!sleutels.includes(nieuw))
      setZicht(weergave === 'week' && !terug ? verschuif('dag', nieuw, 6) : nieuw);
  };

  const bladerEenheid: Weergave = weergave === 'maand' ? 'jaar' : 'maand';
  const kop = weergave === 'jaar' ? null : periodeVan(bladerEenheid, zicht).label;

  const knopKlassen = (sleutel: string, extra = '') =>
    [
      'rounded-knop border-2 font-semibold tabular-nums',
      sleutel === gekozen
        ? 'border-accent bg-accent text-white'
        : 'border-transparent hover:border-accent hover:bg-vlak',
      extra,
    ].join(' ');

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id={titelId} className="text-2xl font-semibold">
          {t.titel[weergave]}
        </h2>
        <Knop label={t.sluiten} alleenIcoon icoon={X} onClick={opSluit} />
      </div>
      <p className="text-tekst-zacht">{t.uitleg}</p>

      {kop !== null && (
        <div className="flex items-center justify-between gap-3">
          <Knop
            label={weergave === 'maand' ? t.vorigJaar : t.vorigeMaand}
            alleenIcoon
            icoon={ChevronLeft}
            onClick={() => setZicht(verschuif(bladerEenheid, zicht, -1))}
          />
          <p aria-live="polite" className="text-xl font-semibold first-letter:uppercase">
            {kop}
          </p>
          <Knop
            label={weergave === 'maand' ? t.volgendJaar : t.volgendeMaand}
            alleenIcoon
            icoon={ChevronRight}
            onClick={() => setZicht(verschuif(bladerEenheid, zicht, 1))}
          />
        </div>
      )}

      <div ref={rasterRef} onKeyDown={opToets}>
        {weergave === 'dag' && (
          <div className="grid grid-cols-7 gap-1">
            {t.weekdagen.map((dag) => (
              <span key={dag} aria-hidden="true" className="text-center text-tekst-zacht">
                {dag}
              </span>
            ))}
            {raster.flat().map((dag) => (
              <button
                key={dag}
                type="button"
                data-sleutel={dag}
                tabIndex={dag === tabstop ? 0 : -1}
                aria-label={periodeVan('dag', dag).label}
                aria-pressed={dag === gekozen}
                aria-current={dag === vandaag ? 'date' : undefined}
                onClick={() => opKies(dag)}
                className={knopKlassen(
                  dag,
                  'size-14 ' +
                    (dag === vandaag && dag !== gekozen ? 'underline decoration-2 underline-offset-4 ' : '') +
                    (!zelfdePeriode('maand', dag, zicht) && dag !== gekozen
                      ? 'font-normal text-tekst-zacht'
                      : ''),
                )}
              >
                {Number(dag.slice(8))}
              </button>
            ))}
          </div>
        )}

        {weergave === 'week' && (
          <div className="flex flex-col gap-1">
            <div aria-hidden="true" className="grid grid-cols-8 px-[2px] text-center text-tekst-zacht">
              <span>{t.week}</span>
              {t.weekdagen.map((dag) => (
                <span key={dag}>{dag}</span>
              ))}
            </div>
            {raster.map((week) => {
              const maandag = week[0] ?? '';
              return (
                <button
                  key={maandag}
                  type="button"
                  data-sleutel={maandag}
                  tabIndex={maandag === tabstop ? 0 : -1}
                  aria-label={periodeVan('week', maandag).label}
                  aria-pressed={maandag === gekozen}
                  aria-current={zelfdePeriode('week', maandag, vandaag) ? 'date' : undefined}
                  onClick={() => opKies(maandag)}
                  className={knopKlassen(maandag, 'grid min-h-14 w-full grid-cols-8 items-center')}
                >
                  <span aria-hidden="true">{weeknummer(maandag)}</span>
                  {week.map((dag) => (
                    <span
                      key={dag}
                      aria-hidden="true"
                      className={
                        'min-w-12 font-normal ' +
                        (!zelfdePeriode('maand', dag, zicht) && maandag !== gekozen ? 'text-tekst-zacht' : '')
                      }
                    >
                      {Number(dag.slice(8))}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        )}

        {weergave === 'maand' && (
          <div className="grid grid-cols-3 gap-2">
            {maandenVanJaar(zicht).map((maand) => {
              const label = periodeVan('maand', maand).label;
              return (
                <button
                  key={maand}
                  type="button"
                  data-sleutel={maand}
                  tabIndex={maand === tabstop ? 0 : -1}
                  aria-label={label}
                  aria-pressed={maand === gekozen}
                  aria-current={zelfdePeriode('maand', maand, vandaag) ? 'date' : undefined}
                  onClick={() => opKies(maand)}
                  className={knopKlassen(maand, 'min-h-14 min-w-36 px-4 first-letter:uppercase')}
                >
                  {label.replace(/ \d{4}$/, '')}
                </button>
              );
            })}
          </div>
        )}

        {weergave === 'jaar' && (
          <div className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto p-1">
            {sleutels.map((jaar) => (
              <button
                key={jaar}
                type="button"
                data-sleutel={jaar}
                tabIndex={jaar === tabstop ? 0 : -1}
                aria-pressed={jaar === gekozen}
                aria-current={zelfdePeriode('jaar', jaar, vandaag) ? 'date' : undefined}
                onClick={() => opKies(jaar)}
                className={knopKlassen(jaar, 'min-h-14 min-w-28 px-4')}
              >
                {periodeVan('jaar', jaar).label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Knop label={t.vandaag} onClick={() => opKies(vandaag)} />
      </div>
    </div>
  );
}
