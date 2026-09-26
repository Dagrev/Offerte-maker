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
import { extraAantal, extraInMeters, extrasMetAantal, metExtraAantal } from '@shared/keuzelijsten';
import type { Keuzelijsten, KlusInvoer } from '@shared/types';
import { GetalVeld } from '../../componenten/GetalVeld';
import { Kaart } from '../../componenten/Kaart';
import { TegelKeuze } from '../../componenten/TegelKeuze';
import { Veld } from '../../componenten/Veld';
import { Vinkje } from '../../componenten/Vinkje';
import { nl } from '../../teksten/nl';
import { keuzeTegels } from './opties';

const t = nl.wizard.extras;

export interface StapExtrasProps {
  invoer: KlusInvoer;
  opWijzig: (deel: Partial<KlusInvoer>) => void;
  /** Keuzelijsten uit de instellingen (OFM-034). */
  keuzelijsten: Keuzelijsten;
}

interface ExtraVeld {
  sleutel: string;
  label: string;
  verborgen: boolean;
}

/**
 * De getalvelden van de extra's: de zichtbare opties in de ingestelde volgorde, plus een verborgen of
 * verwijderde extra die deze offerte nog heeft (grijs, OFM-034).
 */
function extraVelden(invoer: KlusInvoer, keuzelijsten: Keuzelijsten): ExtraVeld[] {
  const velden: ExtraVeld[] = keuzelijsten.extras
    .filter((o) => !o.verborgen || extraAantal(invoer, o.sleutel) > 0)
    .map((o) => ({ sleutel: o.sleutel, label: o.label, verborgen: o.verborgen }));
  for (const extra of extrasMetAantal(invoer, keuzelijsten)) {
    if (!velden.some((v) => v.sleutel === extra.sleutel)) {
      velden.push({ sleutel: extra.sleutel, label: extra.label, verborgen: true });
    }
  }
  return velden;
}

/** Stap 3 (FE-022): alles met standaard nee/0/Geen/10 jaar. Een leeg getalveld telt als 0. */
export function StapExtras({ invoer, opWijzig, keuzelijsten: k }: StapExtrasProps) {
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
          opties={keuzeTegels(
            k.isolatie,
            invoer.isolatie,
            { geen: Ban, anders: HelpCircle },
            undefined,
            Thermometer,
          )}
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
          {extraVelden(invoer, k).map((veld) => {
            const meters = extraInMeters(veld.sleutel);
            return (
              <GetalVeld
                key={veld.sleutel}
                label={veld.verborgen ? `${veld.label} ${nl.componenten.nietMeerInLijst}` : veld.label}
                eenheid={meters ? t.strekkendeMeter : t.stuks}
                decimalen={meters ? 2 : 0}
                waarde={extraAantal(invoer, veld.sleutel)}
                opWijzig={(waarde) => opWijzig(metExtraAantal(invoer, veld.sleutel, waarde ?? 0))}
              />
            );
          })}
        </div>
      </Kaart>

      <Kaart>
        <TegelKeuze
          label={t.afwerking}
          opties={keuzeTegels(k.afwerking, invoer.afwerking, { geen: Ban, grind: Mountain, sedum: Flower2 })}
          waarde={invoer.afwerking}
          opKies={(afwerking) => opWijzig({ afwerking })}
        />
        <TegelKeuze
          label={t.hoogte}
          opties={keuzeTegels(k.hoogte, invoer.hoogte, { '1': Home, '2': Building, '3plus': Building2 })}
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
          opties={keuzeTegels(k.garantie, invoer.garantieJaren, {}, undefined, ShieldCheck)}
          waarde={invoer.garantieJaren}
          opKies={(garantieJaren) => opWijzig({ garantieJaren })}
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
