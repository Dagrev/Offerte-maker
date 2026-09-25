import { useState } from 'react';
import type { Instellingen, Teksten } from '@shared/types';
import { bewaarInstelling } from '../../api/instellingen';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { GetalVeld } from '../../componenten/GetalVeld';
import { Kaart } from '../../componenten/Kaart';
import { Veld } from '../../componenten/Veld';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';

const t = nl.instellingen.teksten;
type TekstSleutel = Exclude<keyof Teksten, 'geldigheidDagen'>;
const TEKSTVAKKEN: { sleutel: TekstSleutel; rijen: number; hint?: string }[] = [
  { sleutel: 'inleiding', rijen: 3 },
  { sleutel: 'garantie10', rijen: 3 },
  { sleutel: 'garantie20', rijen: 3 },
  { sleutel: 'betalingsvoorwaarden', rijen: 2 },
  { sleutel: 'afsluiting', rijen: 3 },
  { sleutel: 'voetnoot', rijen: 2, hint: t.voetnootHint },
];

const geldigeDagen = (d: number | null): d is number =>
  d !== null && Number.isInteger(d) && d >= 1 && d <= 365;

/**
 * Tab Teksten (FE-073). Toont de startwaarden uit §9.4 zolang niets is gewijzigd; pas een wijziging
 * wordt bewaard (V-13).
 */
export function TabTeksten({ instellingen }: { instellingen: Instellingen }) {
  const [teksten, setTeksten] = useState<Teksten>(instellingen.teksten);
  const [dagen, setDagen] = useState<number | null>(instellingen.teksten.geldigheidDagen);
  const bewaren = useAutoBewaar(
    (waarde: Teksten) => bewaarInstelling({ sleutel: 'teksten', waarde }),
    (waarde) => geldigeDagen(waarde.geldigheidDagen),
  );

  const wijzig = (deel: Partial<Teksten>) => {
    const nieuw = { ...teksten, ...deel };
    setTeksten(nieuw);
    bewaren.wijzig(nieuw);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-tekst-zacht">{t.uitleg}</p>
        <BewaardIndicator signaal={bewaren.signaal} />
      </div>
      {bewaren.fout && <Foutmelding fout={bewaren.fout} opnieuw={bewaren.bewaarNu} />}
      <Kaart>
        <div className="flex flex-col gap-6">
          {TEKSTVAKKEN.map(({ sleutel, rijen, hint }) => (
            <Veld
              key={sleutel}
              meerdereRegels
              rows={rijen}
              label={t[sleutel]}
              hint={hint}
              waarde={teksten[sleutel]}
              opWijzig={(w) => wijzig({ [sleutel]: w })}
              onBlur={bewaren.bewaarNu}
            />
          ))}
          <div className="max-w-xs">
            <GetalVeld
              label={t.geldigheidDagen}
              eenheid={t.geldigheidEenheid}
              decimalen={0}
              waarde={dagen}
              fout={geldigeDagen(dagen) ? undefined : t.geldigheidFout}
              opWijzig={(d) => {
                setDagen(d);
                if (geldigeDagen(d)) wijzig({ geldigheidDagen: d });
              }}
              onBlur={bewaren.bewaarNu}
            />
          </div>
        </div>
      </Kaart>
    </div>
  );
}
