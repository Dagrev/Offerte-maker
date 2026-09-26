import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import {
  kanGroter,
  kanKleiner,
  passendeSchaal,
  useWeergave,
  volgendeStap,
  vorigeStap,
  zoomPercentage,
} from '../stores/weergave';
import { nl } from '../teksten/nl';
import { Knop } from './Knop';

// A4 in CSS-pixels (96 dpi): 210 × 297 mm.
const A4_BREEDTE = 794;
const A4_HOOGTE = 1123;
const A4 = { breedte: A4_BREEDTE, hoogte: A4_HOOGTE };

const t = nl.componenten.zoom;

export interface PdfVoorbeeldProps {
  /** HTML in modus `voorbeeld` (§12.5); `null` zolang die nog geladen wordt. */
  html: string | null;
  /** Toegankelijke naam van het voorbeeld; standaard "Voorbeeld van de offerte". */
  titel?: string;
  /**
   * Met zoomwerkbalk (OFM-054, standaard): de component vult de hoogte van zijn ouder, die dus een
   * hoogte moet hebben. Zonder: een vast A4-vlak op de breedte van de ouder (lay-outtegels, V-22).
   */
  werkbalk?: boolean;
}

/**
 * Voorbeeld van de offerte (TDO §12.5): `<iframe srcdoc>` zonder scripts. Met werkbalk: standaard
 * **Passend** (de hele eerste A4-pagina in de houder), zoomen met −/+ (25–300 %), **Passend**, **100 %**,
 * Ctrl+scroll en Ctrl +/−/0; groter dan de houder = scrollen, over het hele document. De zoomstand
 * staat in `stores/weergave.ts` en geldt zolang de app open is.
 */
export function PdfVoorbeeld({
  html,
  titel = nl.componenten.pdfVoorbeeld,
  werkbalk = true,
}: PdfVoorbeeldProps) {
  return werkbalk ? <ZoomVoorbeeld html={html} titel={titel} /> : <VastVoorbeeld html={html} titel={titel} />;
}

function Laden() {
  return (
    <p role="status" className="absolute inset-0 flex items-center justify-center text-tekst-zacht">
      {nl.componenten.pdfVoorbeeldLaden}
    </p>
  );
}

/**
 * Hoogte van het hele document in de iframe. Kan alleen dankzij `allow-same-origin` (zonder
 * `allow-scripts`); zie de afweging in TDO §12.5. Minstens één A4-pagina.
 */
function documentHoogte(iframe: HTMLIFrameElement | null): number {
  const doc = iframe?.contentDocument;
  const body = doc?.body;
  if (!doc || !body) return A4_HOOGTE;
  const marge = parseFloat(doc.defaultView?.getComputedStyle(body).marginBottom ?? '0') || 0;
  return Math.max(A4_HOOGTE, Math.ceil(body.getBoundingClientRect().bottom + marge));
}

