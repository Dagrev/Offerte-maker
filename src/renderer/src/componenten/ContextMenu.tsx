import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, type LucideIcon } from 'lucide-react';
import { plaatsBinnen } from './menuPlaats';

// Contextmenu (OFM-052, WAI-ARIA menu-patroon, geen pakket). Herbruikbaar: de aanroeper geeft de regels
// en een positie (muis, of bij het toetsenbord de hoek van de rij) en ruimt het menu op in `opSluit`.
// Het menu staat in een portal op `document.body`, `position: fixed`, en spiegelt bij de rand van het
// venster. Alle regels zijn met de pijltjes bereikbaar, ook uitgeschakelde (`aria-disabled`, APG); die
// tonen hun reden als tooltip, via `aria-describedby` gekoppeld.

/** Een gewone actie (`menuitem`) of een keuze uit een groep (`menuitemradio`, met `gekozen`). */
export interface MenuActie {
  label: string;
  icoon?: LucideIcon;
  /** Gezet = uitgeschakeld; de tekst is de reden (tooltip en `aria-describedby`). */
  uitReden?: string;
  /** Alleen bij keuzes in een groep: de huidige waarde. */
  gekozen?: boolean;
  gevaar?: boolean;
  opKies: () => void;
}

export type MenuRegel =
  | ({ soort: 'actie' } & MenuActie)
  | { soort: 'groep'; label: string; keuzes: MenuActie[] }
  | { soort: 'scheiding' };

/** Waarom het menu sluit; bij `escape` en `keuze` hoort de focus terug naar waar het menu vandaan kwam. */
export type SluitReden = 'escape' | 'keuze' | 'buiten' | 'scroll' | 'tab';

export interface ContextMenuProps {
  /** Toegankelijke naam van het menu. */
  label: string;
  /** Linkerbovenhoek in viewport-pixels (clientX/clientY). */
  positie: { x: number; y: number };
  regels: MenuRegel[];
  opSluit: (reden: SluitReden) => void;
}

/** Ruimte die de tooltip met de reden onder het menu nodig heeft (twee regels tekst). */
const TOOLTIP_RUIMTE = 96;

/** Aantal focusbare regels in één menuregel. */
function aantalActies(regel: MenuRegel | undefined): number {
  if (regel?.soort === 'actie') return 1;
  if (regel?.soort === 'groep') return regel.keuzes.length;
  return 0;
}

