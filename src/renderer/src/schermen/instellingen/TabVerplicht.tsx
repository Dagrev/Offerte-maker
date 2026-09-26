import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Instellingen } from '@shared/types';
import {
  ALTIJD_VERPLICHT,
  standaardVerplicht,
  VELD_STAP,
  VERPLICHT_VELDEN,
  type Verplicht,
  type WizardVeld,
} from '@shared/verplicht';
import { bewaarInstelling } from '../../api/instellingen';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Kaart } from '../../componenten/Kaart';
import { Knop } from '../../componenten/Knop';
import { Vinkje } from '../../componenten/Vinkje';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';

const t = nl.verplicht;
const STAPPEN = [1, 2, 3] as const;

/** Uitleg onder een veld, als dat iets bijzonders heeft. */
function hintVan(veld: WizardVeld): string | undefined {
  if ((ALTIJD_VERPLICHT as readonly string[]).includes(veld)) return t.altijd;
  if (veld.startsWith('werk')) return t.werkadresHint;
  if (veld === 'bedrijfsnaam') return t.bedrijfsnaamHint;
  if (veld === 'hoogte') return t.hoogteHint;
  if (veld === 'aanhef') return t.aanhefHint;
  if (veld === 'werkzaamheid') return t.werkzaamheidHint;
  return undefined;
}

/** Velden per stap, met de altijd-verplichte op hun plek (dakvlak na het dak, soort werk vóór de werkzaamheden). */
function veldenVan(stap: 1 | 2 | 3): WizardVeld[] {
  const instelbaar = VERPLICHT_VELDEN.filter((v) => VELD_STAP[v] === stap);
  // OFM-044: soort werk staat in stap 3 (Werkzaamheden), het dakvlak in stap 2.
  if (stap === 2) return [...instelbaar, 'dakvlak'];
  return stap === 3 ? ['soortWerk', ...instelbaar] : instelbaar;
}

/**
 * Tab Verplichte velden (OFM-038): per wizardveld een vinkje. Elke klik bewaart direct ("Bewaard ✓");
 * **Herstel standaard** zet de standaard uit `shared/verplicht.ts` terug. Soort werk en een dakvlak
 * staan vast aan.
 */
export function TabVerplicht({ instellingen }: { instellingen: Instellingen }) {
  const [verplicht, setVerplicht] = useState<Verplicht>(instellingen.verplicht);
  const bewaren = useAutoBewaar((waarde: Verplicht) => bewaarInstelling({ sleutel: 'verplicht', waarde }));

  const zet = (nieuw: Verplicht) => {
    setVerplicht(nieuw);
    bewaren.bewaarDirect(nieuw);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-3xl text-tekst-zacht">{t.uitleg}</p>
        <div className="flex items-center gap-4">
          <BewaardIndicator signaal={bewaren.signaal} />
          <Knop label={t.herstel} icoon={RotateCcw} onClick={() => zet(standaardVerplicht())} />
        </div>
      </div>
      {bewaren.fout && <Foutmelding fout={bewaren.fout} opnieuw={() => bewaren.bewaarDirect(verplicht)} />}
      {STAPPEN.map((stap) => (
        <Kaart key={stap} titel={t.stap[stap]}>
          {veldenVan(stap).map((veld) => {
            const altijd = (ALTIJD_VERPLICHT as readonly string[]).includes(veld);
            return (
              <Vinkje
                key={veld}
                label={t.veld[veld]}
                hint={hintVan(veld)}
                aan={altijd || verplicht[veld as keyof Verplicht]}
                disabled={altijd}
                opWijzig={(aan) => zet({ ...verplicht, [veld]: aan })}
              />
            );
          })}
        </Kaart>
      ))}
    </div>
  );
}
