import { useEffect, useId, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { Fout } from '@shared/fouten';
import { bewaarInstelling } from '../../api/instellingen';
import { alsFout, roep } from '../../api/roep';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import {
  useTemplateVoorstellen,
  voorstellenLijst,
  type TemplateTekstVeld,
} from '../../stores/templateVoorstellen';
import { nl } from '../../teksten/nl';

const t = nl.voorbeelden.voorstellen;

/**
 * Modaal met de voorstellen voor de standaardteksten uit het template (OFM-024, FE-084, V-27): per
 * tekst **Overnemen** of **Niet overnemen**. Overnemen wijzigt alleen die ene tekst: de huidige
 * `teksten` worden vers opgehaald, één veld vervangen en het hele object bewaard.
 */
export function TemplateVoorstellen() {
  const voorstellen = useTemplateVoorstellen((s) => s.voorstellen);
  const handelAf = useTemplateVoorstellen((s) => s.handelAf);
  const sluit = useTemplateVoorstellen((s) => s.sluit);
  const ref = useRef<HTMLDialogElement>(null);
  const titelId = useId();
  const [bezig, setBezig] = useState<TemplateTekstVeld | null>(null);
  const [fout, setFout] = useState<Fout | null>(null);
  const lijst = voorstellenLijst(voorstellen);
  const open = lijst.length > 0;

  useEffect(() => {
    const dialoog = ref.current;
    if (!dialoog) return;
    if (open && !dialoog.open) dialoog.showModal();
    if (!open && dialoog.open) dialoog.close();
  }, [open]);

  const neemOver = async (veld: TemplateTekstVeld, tekst: string) => {
    setBezig(veld);
    setFout(null);
    try {
      const { teksten } = await roep(window.api.instellingenHaal());
      await bewaarInstelling({ sleutel: 'teksten', waarde: { ...teksten, [veld]: tekst } });
      handelAf(veld);
    } catch (e) {
      setFout(alsFout(e));
    } finally {
      setBezig(null);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titelId}
      onCancel={(e) => {
        e.preventDefault();
        sluit();
      }}
      className="m-auto max-h-[90vh] w-full max-w-3xl overflow-auto rounded-knop border border-rand bg-achtergrond p-8 text-tekst shadow-xl backdrop:bg-black/40"
    >
      {open && (
        <div className="flex flex-col gap-6">
          <h2 id={titelId} className="text-2xl font-semibold">
            {t.titel}
          </h2>
          <p className="text-tekst-zacht">{t.uitleg}</p>
          {fout && <Foutmelding fout={fout} />}
          <ul className="flex flex-col gap-4">
            {lijst.map(({ veld, tekst }) => (
              <li key={veld} className="flex flex-col gap-3 rounded-knop border border-rand bg-vlak p-5">
                <h3 className="text-lg font-semibold">{t.veld[veld]}</h3>
                <p className="whitespace-pre-wrap">{tekst}</p>
                <div className="flex flex-wrap gap-3">
                  <Knop
                    label={t.overnemen}
                    aria-label={t.overnemenLabel(t.veld[veld])}
                    icoon={Check}
                    disabled={bezig !== null}
                    onClick={() => void neemOver(veld, tekst)}
                  />
                  <Knop
                    label={t.nietOvernemen}
                    aria-label={t.nietOvernemenLabel(t.veld[veld])}
                    icoon={X}
                    disabled={bezig !== null}
                    onClick={() => handelAf(veld)}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Knop label={t.sluiten} onClick={sluit} autoFocus />
          </div>
        </div>
      )}
    </dialog>
  );
}
