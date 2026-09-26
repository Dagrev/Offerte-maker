import { useState } from 'react';
import { Building2, Lock, User, UserRound, Users } from 'lucide-react';
import { leegAdres } from '@shared/nieuweOfferte';
import type { Aanhef, Adres, Klant } from '@shared/types';
import { VALIDATIE_FOUTEN } from '@shared/teksten/validatie';
import {
  controleerEmail,
  controleerPostcode,
  controleerStraatHuisnummer,
  controleerTelefoon,
  type Controle,
  type KlantVeld,
} from '@shared/validatie';
import { controleerKlant } from '@shared/wizardControle';
import { Kaart } from '../../componenten/Kaart';
import { TegelKeuze, type TegelOptie } from '../../componenten/TegelKeuze';
import { Veld } from '../../componenten/Veld';
import { Vinkje } from '../../componenten/Vinkje';
import { nl } from '../../teksten/nl';

const t = nl.wizard.klant;

const AANHEF_OPTIES: readonly TegelOptie<Aanhef>[] = [
  { waarde: 'dhr', label: t.aanhefOpties.dhr, icoon: User },
  { waarde: 'mevr', label: t.aanhefOpties.mevr, icoon: UserRound },
  { waarde: 'fam', label: t.aanhefOpties.fam, icoon: Users },
  { waarde: 'bedrijf', label: t.aanhefOpties.bedrijf, icoon: Building2 },
];

export interface StapKlantProps {
  klant: Klant;
  opWijzig: (klant: Klant) => void;
  /** Na een poging tot **Volgende**: verplichte en ongeldige velden als fout tonen (FE-024). */
  toonFouten: boolean;
}

/** Per gecontroleerd veld (OFM-030): de controle die ook de genormaliseerde waarde geeft. */
const CONTROLES: Record<KlantVeld, (invoer: string) => Controle> = {
  'adres.straatHuisnummer': controleerStraatHuisnummer,
  'adres.postcode': controleerPostcode,
  'werkadres.straatHuisnummer': controleerStraatHuisnummer,
  'werkadres.postcode': controleerPostcode,
  telefoon: controleerTelefoon,
  email: controleerEmail,
};

