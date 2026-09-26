import { useState } from 'react';
import { Building2, Lock, User, UserRound, Users } from 'lucide-react';
import { normaliseerTussenvoegsel } from '@shared/naam';
import { leegAdres } from '@shared/nieuweOfferte';
import type { Aanhef, Adres, Klant } from '@shared/types';
import { VALIDATIE_FOUTEN } from '@shared/teksten/validatie';
import { controleerEmail, controleerTelefoon, ongeldigeKlantVelden, type Controle } from '@shared/validatie';
import type { WizardVeld } from '@shared/verplicht';
import { AdresVelden } from '../../componenten/AdresVelden';
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
  /** Na een poging tot **Maak de offerte**: verplichte en ongeldige velden als fout tonen (FE-024, OFM-035). */
  toonFouten: boolean;
  /** Verplichte velden van deze stap die leeg zijn (OFM-038, instelling `verplicht`). */
  ontbrekend: ReadonlySet<WizardVeld>;
}

/**
 * Telefoon en e-mail (OFM-030): de controle die ook de genormaliseerde waarde geeft. Adressen
 * controleert `AdresVelden` zelf (OFM-031).
 */
type ContactVeld = 'telefoon' | 'email';
const CONTROLES: Record<ContactVeld, (invoer: string) => Controle> = {
  telefoon: controleerTelefoon,
  email: controleerEmail,
};

/** Stap 1 (FE-021): klantgegevens; blijven lokaal. Sinds OFM-038 voor- en achternaam apart. */
export function StapKlant({ klant, opWijzig, toonFouten, ontbrekend }: StapKlantProps) {
  const ongeldig = ongeldigeKlantVelden(klant);
  // OFM-030: een ongeldige waarde pas melden na het verlaten van het veld (of na **Volgende**), zodat
  // een oude offerte met een oude waarde zonder melding opent.
  const [aangeraakt, setAangeraakt] = useState<ReadonlySet<ContactVeld>>(new Set());
  const zet = (deel: Partial<Klant>) => opWijzig({ ...klant, ...deel });
  const zetAdres = (deel: Partial<Adres>) => zet({ adres: { ...klant.adres, ...deel } });
  const zetWerkadres = (deel: Partial<Adres>) => zet({ werkadres: { ...klant.werkadres, ...deel } });
  const isBedrijf = klant.aanhef === 'bedrijf';

  /** OFM-038: een leeg verplicht veld pas na een poging tot maken als fout tonen. */
  const leegFout = (veld: WizardVeld) => (toonFouten && ontbrekend.has(veld) ? t.veldLeeg : undefined);
  /** Fout onder een gecontroleerd veld: de melding als het ongeldig is en al aangeraakt. */
  const ongeldigFout = (veld: ContactVeld) => {
    const soort = ongeldig[veld];
    return soort && (toonFouten || aangeraakt.has(veld)) ? VALIDATIE_FOUTEN[soort] : undefined;
  };
  /** Veld verlaten: markeren als aangeraakt en een geldige waarde meteen netjes zetten (1234 AB). */
  const verlaat = (veld: ContactVeld, waarde: string, zetWaarde: (w: string) => void) => {
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
        {isBedrijf && (
          <Veld
            label={t.bedrijfsnaam}
            waarde={klant.bedrijfsnaam}
            opWijzig={(bedrijfsnaam) => zet({ bedrijfsnaam })}
            fout={leegFout('bedrijfsnaam')}
            autoComplete="off"
          />
        )}
        {isBedrijf && <p className="text-lg font-semibold">{t.contactpersoon}</p>}
        {/* OFM-046: voornaam, tussenvoegsel (smal, nooit verplicht) en achternaam op één rij. */}
        <div className="grid gap-6 md:grid-cols-[2fr_1fr_2fr]">
          <Veld
            label={t.voornaam}
            waarde={klant.voornaam}
            opWijzig={(voornaam) => zet({ voornaam })}
            fout={leegFout('voornaam')}
            autoComplete="off"
          />
          <Veld
            label={t.tussenvoegsel}
            waarde={klant.tussenvoegsel}
            opWijzig={(tussenvoegsel) => zet({ tussenvoegsel })}
            onBlur={() => {
              const netjes = normaliseerTussenvoegsel(klant.tussenvoegsel);
              if (netjes !== klant.tussenvoegsel) zet({ tussenvoegsel: netjes });
            }}
            autoComplete="off"
          />
          <Veld
            label={t.achternaam}
            waarde={klant.achternaam}
            opWijzig={(achternaam) => zet({ achternaam })}
            fout={leegFout('achternaam')}
            autoComplete="off"
          />
        </div>
      </Kaart>

      <Kaart>
        <AdresVelden
          waarde={klant.adres}
          opWijzig={zetAdres}
          toonFouten={toonFouten}
          plaatsFout={leegFout('plaats')}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <Veld
            label={t.telefoon}
            type="tel"
            waarde={klant.telefoon}
            opWijzig={(telefoon) => zet({ telefoon })}
            onBlur={() => verlaat('telefoon', klant.telefoon, (telefoon) => zet({ telefoon }))}
            fout={ongeldigFout('telefoon') ?? leegFout('telefoon')}
            autoComplete="off"
          />
          <Veld
            label={t.email}
            type="email"
            waarde={klant.email}
            opWijzig={(email) => zet({ email })}
            onBlur={() => verlaat('email', klant.email, (email) => zet({ email }))}
            fout={ongeldigFout('email') ?? leegFout('email')}
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
            <AdresVelden
              waarde={klant.werkadres}
              opWijzig={zetWerkadres}
              toonFouten={toonFouten}
              plaatsFout={leegFout('werkPlaats')}
            />
          </fieldset>
        )}
      </Kaart>
    </div>
  );
}
