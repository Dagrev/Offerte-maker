import { aantalNaarHonderdsten, m2VanDakvlak, totaalM2 } from '@shared/calc/bedragen';
import { formatAantal, formatDatum, formatM2 } from '@shared/formatteer';
import {
  AFWERKING_LABELS,
  HOOGTE_LABELS,
  HUIDIGE_BEDEKKING_LABELS,
  ONDERGROND_LABELS,
  SOORT_DAK_LABELS,
  SOORT_WERK_LABELS,
  klantWeergave,
  labelBedekking,
  labelIsolatie,
} from '@shared/labels';
import type { Adres, Klant, KlusInvoer } from '@shared/types';
import { DatumVeld } from '../../componenten/DatumVeld';
import { Kaart } from '../../componenten/Kaart';
import { Veld } from '../../componenten/Veld';
import { nl } from '../../teksten/nl';
import { hoofdletter } from './opties';

const t = nl.wizard.overig;
const s = nl.wizard.samenvatting;
const e = nl.wizard.extras;

export interface StapOverigProps {
  klant: Klant;
  invoer: KlusInvoer;
  opWijzigInvoer: (deel: Partial<KlusInvoer>) => void;
  offertedatum: string;
  opWijzigDatum: (datum: string) => void;
  /** Al berekend met `berekenGeldigTot` (FE-058). */
  geldigTot: string;
}

/** Stap 4 (FE-026, FE-058): Overig, offertedatum en een samenvatting van stap 1–3. */
export function StapOverig({
  klant,
  invoer,
  opWijzigInvoer,
  offertedatum,
  opWijzigDatum,
  geldigTot,
}: StapOverigProps) {
  return (
    <div className="flex flex-col gap-6">
      <Kaart titel={t.overig}>
        <Veld
          meerdereRegels
          rows={7}
          label={t.vraag}
          hint={t.hint}
          waarde={invoer.overig}
          opWijzig={(overig) => opWijzigInvoer({ overig })}
        />
      </Kaart>

      <Kaart>
        <DatumVeld
          label={t.offertedatum}
          hint={t.geldigTot(formatDatum(geldigTot))}
          waarde={offertedatum}
          opWijzig={opWijzigDatum}
        />
      </Kaart>

      <Kaart titel={t.samenvatting} vlak>
        <dl className="grid gap-x-8 gap-y-3 md:grid-cols-[minmax(0,16rem)_1fr]">
          {samenvatting(klant, invoer).map(([label, waarde]) => (
            <div key={label} className="contents">
              <dt className="font-semibold">{label}</dt>
              <dd className="whitespace-pre-line">{waarde}</dd>
            </div>
          ))}
        </dl>
      </Kaart>
    </div>
  );
}

function adresRegel(adres: Adres): string {
  const plaats = [adres.postcode.trim(), adres.plaats.trim()].filter(Boolean).join(' ');
  return [adres.straatHuisnummer.trim(), plaats].filter(Boolean).join(', ');
}

/** Alleen ingevulde waarden, als labels (§9.1), nooit als codes. */
function samenvatting(klant: Klant, invoer: KlusInvoer): [string, string][] {
  const regels: [string, string][] = [];
  const voeg = (label: string, waarde: string | null | false) => {
    if (waarde) regels.push([label, waarde]);
  };
  const aantal = (label: string, n: number, eenheid: string) =>
    voeg(label, n > 0 ? `${formatAantal(aantalNaarHonderdsten(n))} ${eenheid}` : null);

  const naam = klant.naam.trim() || klant.bedrijfsnaam.trim() ? klantWeergave(klant) : '';
  voeg(s.klant, naam);
  voeg(s.adres, adresRegel(klant.adres));
  voeg(s.werkadres, klant.heeftWerkadres && adresRegel(klant.werkadres));
  voeg(s.telefoon, klant.telefoon.trim());
  voeg(s.email, klant.email.trim());

  voeg(s.soortWerk, invoer.soortWerk && SOORT_WERK_LABELS[invoer.soortWerk]);
  voeg(s.soortDak, invoer.soortDak && hoofdletter(SOORT_DAK_LABELS[invoer.soortDak]));
  const m2 = totaalM2(invoer.dakvlakken);
  if (m2 > 0) {
    const vlakken = invoer.dakvlakken
      .map(
        (v) =>
          `${v.naam || nl.wizard.dak.dakvlakken}: ${formatM2(aantalNaarHonderdsten(m2VanDakvlak(v)))} m²`,
      )
      .join('\n');
    voeg(s.dakvlakken, `${vlakken}\n${nl.wizard.dak.totaal}: ${formatM2(aantalNaarHonderdsten(m2))} m²`);
  }
  voeg(s.bedekking, invoer.bedekking && labelBedekking(invoer.bedekking, invoer.bedekkingAnders));
  voeg(s.huidigeBedekking, invoer.huidigeBedekking && HUIDIGE_BEDEKKING_LABELS[invoer.huidigeBedekking]);
  voeg(s.ondergrond, invoer.ondergrond && ONDERGROND_LABELS[invoer.ondergrond]);

  voeg(s.slopen, invoer.slopenEnAfvoeren && t.ja);
  voeg(s.isolatie, invoer.isolatie !== 'geen' && labelIsolatie(invoer.isolatie, invoer.isolatieAndersMm));
  aantal(s.daktrim, invoer.daktrimM1, e.strekkendeMeter);
  aantal(s.dakgoot, invoer.dakgootM1, e.strekkendeMeter);
  aantal(s.hwa, invoer.hwaAantal, e.stuks);
  aantal(s.noodoverloop, invoer.noodoverloopAantal, e.stuks);
  aantal(s.doorvoer, invoer.doorvoerAantal, e.stuks);
  aantal(s.lichtkoepel, invoer.lichtkoepelAantal, e.stuks);
  voeg(s.afwerking, invoer.afwerking !== 'geen' && AFWERKING_LABELS[invoer.afwerking]);
  voeg(s.hoogte, HOOGTE_LABELS[invoer.hoogte]);
  voeg(s.steiger, invoer.steigerNodig && t.ja);
  voeg(s.garantie, e.garantieOpties[invoer.garantieJaren === 20 ? '20' : '10']);
  voeg(s.gewensteUitvoering, invoer.gewensteUitvoering.trim());
  return regels;
}
