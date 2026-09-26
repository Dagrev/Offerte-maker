import { m2VanDakvlak } from './calc/bedragen';
import type { Klant, KlusInvoer } from './types';
import { ongeldigeKlantVelden, type KlantVeld, type ValidatieFout } from './validatie';

// Controles van de wizard (FE-024, V-16, OFM-030, OFM-035). Pure functies; de meldingsteksten staan
// in `teksten/wizardPunten.ts` en `teksten/validatie.ts`. Sinds OFM-035 blokkeert niets het wisselen
// van stap: de punten worden pas bij **Maak de offerte** (en in main bij `offerte:maak` en
// `offerte:maakZonderClaude`) afgedwongen. Verplicht is alleen wat de agent echt nodig heeft.

export type WizardStapNummer = 1 | 2 | 3 | 4;

export interface KlantControle {
  /** Verplicht en leeg: de naam van de klant (bij een bedrijf mag ook alleen de bedrijfsnaam). */
  fouten: { naam?: 'leeg' };
  /** Ingevulde velden met een ongeldige waarde (OFM-030); lege velden staan hier nooit in. */
  ongeldig: Partial<Record<KlantVeld, ValidatieFout>>;
}

/** `true` als er een naam is om de klant mee aan te spreken: naam, of bij een bedrijf de bedrijfsnaam. */
export function heeftKlantnaam(klant: Pick<Klant, 'aanhef' | 'naam' | 'bedrijfsnaam'>): boolean {
  return klant.naam.trim() !== '' || (klant.aanhef === 'bedrijf' && klant.bedrijfsnaam.trim() !== '');
}

export function controleerKlant(klant: Klant): KlantControle {
  const fouten: KlantControle['fouten'] = {};
  if (!heeftKlantnaam(klant)) fouten.naam = 'leeg';
  return { fouten, ongeldig: ongeldigeKlantVelden(klant) };
}

/** Eén punt dat nog niet goed is, met de stap waar het hoort. */
export type WizardPunt =
  | { stap: 1; soort: 'naam' }
  | { stap: 1; soort: 'ongeldig'; veld: KlantVeld; fout: ValidatieFout }
  | { stap: 2; soort: 'soortWerk' }
  | { stap: 2; soort: 'dakvlak' };

/**
 * Alles wat nog ontbreekt of ongeldig is, in de volgorde van de stappen: klantnaam, ongeldige
 * klantvelden (OFM-030), soort werk, en minstens één dakvlak met een oppervlakte > 0.
 */
export function wizardPunten(
  klant: Klant,
  invoer: Pick<KlusInvoer, 'soortWerk' | 'dakvlakken'>,
): WizardPunt[] {
  const punten: WizardPunt[] = [];
  const { fouten, ongeldig } = controleerKlant(klant);
  if (fouten.naam) punten.push({ stap: 1, soort: 'naam' });
  for (const [veld, fout] of Object.entries(ongeldig) as [KlantVeld, ValidatieFout][]) {
    punten.push({ stap: 1, soort: 'ongeldig', veld, fout });
  }
  if (invoer.soortWerk === null) punten.push({ stap: 2, soort: 'soortWerk' });
  if (!invoer.dakvlakken.some((v) => m2VanDakvlak(v) > 0)) punten.push({ stap: 2, soort: 'dakvlak' });
  return punten;
}

/** Aantal punten per stap (index 0 = stap 1), voor de markeringen in de stappenbalk. */
export function puntenPerStap(punten: readonly WizardPunt[]): [number, number, number, number] {
  const aantal = (stap: WizardStapNummer) => punten.filter((p) => p.stap === stap).length;
  return [aantal(1), aantal(2), aantal(3), aantal(4)];
}
