import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { VALIDATIE_FOUTEN } from '@shared/teksten/validatie';
import { controleerHuisnummer, controleerPostcode } from '@shared/validatie';
import { nl } from '../teksten/nl';
import {
  adresFouten,
  splitsAdres,
  terugZoekSleutel,
  voegSamen,
  wijktAf,
  zoekSleutel,
  type StraatEnNummer,
  type Treffer,
} from './adresDelen';
import { Veld } from './Veld';

const t = nl.componenten.adres;

/** Wacht na de laatste wijziging voordat er wordt opgezocht (OFM-031, OFM-040: beide richtingen). */
export const ZOEK_NA_MS = 400;

export interface AdresWaarde {
  straatHuisnummer: string;
  postcode: string;
  plaats: string;
}

export interface AdresVeldenProps {
  waarde: AdresWaarde;
  /** Alleen de gewijzigde delen; de ouder voegt ze samen met zijn nieuwste stand. */
  opWijzig: (deel: Partial<AdresWaarde>) => void;
  /** Na het verlaten van een veld (bijv. direct bewaren). */
  opVerlaat?: () => void;
  /** Alle fouten tonen, ook in velden die nog niet zijn aangeraakt (na **Volgende**). */
  toonFouten?: boolean;
  /** Rode melding onder Plaats van de ouder (verplicht veld, FE-024). */
  plaatsFout?: string | undefined;
}

type Status = 'rust' | 'zoeken' | 'nietGevonden' | 'postcodeNietGevonden';

const normaal = (tekst: string) => tekst.trim().replace(/\s+/g, ' ');

/**
 * Adres met postcode en huisnummer vooraan (OFM-031). Zodra beide geldig zijn, zoekt main straat en
 * plaats op bij PDOK (`adres:zoek`, A-29) en vult ze in; daarna blijven ze gewoon te wijzigen. Niet
 * gevonden, geen internet of time-out: alleen de grijze tekst "Niet gevonden, vul zelf in".
 * OFM-040: andersom vult de app een lege postcode in uit straat, huisnummer en plaats; wijkt het
 * adres daarna af van de laatste treffer bij dezelfde postcode + huisnummer, dan een oranje,
 * niet-blokkerende melding. Geen ping-pong: elke richting zoekt alleen als zijn doelveld leeg is (of,
 * zoals in OFM-031, als postcode + huisnummer nieuw zijn), en een treffer telt als opgezocht voor de
 * andere richting.
 * Controle en meldingen zoals OFM-030: rood na het verlaten van een veld.
 */
