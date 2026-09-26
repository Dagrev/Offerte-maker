import {
  Building,
  Building2,
  Droplets,
  Hammer,
  HelpCircle,
  Home,
  Layers,
  Plus,
  Ruler,
  Sparkles,
  Square,
  SquareStack,
  Thermometer,
  Trash2,
  Triangle,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { aantalNaarHonderdsten, totaalM2 } from '@shared/calc/bedragen';
import { formatM2 } from '@shared/formatteer';
import { MAX_DAKVLAKKEN, nieuwDakvlak } from '@shared/nieuweOfferte';
import type { Dakvlak, Keuzelijsten, KlusInvoer } from '@shared/types';
import { GetalVeld } from '../../componenten/GetalVeld';
import { Kaart } from '../../componenten/Kaart';
import { Knop } from '../../componenten/Knop';
import { TegelKeuze } from '../../componenten/TegelKeuze';
import { Veld } from '../../componenten/Veld';
import { nl } from '../../teksten/nl';
import { hoofdletter, keuzeTegels } from './opties';

const t = nl.wizard.dak;

// Iconen per sleutel van de startset; een zelf toegevoegde keuze krijgt een neutraal icoon (OFM-034).
// Soort werk staat sinds OFM-044 in stap 3 (Werkzaamheden).
export const SOORT_WERK_ICONEN: Record<string, LucideIcon> = {
  nieuw_dak: Home,
  dak_vervangen: Layers,
  reparatie: Wrench,
  dakgoten: Droplets,
  isolatie: Thermometer,
  onderhoud: Sparkles,
};

/** Iconen van de nieuwe dakbedekking (stap 3, OFM-050). */
export const BEDEKKING_ICONEN: Record<string, LucideIcon> = {
  bitumen: Layers,
  epdm: SquareStack,
  pvc: Square,
};

export interface StapDakProps {
  invoer: KlusInvoer;
  opWijzig: (deel: Partial<KlusInvoer>) => void;
  /** Keuzelijsten uit de instellingen (OFM-034). */
  keuzelijsten: Keuzelijsten;
}

/**
 * Stap 2 Het huidige dak (FE-022, FE-023, OFM-044, OFM-050): soort dak, dakvlakken, huidige bedekking,
 * ondergrond en hoogte. Alles beschrijft de beginsituatie; de huidige bedekking staat er sinds OFM-050
 * altijd (soort werk en de nieuwe bedekking staan in stap 3).
 */
export function StapDak({ invoer, opWijzig, keuzelijsten: k }: StapDakProps) {
  return (
    <div className="flex flex-col gap-6">
      <Kaart>
        <TegelKeuze
          label={t.soortDak}
          opties={keuzeTegels(k.soortDak, invoer.soortDak, { plat: Square, hellend: Triangle }, hoofdletter)}
          waarde={invoer.soortDak}
          opKies={(soortDak) => opWijzig({ soortDak })}
        />
      </Kaart>

      <Dakvlakken vlakken={invoer.dakvlakken} opWijzig={(dakvlakken) => opWijzig({ dakvlakken })} />

      <Kaart>
        <TegelKeuze
          label={t.huidigeBedekking}
          opties={keuzeTegels(k.huidigeBedekking, invoer.huidigeBedekking, {
            bitumen: Layers,
            epdm: SquareStack,
            grind_op_bitumen: Hammer,
            onbekend: HelpCircle,
          })}
          waarde={invoer.huidigeBedekking}
          opKies={(huidigeBedekking) => opWijzig({ huidigeBedekking })}
        />
        <TegelKeuze
          label={t.ondergrond}
          opties={keuzeTegels(k.ondergrond, invoer.ondergrond, {
            hout: Ruler,
            beton: Square,
            staal: Layers,
            onbekend: HelpCircle,
          })}
          waarde={invoer.ondergrond}
          opKies={(ondergrond) => opWijzig({ ondergrond })}
        />
        <TegelKeuze
          label={t.hoogte}
          opties={keuzeTegels(k.hoogte, invoer.hoogte, { '1': Home, '2': Building, '3plus': Building2 })}
          waarde={invoer.hoogte}
          opKies={(hoogte) => opWijzig({ hoogte })}
        />
      </Kaart>
    </div>
  );
}

function Dakvlakken({ vlakken, opWijzig }: { vlakken: Dakvlak[]; opWijzig: (vlakken: Dakvlak[]) => void }) {
  const zet = (id: string, deel: Partial<Dakvlak>) =>
    opWijzig(vlakken.map((v) => (v.id === id ? { ...v, ...deel } : v)));
  const vol = vlakken.length >= MAX_DAKVLAKKEN;

  return (
    <Kaart titel={t.dakvlakken}>
      {vlakken.map((vlak) => (
        <div key={vlak.id} className="flex flex-col gap-4 rounded-knop border border-rand bg-vlak p-5">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Veld label={t.dakvlakNaam} waarde={vlak.naam} opWijzig={(naam) => zet(vlak.id, { naam })} />
            </div>
            {vlakken.length > 1 && (
              <Knop
                label={t.dakvlakVerwijderen(vlak.naam || t.dakvlakken)}
                icoon={Trash2}
                alleenIcoon
                variant="gevaar"
                onClick={() => opWijzig(vlakken.filter((v) => v.id !== vlak.id))}
              />
            )}
          </div>
          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="sr-only">{t.maatwijze}</legend>
            {(['lxb', 'm2'] as const).map((modus) => (
              <button
                key={modus}
                type="button"
                aria-pressed={vlak.modus === modus}
                onClick={() => zet(vlak.id, { modus })}
                className={
                  'min-h-12 rounded-knop border-2 px-4 font-semibold ' +
                  (vlak.modus === modus
                    ? 'border-accent bg-accent text-white'
                    : 'border-rand bg-achtergrond text-tekst hover:border-accent')
                }
              >
                {t[modus]}
              </button>
            ))}
          </fieldset>
          {vlak.modus === 'lxb' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <GetalVeld
                label={t.lengte}
                eenheid={t.meter}
                waarde={vlak.lengteM}
                opWijzig={(lengteM) => zet(vlak.id, { lengteM })}
              />
              <GetalVeld
                label={t.breedte}
                eenheid={t.meter}
                waarde={vlak.breedteM}
                opWijzig={(breedteM) => zet(vlak.id, { breedteM })}
              />
            </div>
          ) : (
            <div className="max-w-md">
              <GetalVeld
                label={t.oppervlakte}
                eenheid={t.vierkanteMeter}
                waarde={vlak.m2}
                opWijzig={(m2) => zet(vlak.id, { m2 })}
              />
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Knop
            label={t.dakvlakToevoegen}
            icoon={Plus}
            disabled={vol}
            onClick={() => opWijzig([...vlakken, nieuwDakvlak(vlakken.length + 1)])}
          />
          {vol && <p className="text-tekst-zacht">{t.maxDakvlakken}</p>}
        </div>
        <p className="text-2xl font-semibold" aria-live="polite">
          {t.totaal}: {formatM2(aantalNaarHonderdsten(totaalM2(vlakken)))} {t.vierkanteMeter}
        </p>
      </div>
    </Kaart>
  );
}
