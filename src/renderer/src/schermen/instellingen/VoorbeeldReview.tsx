import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, EyeOff, Star } from 'lucide-react';
import type { Fout } from '@shared/fouten';
import { alsFout } from '../../api/roep';
import { keurVoorbeeldGoed, maakOnleesbaar, useVoorbeeld, zetTemplate } from '../../api/voorbeelden';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { nl } from '../../teksten/nl';
import { beoordeelSelectie, splitsRedacties, type Selectie } from '../../componenten/redacties';

const t = nl.voorbeelden;

export interface VoorbeeldReviewProps {
  id: string;
  opTerug: () => void;
  /** Na **Ziet er goed uit**; de tab kiest dan het volgende voorbeeld. */
  opGoedgekeurd: (id: string) => void;
}

interface Zwevend {
  selectie: Selectie;
  /** Positie ten opzichte van het tekstvak (px). */
  links: number;
  boven: number;
}

/**
 * Voorbeelden-review (TDO §13.4, FO UC-13 stap 2–4, FE-082/083): de geanonimiseerde tekst met
 * `[VERWIJDERD]` en `[BEDRIJF]` als zwarte balkjes; tekst selecteren toont een zwevende knop
 * **Onleesbaar maken**. Staat binnen de tab Voorbeelden, niet in App.tsx.
 */
export function VoorbeeldReview({ id, opTerug, opGoedgekeurd }: VoorbeeldReviewProps) {
  const voorbeeld = useVoorbeeld(id);
  const tekstRef = useRef<HTMLDivElement>(null);
  const [zwevend, setZwevend] = useState<Zwevend | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<Fout | null>(null);

  // De selectie volgen (ook met Shift + pijltjes): alleen binnen het tekstvak telt.
  useEffect(() => {
    const bijwerken = () => {
      const vak = tekstRef.current;
      const sel = window.getSelection();
      if (!vak || !sel || sel.rangeCount === 0 || sel.isCollapsed) return setZwevend(null);
      const bereik = sel.getRangeAt(0);
      if (!vak.contains(bereik.commonAncestorContainer)) return setZwevend(null);
      const selectie = beoordeelSelectie(sel.toString());
      if (selectie.soort === 'geen') return setZwevend(null);
      const r = bereik.getBoundingClientRect();
      const v = vak.getBoundingClientRect();
      setZwevend({ selectie, links: r.left - v.left, boven: r.bottom - v.top + 8 });
    };
    document.addEventListener('selectionchange', bijwerken);
    return () => document.removeEventListener('selectionchange', bijwerken);
  }, []);

  const doe = async (actie: () => Promise<unknown>) => {
    setBezig(true);
    setFout(null);
    try {
      await actie();
    } catch (e) {
      setFout(alsFout(e));
    } finally {
      setBezig(false);
    }
  };

  const onleesbaar = (fragment: string) =>
    doe(async () => {
      await maakOnleesbaar(id, fragment);
      window.getSelection()?.removeAllRanges();
      setZwevend(null);
    });

  if (voorbeeld.isError)
    return <Foutmelding fout={alsFout(voorbeeld.error)} opnieuw={() => void voorbeeld.refetch()} />;
  const v = voorbeeld.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Knop label={t.terug} icoon={ArrowLeft} onClick={opTerug} />
        <h2 className="min-w-0 flex-1 truncate text-2xl font-semibold">
          {t.reviewTitel}
          {v && <span className="font-normal text-tekst-zacht"> · {v.bestandsnaam}</span>}
        </h2>
      </div>

      {!v ? (
        <p role="status">{nl.algemeen.laden}</p>
      ) : (
        <>
          <p className="max-w-3xl text-tekst-zacht">{t.reviewUitleg}</p>
          {fout && <Foutmelding fout={fout} />}

          <div className="max-h-[55vh] overflow-auto rounded-knop border-2 border-rand bg-achtergrond">
            <div
              ref={tekstRef}
              role="document"
              aria-label={t.tekstLabel}
              className="relative p-6 text-lg leading-relaxed whitespace-pre-wrap"
            >
              {splitsRedacties(v.tekst).map((deel, i) =>
                deel.redactie ? (
                  <mark
                    key={i}
                    className="redactie rounded-sm bg-tekst px-1 text-tekst selection:bg-tekst selection:text-achtergrond"
                    title={deel.redactie === 'bedrijf' ? t.balkBedrijf : t.balkVerwijderd}
                  >
                    {deel.tekst}
                  </mark>
                ) : (
                  <span key={i}>{deel.tekst}</span>
                ),
              )}
              {zwevend && (
                <div
                  className="absolute z-10"
                  style={{ left: Math.max(zwevend.links, 8), top: zwevend.boven }}
                >
                  {zwevend.selectie.soort === 'ok' ? (
                    <Knop
                      label={t.onleesbaarMaken}
                      icoon={EyeOff}
                      variant="gevaar"
                      disabled={bezig}
                      // Niet de selectie kwijtraken door op de knop te drukken.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const s = zwevend.selectie;
                        if (s.soort === 'ok') void onleesbaar(s.fragment);
                      }}
                      className="shadow-lg"
                    />
                  ) : (
                    <p
                      role="status"
                      className="rounded-knop border-2 border-waarschuwing-rand bg-waarschuwing-vlak px-4 py-2 text-waarschuwing shadow-lg"
                    >
                      {t.selectieTeLang}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {v.status === 'te_controleren' ? (
              <>
                <Knop
                  label={t.zietErGoedUit}
                  icoon={CheckCircle2}
                  variant="hoofd"
                  disabled={bezig}
                  onClick={() =>
                    void doe(async () => {
                      await keurVoorbeeldGoed(id);
                      opGoedgekeurd(id);
                    })
                  }
                />
                <p className="text-tekst-zacht">{t.nogControleren}</p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 font-semibold text-goed">
                  <CheckCircle2 aria-hidden="true" className="size-6" />
                  {t.goedgekeurd}
                </p>
                {v.isTemplate ? (
                  <>
                    <p className="flex items-center gap-2 font-semibold text-accent">
                      <Star aria-hidden="true" className="size-6" />
                      {t.isTemplate}
                    </p>
                    <Knop
                      label={t.geenTemplateMeer}
                      disabled={bezig}
                      onClick={() => void doe(() => zetTemplate(null))}
                    />
                  </>
                ) : (
                  <Knop
                    label={t.gebruikAlsTemplate}
                    icoon={Star}
                    disabled={bezig}
                    onClick={() => void doe(() => zetTemplate(id))}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
