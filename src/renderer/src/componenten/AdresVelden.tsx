import { useEffect, useRef, useState } from 'react';
import { VALIDATIE_FOUTEN } from '@shared/teksten/validatie';
import { controleerHuisnummer, controleerPostcode } from '@shared/validatie';
import { nl } from '../teksten/nl';
import { adresFouten, splitsAdres, voegSamen, zoekSleutel, type StraatEnNummer } from './adresDelen';
import { Veld } from './Veld';

const t = nl.componenten.adres;

/** Wacht na de laatste wijziging van postcode of huisnummer voordat er wordt opgezocht (OFM-031). */
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

type Status = 'rust' | 'zoeken' | 'nietGevonden';

const normaal = (tekst: string) => tekst.trim().replace(/\s+/g, ' ');

/**
 * Adres met postcode en huisnummer vooraan (OFM-031). Zodra beide geldig zijn, zoekt main straat en
 * plaats op bij PDOK (`adres:zoek`, A-29) en vult ze in; daarna blijven ze gewoon te wijzigen. Niet
 * gevonden, geen internet of time-out: alleen de grijze tekst "Niet gevonden, vul zelf in".
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

  // De nieuwste `opWijzig` en delen voor het antwoord van het opzoeken (dat komt pas later binnen).
  const opWijzigRef = useRef(opWijzig);
  const delenRef = useRef(huidig);
  useEffect(() => {
    opWijzigRef.current = opWijzig;
    delenRef.current = huidig;
  });

  const zetDelen = (nieuw: StraatEnNummer) => {
    setDelen(nieuw);
    opWijzig({ straatHuisnummer: voegSamen(nieuw) });
  };

  // Opzoeken: pas na ZOEK_NA_MS zonder wijziging, en niet opnieuw voor dezelfde combinatie. De
  // combinatie waarmee het scherm opent telt als al opgezocht (een bestaand adres niet overschrijven).
  const sleutel = zoekSleutel(waarde.postcode, huidig.huisnummer);
  const laatsteSleutel = useRef(sleutel);
  useEffect(() => {
    if (sleutel === null || sleutel === laatsteSleutel.current) return;
    let actueel = true;
    const timer = setTimeout(() => {
      laatsteSleutel.current = sleutel;
      const [postcode = '', huisnummer = ''] = sleutel.split('|');
      setStatus('zoeken');
      void window.api.adresZoek({ postcode, huisnummer }).then((r) => {
        if (!actueel) return;
        const gevonden = r.ok ? r.data : null;
        setStatus(gevonden ? 'rust' : 'nietGevonden');
        if (!gevonden) return;
        const nieuw = { ...delenRef.current, straat: gevonden.straat };
        delenRef.current = nieuw;
        setDelen(nieuw);
        opWijzigRef.current({ straatHuisnummer: voegSamen(nieuw), plaats: gevonden.plaats });
      });
    }, ZOEK_NA_MS);
    return () => {
      actueel = false;
      clearTimeout(timer);
    };
  }, [sleutel]);

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
          {status === 'zoeken' ? t.zoeken : t.nietGevonden}
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
    </div>
  );
}