export function ContextMenu({ label, positie, regels, opSluit }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  /** Menu plus tooltips: een klik hierbinnen is geen klik "erbuiten". */
  const buitenRef = useRef<HTMLDivElement>(null);
  const basisId = useId();
  const [plek, setPlek] = useState<{ x: number; y: number; tooltipBoven: boolean } | null>(null);
  const [actief, setActief] = useState(0);

  // Alle focusbare regels op volgorde (acties en de keuzes in groepen).
  const acties: MenuActie[] = regels.flatMap((r) =>
    r.soort === 'actie' ? [r] : r.soort === 'groep' ? r.keuzes : [],
  );

  // Eerst onzichtbaar meten, dan binnen het venster plaatsen (spiegelen bij de rand).
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const p = plaatsBinnen(
      positie,
      { breedte: width, hoogte: height },
      { breedte: window.innerWidth, hoogte: window.innerHeight },
    );
    // De reden van een uitgeschakelde regel staat onder het menu, of erboven als daar geen plaats is.
    setPlek({ ...p, tooltipBoven: p.y + height + TOOLTIP_RUIMTE > window.innerHeight });
  }, [positie]);

  // Focus op de actieve regel (bij openen de eerste).
  useEffect(() => {
    if (plek === null) return;
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${actief}"]`)?.focus();
  }, [actief, plek]);

  // Sluiten bij een klik erbuiten, bij scrollen buiten het menu en als het venster de focus verliest.
  useEffect(() => {
    const buiten = (e: MouseEvent) => {
      if (!buitenRef.current?.contains(e.target as Node)) opSluit('buiten');
    };
    const scroll = (e: Event) => {
      if (!buitenRef.current?.contains(e.target as Node)) opSluit('scroll');
    };
    const weg = () => opSluit('buiten');
    document.addEventListener('mousedown', buiten, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', weg);
    window.addEventListener('blur', weg);
    return () => {
      document.removeEventListener('mousedown', buiten, true);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', weg);
      window.removeEventListener('blur', weg);
    };
  }, [opSluit]);

  const kies = (actie: MenuActie) => {
    if (actie.uitReden !== undefined) return;
    opSluit('keuze');
    actie.opKies();
  };

  const toets = (e: KeyboardEvent<HTMLDivElement>) => {
    const laatste = acties.length - 1;
    const naar: Record<string, number> = {
      ArrowDown: actief >= laatste ? 0 : actief + 1,
      ArrowUp: actief <= 0 ? laatste : actief - 1,
      Home: 0,
      End: laatste,
    };
    if (e.key in naar) {
      e.preventDefault();
      setActief(naar[e.key] ?? 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      opSluit('escape');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      opSluit('tab');
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const actie = acties[actief];
      if (actie) kies(actie);
    }
  };

  // Index van de eerste focusbare regel per menuregel (acties en groepskeuzes lopen door).
  const eerste = regels.reduce<number[]>(
    (acc, _r, n) => [...acc, n === 0 ? 0 : (acc[n - 1] ?? 0) + aantalActies(regels[n - 1])],
    [],
  );
  const knop = (actie: MenuActie, rol: 'menuitem' | 'menuitemradio', i: number) => {
    const redenId = `${basisId}-reden-${i}`;
    const uit = actie.uitReden !== undefined;
    const Icoon = rol === 'menuitemradio' ? (actie.gekozen ? Check : null) : (actie.icoon ?? null);
    return (
      <button
        key={i}
        type="button"
        role={rol}
        tabIndex={i === actief ? 0 : -1}
        data-index={i}
        aria-checked={rol === 'menuitemradio' ? (actie.gekozen ?? false) : undefined}
        aria-disabled={uit || undefined}
        aria-describedby={uit ? redenId : undefined}
        onClick={() => kies(actie)}
        onMouseEnter={() => setActief(i)}
        className={`flex min-h-12 w-full items-center gap-3 rounded-knop px-4 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          i === actief ? 'bg-vlak' : ''
        } ${uit ? 'cursor-not-allowed text-tekst-zacht' : actie.gevaar ? 'text-fout' : 'text-tekst'} ${
          actie.gekozen ? 'font-semibold' : ''
        }`}
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          {Icoon && <Icoon aria-hidden="true" className="size-5" />}
        </span>
        {actie.label}
      </button>
    );
  };

  return createPortal(
    <div
      ref={buitenRef}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        left: plek?.x ?? positie.x,
        top: plek?.y ?? positie.y,
        visibility: plek === null ? 'hidden' : 'visible',
      }}
      className="fixed z-50"
    >
      {/* Redenen van uitgeschakelde regels: buiten het menu (een menu bevat alleen menuregels) en
          niet over de andere regels heen; alleen die van de actieve regel is zichtbaar. */}
      {acties.map((actie, i) =>
        actie.uitReden === undefined ? null : (
          <span
            key={i}
            role="tooltip"
            id={`${basisId}-reden-${i}`}
            hidden={i !== actief}
            className={`pointer-events-none absolute left-0 w-max max-w-sm rounded-knop border border-rand bg-achtergrond p-3 text-base text-tekst shadow-lg ${
              plek?.tooltipBoven ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            {actie.uitReden}
          </span>
        ),
      )}
      <div
        ref={menuRef}
        role="menu"
        aria-label={label}
        aria-orientation="vertical"
        onKeyDown={toets}
        className="flex min-w-72 flex-col gap-1 rounded-knop border border-rand bg-achtergrond p-2 text-tekst shadow-xl"
      >
        {regels.map((regel, r) => {
          if (regel.soort === 'scheiding') {
            return <div key={`s${r}`} role="separator" className="my-1 border-t border-rand" />;
          }
          if (regel.soort === 'actie')
            return <Fragment key={`a${r}`}>{knop(regel, 'menuitem', eerste[r] ?? 0)}</Fragment>;
          const kopId = `${basisId}-groep-${r}`;
          return (
            <div key={`g${r}`} role="group" aria-labelledby={kopId} className="flex flex-col gap-1">
              <div
                id={kopId}
                aria-hidden="true"
                className="px-4 pt-1 text-base font-semibold text-tekst-zacht"
              >
                {regel.label}
              </div>
              {regel.keuzes.map((keuze, k) => knop(keuze, 'menuitemradio', (eerste[r] ?? 0) + k))}
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