export function AdresVelden({
  waarde,
  opWijzig,
  opVerlaat,
  toonFouten = false,
  plaatsFout,
}: AdresVeldenProps) {
  const [delen, setDelen] = useState<StraatEnNummer>(() => splitsAdres(waarde.straatHuisnummer));
  const [aangeraakt, setAangeraakt] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState<Status>('rust');

  // Van buiten gewijzigd (niet door dit component): opnieuw splitsen.
  let huidig = delen;
  if (normaal(voegSamen(delen)) !== normaal(waarde.straatHuisnummer)) {
    huidig = splitsAdres(waarde.straatHuisnummer);
    setDelen(huidig);
  }

  // De nieuwste `opWijzig`, delen en waarde voor het antwoord van het opzoeken (dat komt pas later).
  const opWijzigRef = useRef(opWijzig);
  const delenRef = useRef(huidig);
  const waardeRef = useRef(waarde);
  useEffect(() => {
    opWijzigRef.current = opWijzig;
    delenRef.current = huidig;
    waardeRef.current = waarde;
  });

  const zetDelen = (nieuw: StraatEnNummer) => {
    setDelen(nieuw);
    opWijzig({ straatHuisnummer: voegSamen(nieuw) });
  };

  // De laatste treffer bij PDOK (OFM-040), voor de controle op een afwijkend adres.
  const [treffer, setTreffer] = useState<Treffer | null>(null);
  // Doelveld van het opzoeken op postcode: leeg als straat of plaats leeg is. Dan zoekt dezelfde
  // postcode + huisnummer opnieuw (OFM-040: "niet nogmaals" geldt niet meer na leegmaken).
  const doelLeeg = huidig.straat.trim() === '' || waarde.plaats.trim() === '';

  // Op postcode + huisnummer: pas na ZOEK_NA_MS zonder wijziging; een nieuwe combinatie overschrijft
  // straat en plaats (OFM-031), dezelfde combinatie vult alleen lege velden. De combinatie waarmee het
  // scherm opent telt als al opgezocht (een bestaand adres niet overschrijven).
  const sleutel = zoekSleutel(waarde.postcode, huidig.huisnummer);
  const laatsteSleutel = useRef(sleutel);
  useEffect(() => {
    if (sleutel === null || (sleutel === laatsteSleutel.current && !doelLeeg)) return;
    let actueel = true;
    const timer = setTimeout(() => {
      const nieuweCombinatie = sleutel !== laatsteSleutel.current;
      laatsteSleutel.current = sleutel;
      const [postcode = '', huisnummer = ''] = sleutel.split('|');
      setStatus('zoeken');
      void window.api.adresZoek({ postcode, huisnummer }).then((r) => {
        if (!actueel) return;
        const gevonden = r.ok ? r.data : null;
        setStatus(gevonden ? 'rust' : 'nietGevonden');
        setTreffer(gevonden ? { sleutel, straat: gevonden.straat, plaats: gevonden.plaats } : null);
        if (!gevonden) return;
        const vul = (oud: string, nieuw: string) => (nieuweCombinatie || oud.trim() === '' ? nieuw : oud);
        const nieuw = { ...delenRef.current, straat: vul(delenRef.current.straat, gevonden.straat) };
        delenRef.current = nieuw;
        setDelen(nieuw);
        opWijzigRef.current({
          straatHuisnummer: voegSamen(nieuw),
          plaats: vul(waardeRef.current.plaats, gevonden.plaats),
        });
      });
    }, ZOEK_NA_MS);
    return () => {
      actueel = false;
      clearTimeout(timer);
    };
  }, [sleutel, doelLeeg]);

  // Andersom (OFM-040): lege postcode uit straat + huisnummer + plaats. Niet opnieuw voor dezelfde
  // combinatie, behalve na het leegmaken van straat of plaats; de combinatie bij openen telt als gezocht.
  const terugSleutel = terugZoekSleutel(waarde.postcode, huidig, waarde.plaats);
  const laatsteTerug = useRef(terugSleutel);
  const straatOfPlaatsLeeg = doelLeeg;
  useEffect(() => {
    if (straatOfPlaatsLeeg) laatsteTerug.current = null;
  }, [straatOfPlaatsLeeg]);
  useEffect(() => {
    if (terugSleutel === null || terugSleutel === laatsteTerug.current) return;
    let actueel = true;
    const timer = setTimeout(() => {
      laatsteTerug.current = terugSleutel;
      const { straat, huisnummer } = delenRef.current;
      setStatus('zoeken');
      void window.api.adresZoek({ straat, huisnummer, plaats: waardeRef.current.plaats }).then((r) => {
        if (!actueel) return;
        const gevonden = r.ok ? r.data : null;
        setStatus(gevonden ? 'rust' : 'postcodeNietGevonden');
        if (!gevonden) return;
        // De nieuwe postcode + huisnummer tellen als opgezocht: niet meteen terug de andere kant op.
        const vooruit = zoekSleutel(gevonden.postcode, delenRef.current.huisnummer);
        laatsteSleutel.current = vooruit;
        if (vooruit) setTreffer({ sleutel: vooruit, straat: gevonden.straat, plaats: gevonden.plaats });
        opWijzigRef.current({ postcode: gevonden.postcode });
      });
    }, ZOEK_NA_MS);
    return () => {
      actueel = false;
      clearTimeout(timer);
    };
  }, [terugSleutel]);

  const afwijkend = wijktAf(treffer, sleutel, huidig.straat, waarde.plaats);

  const fouten = adresFouten(waarde.postcode, huidig);
  const zichtbaar = (veld: string) => toonFouten || aangeraakt.has(veld);
  const verlaat = (veld: string, normaliseer?: () => void) => {
    setAangeraakt((a) => (a.has(veld) ? a : new Set(a).add(veld)));
    normaliseer?.();
    opVerlaat?.();
  };

  const postcodeFout =
    fouten.postcode && zichtbaar('postcode') ? VALIDATIE_FOUTEN[fouten.postcode] : undefined;
  const huisnummerFout =
    fouten.huisnummer && zichtbaar('huisnummer')
      ? fouten.huisnummer === 'huisnummerLeeg'
        ? t.huisnummerLeeg
        : VALIDATIE_FOUTEN[fouten.huisnummer]
      : undefined;
  const straatFout = fouten.straat && zichtbaar('straat') ? t.straatLeeg : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Veld
          label={t.postcode}
          waarde={waarde.postcode}
          opWijzig={(postcode) => {
            setStatus('rust');
            opWijzig({ postcode });
          }}
          onBlur={() =>
            verlaat('postcode', () => {
              const c = controleerPostcode(waarde.postcode);
              if (c.geldig && c.waarde !== waarde.postcode) opWijzig({ postcode: c.waarde });
            })
          }
          fout={postcodeFout}
          autoComplete="off"
          spellCheck={false}
        />
        <Veld
          label={t.huisnummer}
          waarde={huidig.huisnummer}
          opWijzig={(huisnummer) => {
            setStatus('rust');
            zetDelen({ ...huidig, huisnummer });
          }}
          onBlur={() =>
            verlaat('huisnummer', () => {
              const c = controleerHuisnummer(huidig.huisnummer);
              if (c.geldig && c.waarde !== huidig.huisnummer) zetDelen({ ...huidig, huisnummer: c.waarde });
            })
          }
          fout={huisnummerFout}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {status !== 'rust' && (
        <p role="status" className="text-tekst-zacht">
          {status === 'zoeken'
            ? t.zoeken
            : status === 'postcodeNietGevonden'
              ? t.postcodeNietGevonden
              : t.nietGevonden}
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Veld
          label={t.straat}
          waarde={huidig.straat}
          opWijzig={(straat) => zetDelen({ ...huidig, straat })}
          onBlur={() => verlaat('straat')}
          fout={straatFout}
          autoComplete="off"
        />
        <Veld
          label={t.plaats}
          waarde={waarde.plaats}
          opWijzig={(plaats) => opWijzig({ plaats })}
          onBlur={() => verlaat('plaats')}
          fout={plaatsFout}
          autoComplete="off"
        />
      </div>
      {afwijkend && (
        <p
          role="status"
          className="flex items-center gap-3 rounded-knop border-2 border-waarschuwing-rand bg-waarschuwing-vlak px-4 py-3 font-semibold text-waarschuwing"
        >
          <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
          {t.afwijkend}
        </p>
      )}
    </div>
  );
}
