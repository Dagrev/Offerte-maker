import { Building2, Lock, User, UserRound, Users } from 'lucide-react';
import { leegAdres } from '@shared/nieuweOfferte';
import type { Aanhef, Adres, Klant } from '@shared/types';
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
  /** Na een poging tot **Volgende**: verplichte velden als fout tonen (FE-024). */
  toonFouten: boolean;
}

/** Stap 1 (FE-021): klantgegevens; blijven lokaal. */
export function StapKlant({ klant, opWijzig, toonFouten }: StapKlantProps) {
  const { fouten, waarschuwingen } = controleerKlant(klant);
  const zet = (deel: Partial<Klant>) => opWijzig({ ...klant, ...deel });
  const zetAdres = (deel: Partial<Adres>) => zet({ adres: { ...klant.adres, ...deel } });
  const zetWerkadres = (deel: Partial<Adres>) => zet({ werkadres: { ...klant.werkadres, ...deel } });

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
          autoComplete="off"
        />
        <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr]">
          <Veld
            label={t.postcode}
            waarde={klant.adres.postcode}
            opWijzig={(postcode) => zetAdres({ postcode })}
            waarschuwing={waarschuwingen.postcode ? t.postcodeVorm : undefined}
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
            autoComplete="off"
          />
          <Veld
            label={t.email}
            type="email"
            waarde={klant.email}
            opWijzig={(email) => zet({ email })}
            waarschuwing={waarschuwingen.email ? t.emailVorm : undefined}
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
              autoComplete="off"
            />
            <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr]">
              <Veld
                label={t.postcode}
                waarde={klant.werkadres.postcode}
                opWijzig={(postcode) => zetWerkadres({ postcode })}
                waarschuwing={waarschuwingen.werkadresPostcode ? t.postcodeVorm : undefined}
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