function ZoomVoorbeeld({ html, titel }: { html: string | null; titel: string }) {
  const omhulsel = useRef<HTMLDivElement>(null);
  const houder = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const [maat, setMaat] = useState({ breedte: 0, hoogte: 0 });
  const [docHoogte, setDocHoogte] = useState(A4_HOOGTE);
  const zoom = useWeergave((s) => s.zoom);
  const zetZoom = useWeergave((s) => s.zetZoom);

  const schaal = zoom === 'passend' ? passendeSchaal(maat.breedte, maat.hoogte, A4) : zoom;
  const groter = () => zetZoom(volgendeStap(schaal));
  const kleiner = () => zetZoom(vorigeStap(schaal));

  useEffect(() => {
    const el = houder.current;
    if (!el) return;
    // ResizeObserver meldt zich ook direct na `observe`, dus dit zet ook de beginmaat. Hoogte zonder
    // horizontale schuifbalk (`offsetHeight`): die is er alleen bij een vaste zoom, en de waarnemer
    // meldt het verdwijnen ervan niet, waardoor Passend na 100 % anders een balkhoogte te klein werd.
    const waarnemer = new ResizeObserver(() => setMaat({ breedte: el.clientWidth, hoogte: el.offsetHeight }));
    waarnemer.observe(el);
    return () => waarnemer.disconnect();
  }, []);

  // Ctrl+scroll: een niet-passieve luisteraar, anders zoomt Chromium de hele pagina.
  const schaalRef = useRef(schaal);
  useEffect(() => {
    schaalRef.current = schaal;
  }, [schaal]);
  useEffect(() => {
    const el = omhulsel.current;
    if (!el) return;
    const opWiel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const huidig = schaalRef.current;
      useWeergave.getState().zetZoom(e.deltaY < 0 ? volgendeStap(huidig) : vorigeStap(huidig));
    };
    el.addEventListener('wheel', opWiel, { passive: false });
    return () => el.removeEventListener('wheel', opWiel);
  }, []);

  // Ctrl + / Ctrl − / Ctrl 0 terwijl het voorbeeld of de werkbalk focus heeft (niet de paginazoom).
  const opToets = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      groter();
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      kleiner();
    } else if (e.key === '0') {
      e.preventDefault();
      zetZoom('passend');
    }
  };

  const percentage = zoomPercentage(schaal);
  return (
    <div ref={omhulsel} onKeyDown={opToets} className="flex h-full min-h-0 flex-col gap-2">
      <div role="toolbar" aria-label={t.werkbalk} className="flex flex-wrap items-center gap-2">
        <Knop
          label={t.kleiner}
          icoon={ZoomOut}
          alleenIcoon
          disabled={!kanKleiner(schaal)}
          onClick={kleiner}
        />
        <span aria-live="polite" className="min-w-16 text-center font-semibold tabular-nums">
          <span className="sr-only">{t.huidig} </span>
          {percentage}
        </span>
        <Knop label={t.groter} icoon={ZoomIn} alleenIcoon disabled={!kanGroter(schaal)} onClick={groter} />
        <Knop
          label={t.passend}
          icoon={Maximize}
          title={t.passendUitleg}
          aria-pressed={zoom === 'passend'}
          onClick={() => zetZoom('passend')}
        />
        <Knop label={t.ware} title={t.wareUitleg} aria-pressed={zoom === 1} onClick={() => zetZoom(1)} />
      </div>
      {/* tabIndex: het scrollbare voorbeeld moet met het toetsenbord te scrollen zijn (axe, OFM-027). */}
      <div
        ref={houder}
        role="group"
        aria-label={titel}
        tabIndex={0}
        data-schaal={schaal}
        className="flex min-h-0 flex-1 overflow-auto rounded-md bg-vlak p-4"
      >
        <div
          className="relative m-auto shrink-0 overflow-hidden rounded-sm bg-white shadow-md ring-1 ring-rand"
          style={{ width: A4_BREEDTE * schaal, height: (html === null ? A4_HOOGTE : docHoogte) * schaal }}
        >
          {html === null ? (
            <Laden />
          ) : (
            <>
              <iframe
                ref={iframe}
                // Geen scripts, formulieren of navigatie; `allow-same-origin` alleen om de documenthoogte
                // te lezen (OFM-054, TDO §12.5).
                sandbox="allow-same-origin"
                srcDoc={html}
                title={titel}
                tabIndex={-1}
                width={A4_BREEDTE}
                height={docHoogte}
                onLoad={() => setDocHoogte(documentHoogte(iframe.current))}
                className="absolute top-0 left-0 origin-top-left border-0 bg-white"
                style={{ transform: `scale(${schaal})` }}
              />
              {/* Vangt muis en wiel op: Ctrl+scroll boven het voorbeeld zoomt, gewoon scrollen scrolt de houder. */}
              <div aria-hidden="true" className="absolute inset-0" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Zonder werkbalk: A4-vlak op de beschikbare breedte, alleen de eerste pagina (lay-outtegels). */
function VastVoorbeeld({ html, titel }: { html: string | null; titel: string }) {
  const houder = useRef<HTMLDivElement>(null);
  const [schaal, setSchaal] = useState(1);

  useEffect(() => {
    const el = houder.current;
    if (!el) return;
    const waarnemer = new ResizeObserver(() => setSchaal(el.clientWidth / A4_BREEDTE));
    waarnemer.observe(el);
    return () => waarnemer.disconnect();
  }, []);

  return (
    <div
      ref={houder}
      className="relative aspect-[210/297] w-full overflow-hidden rounded-md border border-rand bg-achtergrond shadow-md"
    >
      {html === null ? (
        <Laden />
      ) : (
        <iframe
          sandbox=""
          srcDoc={html}
          title={titel}
          width={A4_BREEDTE}
          height={A4_HOOGTE}
          className="absolute top-0 left-0 origin-top-left border-0 bg-white"
          style={{ transform: `scale(${schaal})` }}
        />
      )}
    </div>
  );
}
