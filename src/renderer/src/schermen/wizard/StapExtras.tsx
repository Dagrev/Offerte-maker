import {
  Ban,
  Building,
  Building2,
  Flower2,
  HelpCircle,
  Home,
  Mountain,
  ShieldCheck,
  Thermometer,
} from 'lucide-react';
import { AFWERKING_LABELS, HOOGTE_LABELS, ISOLATIE_LABELS } from '@shared/labels';
import type { KlusInvoer } from '@shared/types';
import { GetalVeld } from '../../componenten/GetalVeld';
import { Kaart } from '../../componenten/Kaart';
import { TegelKeuze } from '../../componenten/TegelKeuze';
import { Veld } from '../../componenten/Veld';
import { Vinkje } from '../../componenten/Vinkje';
import { nl } from '../../teksten/nl';
import { opties } from './opties';

const t = nl.wizard.extras;

type Aantal = 'hwaAantal' | 'noodoverloopAantal' | 'doorvoerAantal' | 'lichtkoepelAantal';

const AANTALLEN: readonly [Aantal, string][] = [
  ['hwaAantal', t.hwa],
  ['noodoverloopAantal', t.noodoverloop],
  ['doorvoerAantal', t.doorvoer],
  ['lichtkoepelAantal', t.lichtkoepel],
];

export interface StapExtrasProps {
  invoer: KlusInvoer;
  opWijzig: (deel: Partial<KlusInvoer>) => void;
}

/** Stap 3 (FE-022): alles met standaard nee/0/Geen/10 jaar. Een leeg getalveld telt als 0. */
export function StapExtras({ invoer, opWijzig }: StapExtrasProps) {
  return (
    <div className="flex flex-col gap-6">
      <Kaart>
        <Vinkje
          label={t.slopen}
          aan={invoer.slopenEnAfvoeren}
          opWijzig={(slopenEnAfvoeren) => opWijzig({ slopenEnAfvoeren })}
        />
        <TegelKeuze
          label={t.isolatie}
          opties={opties(ISOLATIE_LABELS, {
            geen: Ban,
            '80': Thermometer,
            '100': Thermometer,
            '120': Thermometer,
            anders: HelpCircle,
          })}
          waarde={invoer.isolatie}
          opKies={(isolatie) => opWijzig({ isolatie })}
        />
        {invoer.isolatie === 'anders' && (
          <div className="max-w-md">
            <GetalVeld
              label={t.isolatieMm}
              eenheid={t.mm}
              decimalen={0}
              waarde={invoer.isolatieAndersMm}
              opWijzig={(isolatieAndersMm) => opWijzig({ isolatieAndersMm })}
            />
          </div>
        )}
      </Kaart>

      <Kaart>
        <div className="grid gap-6 md:grid-cols-2">
          <GetalVeld
            label={t.daktrim}
            eenheid={t.strekkendeMeter}
            waarde={invoer.daktrimM1}
            opWijzig={(daktrimM1) => opWijzig({ daktrimM1: daktrimM1 ?? 0 })}
          />
          <GetalVeld
            label={t.dakgoot}
            eenheid={t.strekkendeMeter}
            waarde={invoer.dakgootM1}
            opWijzig={(dakgootM1) => opWijzig({ dakgootM1: dakgootM1 ?? 0 })}
          />
          {AANTALLEN.map(([veld, label]) => (
            <GetalVeld
              key={veld}
              label={label}
              eenheid={t.stuks}
              decimalen={0}
              waarde={invoer[veld]}
              opWijzig={(waarde) => opWijzig({ [veld]: waarde ?? 0 })}
            />
          ))}
        </div>
      </Kaart>

      <Kaart>
        <TegelKeuze
          label={t.afwerking}
          opties={opties(AFWERKING_LABELS, { geen: Ban, grind: Mountain, sedum: Flower2 })}
          waarde={invoer.afwerking}
          opKies={(afwerking) => opWijzig({ afwerking })}
        />
        <TegelKeuze
          label={t.hoogte}
          opties={opties(HOOGTE_LABELS, { '1': Home, '2': Building, '3plus': Building2 })}
          waarde={invoer.hoogte}
          opKies={(hoogte) => opWijzig({ hoogte })}
        />
        <Vinkje
          label={t.steiger}
          aan={invoer.steigerNodig}
          opWijzig={(steigerNodig) => opWijzig({ steigerNodig })}
        />
      </Kaart>

      <Kaart>
        <TegelKeuze
          label={t.garantie}
          opties={opties(t.garantieOpties, { '10': ShieldCheck, '20': ShieldCheck })}
          waarde={invoer.garantieJaren === 20 ? '20' : '10'}
          opKies={(jaren) => opWijzig({ garantieJaren: jaren === '20' ? 20 : 10 })}
        />
        <Veld
          label={t.gewensteUitvoering}
          hint={t.gewensteUitvoeringHint}
          waarde={invoer.gewensteUitvoering}
          opWijzig={(gewensteUitvoering) => opWijzig({ gewensteUitvoering })}
        />
      </Kaart>
    </div>
  );
}
