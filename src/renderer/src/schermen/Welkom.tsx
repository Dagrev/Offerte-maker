import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { Fout } from '@shared/fouten';
import type { Bedrijf } from '@shared/types';
import { useClaudeStatus } from '../api/claude';
import { useInstellingen } from '../api/instellingen';
import { alsFout, roep } from '../api/roep';
import { ontbrekendeBedrijfsgegevens, type OntbrekendGegeven } from '../componenten/bedrijfsgegevens';
import { Foutmelding } from '../componenten/Foutmelding';
import { GeleBalk } from '../componenten/GeleBalk';
import { Knop } from '../componenten/Knop';
import { Stappenbalk } from '../componenten/Stappenbalk';
import { useNavigatie } from '../stores/navigatie';
import { nl } from '../teksten/nl';
import { ClaudeKoppeling } from './instellingen/ClaudeKoppeling';
import { TabBedrijf } from './instellingen/TabBedrijf';
import { TabVoorbeelden } from './instellingen/TabVoorbeelden';

const t = nl.welkom;

type Stap = 1 | 2 | 3;

/**
 * Welkomstscherm bij de eerste start (FO UC-17/S6, TDO §13.4, V-20). Elke stap toont de tab uit
 * Instellingen inline (Bedrijf, Claude-koppeling, Voorbeelden); die bewaren zelf direct. **Klaar** of
 * **Overslaan** roept `welkom:voltooi` aan en opent het hoofdscherm (FE-004).
 *
 * Geen verplichte velden (OFM-029): **Volgende**, **Overslaan** en **Klaar** werken altijd. Ontbreken
 * bij het verlaten van stap 1 bedrijfsgegevens, dan staat er in stap 2 en 3 een gele, niet-blokkerende
 * melding; het hoofdscherm toont daarna een hint zolang de bedrijfsnaam leeg is (`BedrijfHint`).
 */
export function Welkom() {
  const instellingen = useInstellingen();
  const claudeStatus = useClaudeStatus();
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const [stap, setStap] = useState<Stap>(1);
  const [bedrijf, setBedrijf] = useState<Partial<Bedrijf>>({});
  const [ontbrekend, setOntbrekend] = useState<OntbrekendGegeven[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<Fout | null>(null);

  if (instellingen.isError)
    return (
      <main className="mx-auto max-w-5xl p-10">
        <Foutmelding fout={alsFout(instellingen.error)} opnieuw={() => void instellingen.refetch()} />
      </main>
    );
  if (!instellingen.data)
    return (
      <main className="mx-auto max-w-5xl p-10">
        <p role="status">{nl.algemeen.laden}</p>
      </main>
    );
  const data = instellingen.data;

  const naar = (nieuw: Stap) => {
    // Stap 1 verlaten: ontbrekende gegevens melden, niet blokkeren (OFM-029, V-20).
    if (stap === 1 && nieuw !== 1)
      setOntbrekend(ontbrekendeBedrijfsgegevens({ ...data.bedrijf, ...bedrijf }));
    setFout(null);
    setStap(nieuw);
    window.scrollTo({ top: 0 });
  };

  const volgende = () => {
    if (stap < 3) naar((stap + 1) as Stap);
  };

  const voltooi = async () => {
    setBezig(true);
    setFout(null);
    try {
      await roep(window.api.welkomVoltooi());
      gaNaar({ scherm: 'overzicht' });
    } catch (e) {
      setFout(alsFout(e));
      setBezig(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-10 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">{t.titel}</h1>
        <p className="max-w-3xl text-lg text-tekst-zacht">{t.intro}</p>
      </header>

      <Stappenbalk stappen={t.stappen} huidig={stap} opKies={(s) => naar(s as Stap)} />

      <section aria-labelledby="welkom-stap" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 id="welkom-stap" className="text-2xl font-semibold">
            {t.stapKop(stap, t.stappen[stap - 1] ?? '')}
          </h2>
          <p className="text-tekst-zacht">{t.uitleg[stap - 1]}</p>
        </div>

        {stap !== 1 && ontbrekend.length > 0 && (
          <GeleBalk titel={t.nogNietIngevuld} punten={ontbrekend.map((g) => nl.instellingen.bedrijf[g])}>
            <p>{t.laterInvullen}</p>
          </GeleBalk>
        )}

        {stap === 1 && <TabBedrijf instellingen={data} opWijzig={setBedrijf} />}
        {stap === 2 && (
          <>
            {claudeStatus?.toestand !== 'gekoppeld' && <GeleBalk>{t.nietGekoppeld}</GeleBalk>}
            <ClaudeKoppeling instellingen={data} />
          </>
        )}
        {stap === 3 && <TabVoorbeelden />}
      </section>

      {fout && <Foutmelding fout={fout} opnieuw={() => void voltooi()} />}

      <footer className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t-2 border-rand bg-achtergrond py-4">
        {stap > 1 && <Knop label={t.vorige} icoon={ArrowLeft} onClick={() => naar((stap - 1) as Stap)} />}
        <div className="flex-1" />
        {stap === 3 ? (
          <>
            <Knop label={t.overslaan} disabled={bezig} onClick={() => void voltooi()} />
            <Knop
              label={t.klaar}
              icoon={Check}
              variant="hoofd"
              disabled={bezig}
              onClick={() => void voltooi()}
            />
          </>
        ) : (
          <Knop label={t.volgende} icoon={ArrowRight} variant="hoofd" onClick={volgende} />
        )}
      </footer>
    </main>
  );
}
