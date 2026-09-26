import { useEffect, useState } from 'react';
import { Check, Type } from 'lucide-react';
import { VASTE_ACCENTKLEUREN } from '@shared/pdf-template/kleuren';
import type { Instellingen, Opmaak } from '@shared/types';
import { bewaarInstelling, useOpmaakVoorbeeld } from '../../api/instellingen';
import { alsFout } from '../../api/roep';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { PdfVoorbeeld } from '../../componenten/PdfVoorbeeld';
import { TegelKeuze } from '../../componenten/TegelKeuze';
import { Veld } from '../../componenten/Veld';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';

const t = nl.instellingen.opmaak;
const LAYOUTS: Opmaak['layout'][] = ['klassiek', 'modern', 'compact'];
const LETTERTYPES: Opmaak['lettertype'][] = ['inter', 'merriweather', 'source-sans-3'];
const HEX = /^#[0-9A-Fa-f]{6}$/;
const VOORBEELD_DEBOUNCE_MS = 300;

/** Eigen kleur netjes maken: `#` ervoor, hoofdletters. Alleen `#RRGGBB` is geldig. */
function normaliseerKleur(tekst: string): string {
  const t = tekst.trim().toUpperCase();
  return t.startsWith('#') ? t : `#${t}`;
}

/** Tab Opmaak (FE-071, FE-072, V-22): lay-out, accentkleur en lettertype met live voorbeeld. */
export function TabOpmaak({ instellingen }: { instellingen: Instellingen }) {
  const [opmaak, setOpmaak] = useState<Opmaak>(instellingen.opmaak);
  const vast = VASTE_ACCENTKLEUREN.some((k) => k.kleur === opmaak.accentkleur.toUpperCase());
  const [eigenKleur, setEigenKleur] = useState(vast ? '' : opmaak.accentkleur);
  const bewaren = useAutoBewaar(
    (waarde: Opmaak) => bewaarInstelling({ sleutel: 'opmaak', waarde }),
    (waarde) => HEX.test(waarde.accentkleur),
  );

  // Het live voorbeeld volgt de opmaak met 300 ms vertraging (FE-072: binnen 1 s zichtbaar).
  const [voorbeeldOpmaak, setVoorbeeldOpmaak] = useState(opmaak);
  useEffect(() => {
    const timer = setTimeout(() => setVoorbeeldOpmaak(opmaak), VOORBEELD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [opmaak]);
  const voorbeeld = useOpmaakVoorbeeld(voorbeeldOpmaak);

  const kies = (deel: Partial<Opmaak>) => {
    const nieuw = { ...opmaak, ...deel };
    setOpmaak(nieuw);
    bewaren.bewaarDirect(nieuw);
  };

  const wijzigEigenKleur = (tekst: string) => {
    setEigenKleur(tekst);
    const kleur = normaliseerKleur(tekst);
    if (!HEX.test(kleur)) return;
    const nieuw = { ...opmaak, accentkleur: kleur };
    setOpmaak(nieuw);
    bewaren.wijzig(nieuw);
  };
  const eigenKleurFout =
    eigenKleur !== '' && !HEX.test(normaliseerKleur(eigenKleur)) ? t.eigenKleurFout : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,24rem)] gap-8">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-tekst-zacht">{t.uitleg}</p>
          <BewaardIndicator signaal={bewaren.signaal} />
        </div>
        {bewaren.fout && <Foutmelding fout={bewaren.fout} opnieuw={bewaren.bewaarNu} />}

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-semibold">{t.layout}</legend>
          <div className="flex flex-wrap gap-4">
            {LAYOUTS.map((layout) => (
              <LayoutTegel
                key={layout}
                opmaak={{ ...opmaak, layout }}
                gekozen={opmaak.layout === layout}
                opKies={() => kies({ layout })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-semibold">{t.accentkleur}</legend>
          <div className="flex flex-wrap gap-3">
            {VASTE_ACCENTKLEUREN.map(({ kleur, naam }) => {
              const gekozen = opmaak.accentkleur.toUpperCase() === kleur;
              return (
                <button
                  key={kleur}
                  type="button"
                  aria-pressed={gekozen}
                  onClick={() => {
                    setEigenKleur('');
                    kies({ accentkleur: kleur });
                  }}
                  className={
                    'flex min-h-14 items-center gap-3 rounded-knop bg-achtergrond px-4 font-semibold ' +
                    (gekozen ? 'border-3 border-accent' : 'border-2 border-rand hover:border-accent')
                  }
                >
                  <span
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: kleur }}
                  >
                    {gekozen && <Check className="size-5" strokeWidth={3} />}
                  </span>
                  {naam}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-start gap-4">
            <div className="w-72">
              <Veld
                label={t.eigenKleur}
                hint={t.eigenKleurHint}
                fout={eigenKleurFout}
                waarde={eigenKleur}
                opWijzig={wijzigEigenKleur}
                onBlur={bewaren.bewaarNu}
                maxLength={7}
                spellCheck={false}
              />
            </div>
            <input
              type="color"
              aria-label={t.kleurKiezer}
              title={t.kleurKiezer}
              value={HEX.test(opmaak.accentkleur) ? opmaak.accentkleur.toLowerCase() : '#1f4e79'}
              onChange={(e) => wijzigEigenKleur(e.target.value)}
              className="mt-9 h-14 w-20 cursor-pointer rounded-knop border-2 border-rand bg-achtergrond p-1"
            />
          </div>
        </fieldset>

        <TegelKeuze
          label={t.lettertype}
          waarde={opmaak.lettertype}
          opKies={(lettertype) => kies({ lettertype })}
          opties={LETTERTYPES.map((l) => ({ waarde: l, label: t.lettertypes[l], icoon: Type }))}
        />
      </div>

      {/* OFM-054: het voorbeeld met zoomwerkbalk vult deze hoogte. */}
      <div className="sticky top-6 flex h-[calc(100vh-12rem)] min-h-96 flex-col self-start">
        {voorbeeld.isError ? (
          <Foutmelding fout={alsFout(voorbeeld.error)} opnieuw={() => void voorbeeld.refetch()} />
        ) : (
          <PdfVoorbeeld html={voorbeeld.data?.html ?? null} titel={t.voorbeeld} />
        )}
      </div>
    </div>
  );
}

/** Lay-outtegel met een verkleind voorbeeld van die lay-out (V-22). */
function LayoutTegel({ opmaak, gekozen, opKies }: { opmaak: Opmaak; gekozen: boolean; opKies: () => void }) {
  const voorbeeld = useOpmaakVoorbeeld(opmaak);
  const naam = t.layouts[opmaak.layout];
  return (
    <button
      type="button"
      aria-pressed={gekozen}
      onClick={opKies}
      className={
        'relative flex w-44 flex-col gap-2 rounded-knop bg-achtergrond p-3 text-left font-semibold ' +
        (gekozen ? 'border-3 border-accent text-accent' : 'border-2 border-rand hover:border-accent')
      }
    >
      {/* Het voorbeeld is decoratief; klikken gaat naar de knop, niet naar het iframe. */}
      <span aria-hidden="true" className="pointer-events-none block">
        <PdfVoorbeeld html={voorbeeld.data?.html ?? null} titel={t.voorbeeldLayout(naam)} werkbalk={false} />
      </span>
      <span className="flex items-center justify-between">
        {naam}
        {gekozen && (
          <span className="rounded-full bg-accent p-0.5 text-white">
            <Check aria-hidden="true" className="size-4" strokeWidth={3} />
          </span>
        )}
      </span>
    </button>
  );
}
