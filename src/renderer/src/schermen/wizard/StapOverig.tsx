import { aantalNaarHonderdsten, m2VanDakvlak, totaalM2 } from '@shared/calc/bedragen';
import { formatAantal, formatDatum, formatM2 } from '@shared/formatteer';
import { extraInMeters, extrasMetAantal, keuzeLabel, type Keuzes } from '@shared/keuzelijsten';
import { klantWeergave, labelBedekking, labelIsolatie } from '@shared/labels';
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
  /** Labels uit de keuzelijsten (OFM-034). */
  keuzes: Keuzes;
}

/** Stap 4 (FE-026, FE-058): Overig, offertedatum en een samenvatting van stap 1–3. */
export function StapOverig({
  klant,
  invoer,
  opWijzigInvoer,
  offertedatum,
  opWijzigDatum,
  geldigTot,
  keuzes,
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
          {samenvatting(klant, invoer, keuzes).map(([label, waarde]) => (
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
function samenvatting(klant: Klant, invoer: KlusInvoer, keuzes: Keuzes): [string, string][] {
  const label = (lijst: Parameters<typeof keuzeLabel>[1], sleutel: string) =>
    keuzeLabel(keuzes, lijst, sleutel);
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

  voeg(s.soortWerk, invoer.soortWerk && label('soortWerk', invoer.soortWerk));
  voeg(s.soortDak, invoer.soortDak && hoofdletter(label('soortDak', invoer.soortDak)));
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
  voeg(s.bedekking, invoer.bedekking && labelBedekking(keuzes, invoer.bedekking, invoer.bedekkingAnders));
  voeg(s.huidigeBedekking, invoer.huidigeBedekking && label('huidigeBedekking', invoer.huidigeBedekking));
  voeg(s.ondergrond, invoer.ondergrond && label('ondergrond', invoer.ondergrond));

  voeg(s.slopen, invoer.slopenEnAfvoeren && t.ja);
  voeg(
    s.isolatie,
    invoer.isolatie !== 'geen' && labelIsolatie(keuzes, invoer.isolatie, invoer.isolatieAndersMm),
  );
  for (const extra of extrasMetAantal(invoer, keuzes)) {
    aantal(extra.label, extra.aantal, extraInMeters(extra.sleutel) ? e.strekkendeMeter : e.stuks);
  }
  voeg(s.afwerking, invoer.afwerking !== 'geen' && label('afwerking', invoer.afwerking));
  voeg(s.hoogte, label('hoogte', invoer.hoogte));
  voeg(s.steiger, invoer.steigerNodig && t.ja);
  voeg(s.garantie, label('garantie', invoer.garantieJaren));
  voeg(s.gewensteUitvoering, invoer.gewensteUitvoering.trim());
  return regels;
}
