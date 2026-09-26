import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { VALIDATIE_FOUTEN } from '@shared/teksten/validatie';
import type { Instellingen } from '@shared/types';
import {
  bewaarbaarBedrijf,
  controleerEmail,
  controleerPostcode,
  controleerStraatHuisnummer,
  controleerTelefoon,
  ongeldigeBedrijfVelden,
  type BedrijfVeld,
  type Controle,
} from '@shared/validatie';
import { bewaarInstelling, useLogo } from '../../api/instellingen';
import { alsFout } from '../../api/roep';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Kaart } from '../../componenten/Kaart';
import { Knop } from '../../componenten/Knop';
import { Veld } from '../../componenten/Veld';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';

type BedrijfForm = Omit<Instellingen['bedrijf'], 'logoBestandId' | 'logoDataUri'>;
type Sleutel = keyof BedrijfForm;

const t = nl.instellingen.bedrijf;

// Volgorde en breedte van de velden (FE-070, §4.3).
const VELDEN: { sleutel: Sleutel; breed?: boolean; type?: string; autoComplete?: string }[] = [
  { sleutel: 'naam', breed: true, autoComplete: 'organization' },
  { sleutel: 'contactpersoon', autoComplete: 'name' },
  { sleutel: 'telefoon', type: 'tel', autoComplete: 'tel' },
  { sleutel: 'adres', breed: true, autoComplete: 'street-address' },
  { sleutel: 'postcode', autoComplete: 'postal-code' },
  { sleutel: 'plaats', autoComplete: 'address-level2' },
  { sleutel: 'email', type: 'email', autoComplete: 'email' },
  { sleutel: 'website', type: 'url', autoComplete: 'url' },
  { sleutel: 'kvk' },
  { sleutel: 'btwNummer' },
  { sleutel: 'iban', breed: true },
];

/** Gecontroleerde velden (OFM-030) met de controle die ook de genormaliseerde waarde geeft. */
const CONTROLES: Record<BedrijfVeld, (invoer: string) => Controle> = {
  adres: controleerStraatHuisnummer,
  postcode: controleerPostcode,
  telefoon: controleerTelefoon,
  email: controleerEmail,
};
const isGecontroleerd = (sleutel: Sleutel): sleutel is BedrijfVeld => sleutel in CONTROLES;

function naarForm(b: Instellingen['bedrijf']): BedrijfForm {
  const { logoBestandId: _id, logoDataUri: _logo, ...rest } = b;
  void _id;
  void _logo;
  return rest;
}

/**
 * Tab Bedrijf (FE-070): bedrijfsgegevens en logo; elk veld bewaart vanzelf (FE-075). `opWijzig` is
 * voor het welkomstscherm (OFM-023), dat ontbrekende gegevens meldt bij het verlaten van stap 1 (OFM-029).
 *
 * OFM-030: adres, postcode, telefoon en e-mail worden gecontroleerd. Een ongeldig veld krijgt na het
 * verlaten een rode melding en wordt niet bewaard (de laatst bewaarde waarde gaat mee); de andere
 * velden wel. Een geldige waarde wordt bij het verlaten netjes gezet (`1234 AB`, `+31612345678`).
 */
export function TabBedrijf({
  instellingen,
  opWijzig,
}: {
  instellingen: Instellingen;
  opWijzig?: (bedrijf: BedrijfForm) => void;
}) {
  const [form, setForm] = useState<BedrijfForm>(() => naarForm(instellingen.bedrijf));
  const bewaren = useAutoBewaar((waarde: BedrijfForm) => bewaarInstelling({ sleutel: 'bedrijf', waarde }));
  const bewaardRef = useRef(form);
  const [aangeraakt, setAangeraakt] = useState<ReadonlySet<Sleutel>>(new Set());
  const ongeldig = ongeldigeBedrijfVelden(form);

  const wijzig = (sleutel: Sleutel, waarde: string) => {
    const nieuw = { ...form, [sleutel]: waarde };
    setForm(nieuw);
    bewaardRef.current = bewaarbaarBedrijf(nieuw, bewaardRef.current);
    bewaren.wijzig(bewaardRef.current);
    opWijzig?.(nieuw);
  };

  const verlaat = (sleutel: Sleutel) => {
    if (isGecontroleerd(sleutel)) {
      setAangeraakt((a) => (a.has(sleutel) ? a : new Set(a).add(sleutel)));
      const c = CONTROLES[sleutel](form[sleutel]);
      if (c.geldig && c.waarde !== form[sleutel]) wijzig(sleutel, c.waarde);
    }
    bewaren.bewaarNu();
  };

  const foutVan = (sleutel: Sleutel) => {
    if (!isGecontroleerd(sleutel) || !aangeraakt.has(sleutel)) return undefined;
    const soort = ongeldig[sleutel];
    return soort ? VALIDATIE_FOUTEN[soort] : undefined;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-tekst-zacht">{t.uitleg}</p>
        <BewaardIndicator signaal={bewaren.signaal} />
      </div>
      {bewaren.fout && <Foutmelding fout={bewaren.fout} opnieuw={bewaren.bewaarNu} />}

      <Kaart>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {VELDEN.map(({ sleutel, breed, type, autoComplete }) => (
            <div key={sleutel} className={breed ? 'col-span-2' : ''}>
              <Veld
                label={t[sleutel]}
                waarde={form[sleutel]}
                opWijzig={(w) => wijzig(sleutel, w)}
                onBlur={() => verlaat(sleutel)}
                fout={foutVan(sleutel)}
                type={type}
                autoComplete={autoComplete}
                spellCheck={false}
              />
            </div>
          ))}
        </div>
      </Kaart>

      <Logo logoDataUri={instellingen.bedrijf.logoDataUri} />
    </div>
  );
}

function Logo({ logoDataUri }: { logoDataUri: string | null }) {
  const { kies, verwijder } = useLogo();
  const fout = kies.error ?? verwijder.error;
  return (
    <Kaart titel={t.logo}>
      <p className="text-tekst-zacht">{t.logoHint}</p>
      {fout && <Foutmelding fout={alsFout(fout)} />}
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex h-28 w-64 items-center justify-center rounded-knop border border-dashed border-rand bg-vlak p-3">
          {logoDataUri ? (
            <img src={logoDataUri} alt={t.logoAlt} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-tekst-zacht">{t.geenLogo}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Knop
            label={logoDataUri ? t.logoVervangen : t.logoKiezen}
            icoon={ImagePlus}
            onClick={() => {
              verwijder.reset();
              kies.mutate();
            }}
            disabled={kies.isPending}
          />
          {logoDataUri && (
            <Knop
              label={t.logoVerwijderen}
              icoon={Trash2}
              variant="gevaar"
              onClick={() => {
                kies.reset();
                verwijder.mutate();
              }}
              disabled={verwijder.isPending}
            />
          )}
        </div>
      </div>
    </Kaart>
  );
}
