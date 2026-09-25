import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { Instellingen } from '@shared/types';
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

function naarForm(b: Instellingen['bedrijf']): BedrijfForm {
  const { logoBestandId: _id, logoDataUri: _logo, ...rest } = b;
  void _id;
  void _logo;
  return rest;
}

/** Tab Bedrijf (FE-070): bedrijfsgegevens en logo; elk veld bewaart vanzelf (FE-075). */
export function TabBedrijf({ instellingen }: { instellingen: Instellingen }) {
  const [form, setForm] = useState<BedrijfForm>(() => naarForm(instellingen.bedrijf));
  const bewaren = useAutoBewaar((waarde: BedrijfForm) => bewaarInstelling({ sleutel: 'bedrijf', waarde }));

  const wijzig = (sleutel: Sleutel, waarde: string) => {
    const nieuw = { ...form, [sleutel]: waarde };
    setForm(nieuw);
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
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {VELDEN.map(({ sleutel, breed, type, autoComplete }) => (
            <div key={sleutel} className={breed ? 'col-span-2' : ''}>
              <Veld
                label={t[sleutel]}
                waarde={form[sleutel]}
                opWijzig={(w) => wijzig(sleutel, w)}
                onBlur={bewaren.bewaarNu}
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