/** Stap 1 (FE-021): klantgegevens; blijven lokaal. */
export function StapKlant({ klant, opWijzig, toonFouten }: StapKlantProps) {
  const { fouten, ongeldig } = controleerKlant(klant);
  // OFM-030: een ongeldige waarde pas melden na het verlaten van het veld (of na **Volgende**), zodat
  // een oude offerte met een oude waarde zonder melding opent.
  const [aangeraakt, setAangeraakt] = useState<ReadonlySet<KlantVeld>>(new Set());
  const zet = (deel: Partial<Klant>) => opWijzig({ ...klant, ...deel });
  const zetAdres = (deel: Partial<Adres>) => zet({ adres: { ...klant.adres, ...deel } });
  const zetWerkadres = (deel: Partial<Adres>) => zet({ werkadres: { ...klant.werkadres, ...deel } });

  /** Fout onder een gecontroleerd veld: de melding als het ongeldig is en al aangeraakt. */
  const ongeldigFout = (veld: KlantVeld) => {
    const soort = ongeldig[veld];
    return soort && (toonFouten || aangeraakt.has(veld)) ? VALIDATIE_FOUTEN[soort] : undefined;
  };
  /** Veld verlaten: markeren als aangeraakt en een geldige waarde meteen netjes zetten (1234 AB). */
  const verlaat = (veld: KlantVeld, waarde: string, zetWaarde: (w: string) => void) => {
    setAangeraakt((a) => (a.has(veld) ? a : new Set(a).add(veld)));
    const c = CONTROLES[veld](waarde);
    if (c.geldig && c.waarde !== waarde) zetWaarde(c.waarde);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-center gap-3 rounded-knop bg-vlak px-5 py-4 font-semibold">
        <Lock aria-hidden="true" className="size-6 shrink-0 text-accent" />
        {t.privacy}
      </p>

      <Kaart>
        <TegelKeuze
          label={t.aanhef}
          opties={AANHEF_OPTIES}
          waarde={klant.aanhef}
          opKies={(aanhef) => zet({ aanhef })}
        />
        <Veld
          label={t.naam}
          waarde={klant.naam}
          opWijzig={(naam) => zet({ naam })}
          fout={toonFouten && fouten.naam ? t.naamLeeg : undefined}
          autoComplete="off"
        />
        {klant.aanhef === 'bedrijf' && (
          <Veld
            label={t.bedrijfsnaam}
            waarde={klant.bedrijfsnaam}
            opWijzig={(bedrijfsnaam) => zet({ bedrijfsnaam })}
            autoComplete="off"
          />
        )}
      </Kaart>

      <Kaart>
        <Veld
          label={t.straatHuisnummer}
          waarde={klant.adres.straatHuisnummer}
          opWijzig={(straatHuisnummer) => zetAdres({ straatHuisnummer })}
          onBlur={() =>
            verlaat('adres.straatHuisnummer', klant.adres.straatHuisnummer, (straatHuisnummer) =>
              zetAdres({ straatHuisnummer }),
            )
          }
          fout={ongeldigFout('adres.straatHuisnummer')}
          autoComplete="off"
        />
        <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr]">
          <Veld
            label={t.postcode}
            waarde={klant.adres.postcode}
            opWijzig={(postcode) => zetAdres({ postcode })}
            onBlur={() =>
              verlaat('adres.postcode', klant.adres.postcode, (postcode) => zetAdres({ postcode }))
            }
            fout={ongeldigFout('adres.postcode')}
            autoComplete="off"
          />
          <Veld
            label={t.plaats}
            waarde={klant.adres.plaats}
            opWijzig={(plaats) => zetAdres({ plaats })}
            fout={toonFouten && fouten.plaats ? t.plaatsLeeg : undefined}
            autoComplete="off"
          />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Veld
            label={t.telefoon}
            type="tel"
            waarde={klant.telefoon}
            opWijzig={(telefoon) => zet({ telefoon })}
            onBlur={() => verlaat('telefoon', klant.telefoon, (telefoon) => zet({ telefoon }))}
            fout={ongeldigFout('telefoon')}
            autoComplete="off"
          />
          <Veld
            label={t.email}
            type="email"
            waarde={klant.email}
            opWijzig={(email) => zet({ email })}
            onBlur={() => verlaat('email', klant.email, (email) => zet({ email }))}
            fout={ongeldigFout('email')}
            autoComplete="off"
          />
        </div>
      </Kaart>

      <Kaart>
        <Vinkje
          label={t.anderWerkadres}
          aan={klant.heeftWerkadres}
          // §5: zonder werkadres is het werkadres leeg.
          opWijzig={(aan) => zet({ heeftWerkadres: aan, werkadres: leegAdres() })}
        />
        {klant.heeftWerkadres && (
          <fieldset className="flex flex-col gap-6">
            <legend className="mb-4 text-lg font-semibold">{t.werkadres}</legend>
            <Veld
              label={t.straatHuisnummer}
              waarde={klant.werkadres.straatHuisnummer}
              opWijzig={(straatHuisnummer) => zetWerkadres({ straatHuisnummer })}
              onBlur={() =>
                verlaat('werkadres.straatHuisnummer', klant.werkadres.straatHuisnummer, (straatHuisnummer) =>
                  zetWerkadres({ straatHuisnummer }),
                )
              }
              fout={ongeldigFout('werkadres.straatHuisnummer')}
              autoComplete="off"
            />
            <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr]">
              <Veld
                label={t.postcode}
                waarde={klant.werkadres.postcode}
                opWijzig={(postcode) => zetWerkadres({ postcode })}
                onBlur={() =>
                  verlaat('werkadres.postcode', klant.werkadres.postcode, (postcode) =>
                    zetWerkadres({ postcode }),
                  )
                }
                fout={ongeldigFout('werkadres.postcode')}
                autoComplete="off"
              />
              <Veld
                label={t.plaats}
                waarde={klant.werkadres.plaats}
                opWijzig={(plaats) => zetWerkadres({ plaats })}
                autoComplete="off"
              />
            </div>
          </fieldset>
        )}
      </Kaart>
    </div>
  );
}
