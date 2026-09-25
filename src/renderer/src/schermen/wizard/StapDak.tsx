import {
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
  Droplets,
  type LucideIcon,
} from 'lucide-react';
import { aantalNaarHonderdsten, totaalM2 } from '@shared/calc/bedragen';
import { formatM2 } from '@shared/formatteer';
import {
  BEDEKKING_LABELS,
  HUIDIGE_BEDEKKING_LABELS,
  ONDERGROND_LABELS,
  SOORT_DAK_LABELS,
  SOORT_WERK_LABELS,
} from '@shared/labels';
import { MAX_DAKVLAKKEN, nieuwDakvlak } from '@shared/nieuweOfferte';
import type { Dakvlak, KlusInvoer, SoortWerk } from '@shared/types';
import { GetalVeld } from '../../componenten/GetalVeld';
import { Kaart } from '../../componenten/Kaart';
import { Knop } from '../../componenten/Knop';
import { TegelKeuze } from '../../componenten/TegelKeuze';
import { Veld } from '../../componenten/Veld';
import { nl } from '../../teksten/nl';
import { hoofdletter, opties } from './opties';

const t = nl.wizard.dak;

const SOORT_WERK_ICONEN: Record<SoortWerk, LucideIcon> = {
  nieuw_dak: Home,
  dak_vervangen: Layers,
  reparatie: Wrench,
  dakgoten: Droplets,
  isolatie: Thermometer,
  onderhoud: Sparkles,
};

/** Huidige dakbedekking alleen bij vervangen en reparatie (FO UC-04). */
export function vraagtHuidigeBedekking(soortWerk: SoortWerk | null): boolean {
  return soortWerk === 'dak_vervangen' || soortWerk === 'reparatie';
}

export interface StapDakProps {
  invoer: KlusInvoer;
  opWijzig: (deel: Partial<KlusInvoer>) => void;
}

/** Stap 2 (FE-022, FE-023): soort werk, soort dak, dakvlakken, bedekking en ondergrond. */
export function StapDak({ invoer, opWijzig }: StapDakProps) {
  return (
    <div className="flex flex-col gap-6">
      <Kaart>
        <TegelKeuze
          label={t.soortWerk}
          opties={opties(SOORT_WERK_LABELS, SOORT_WERK_ICONEN)}
          waarde={invoer.soortWerk}
          opKies={(soortWerk) =>
            // Huidige bedekking hoort alleen bij vervangen en reparatie; anders niet meesturen.
            opWijzig(
              vraagtHuidigeBedekking(soortWerk) ? { soortWerk } : { soortWerk, huidigeBedekking: null },
            )
          }
        />
        <TegelKeuze
          label={t.soortDak}
          opties={opties(
            { plat: hoofdletter(SOORT_DAK_LABELS.plat), hellend: hoofdletter(SOORT_DAK_LABELS.hellend) },
            { plat: Square, hellend: Triangle },
          )}
          waarde={invoer.soortDak}
          opKies={(soortDak) => opWijzig({ soortDak })}
        />
      </Kaart>

      <Dakvlakken vlakken={invoer.dakvlakken} opWijzig={(dakvlakken) => opWijzig({ dakvlakken })} />

      <Kaart>
        <TegelKeuze
          label={t.bedekking}
          opties={opties(BEDEKKING_LABELS, {
            epdm_11: SquareStack,
            epdm_15: SquareStack,
            resitrix: SquareStack,
            bitumen: Layers,
            anders: HelpCircle,
          })}
          waarde={invoer.bedekking}
          opKies={(bedekking) => opWijzig({ bedekking })}
        />
        {invoer.bedekking === 'anders' && (
          <Veld
            label={t.bedekkingAnders}
            waarde={invoer.bedekkingAnders}
            opWijzig={(bedekkingAnders) => opWijzig({ bedekkingAnders })}
          />
        )}
        {vraagtHuidigeBedekking(invoer.soortWerk) && (
          <TegelKeuze
            label={t.huidigeBedekking}
            opties={opties(HUIDIGE_BEDEKKING_LABELS, {
              bitumen: Layers,
              epdm: SquareStack,
              grind_op_bitumen: Hammer,
              onbekend: HelpCircle,
            })}
            waarde={invoer.huidigeBedekking}
            opKies={(huidigeBedekking) => opWijzig({ huidigeBedekking })}
          />
        )}
        <TegelKeuze
          label={t.ondergrond}
          opties={opties(ONDERGROND_LABELS, {
            hout: Ruler,
            beton: Square,
            staal: Layers,
            onbekend: HelpCircle,
          })}
          waarde={invoer.ondergrond}
          opKies={(ondergrond) => opWijzig({ ondergrond })}
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
