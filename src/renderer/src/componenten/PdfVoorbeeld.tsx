import { useEffect, useRef, useState } from 'react';
import { nl } from '../teksten/nl';

// A4 in CSS-pixels (96 dpi): 210 × 297 mm.
const A4_BREEDTE = 794;
const A4_HOOGTE = 1123;

export interface PdfVoorbeeldProps {
  /** HTML in modus `voorbeeld` (§12.5); `null` zolang die nog geladen wordt. */
  html: string | null;
  /** Toegankelijke naam van het voorbeeld; standaard "Voorbeeld van de offerte". */
  titel?: string;
}

/**
 * Voorbeeld van de offerte (TDO §12.5): `<iframe sandbox="" srcdoc>` op A4-formaat, geschaald op de
 * beschikbare breedte. `sandbox=""` blokkeert scripts, formulieren en navigatie in het voorbeeld.
 * De gegevens komen via props: OFM-014 (`offerte:voorbeeldHtml`), OFM-018 (`opmaakVoorbeeld`).
 */
export function PdfVoorbeeld({ html, titel = nl.componenten.pdfVoorbeeld }: PdfVoorbeeldProps) {
  const houder = useRef<HTMLDivElement>(null);
  const [schaal, setSchaal] = useState(1);

  useEffect(() => {
    const el = houder.current;
    if (!el) return;
    // ResizeObserver meldt zich ook direct na `observe`, dus dit zet ook de beginschaal.
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
        <p role="status" className="absolute inset-0 flex items-center justify-center text-tekst-zacht">
          {nl.componenten.pdfVoorbeeldLaden}
        </p>
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
