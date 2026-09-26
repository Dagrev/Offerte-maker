import type { Klant, KlusInvoer } from './types';
import { ongeldigeKlantVelden, type KlantVeld, type ValidatieFout } from './validatie';
import { ontbrekendeVelden, VELD_STAP, type Verplicht, type WizardVeld } from './verplicht';

// Controles van de wizard (FE-024, V-16, OFM-030, OFM-035, OFM-038). Pure functies; de meldingsteksten
// staan in `teksten/wizardPunten.ts` en `teksten/validatie.ts`. Sinds OFM-035 blokkeert niets het
// wisselen van stap: de punten worden pas bij **Maak de offerte** (en in main bij `offerte:maak` en
// `offerte:maakZonderClaude`) afgedwongen. Welke velden verplicht zijn, staat sinds OFM-038 in de
// instelling `verplicht` (`shared/verplicht.ts`); soort werk en een dakvlak > 0 m² altijd.

export type WizardStapNummer = 1 | 2 | 3 | 4;

/** Eén punt dat nog niet goed is, met de stap waar het hoort. */
export type WizardPunt =
  | { stap: WizardStapNummer; soort: 'ontbreekt'; veld: WizardVeld }
  | { stap: 1; soort: 'ongeldig'; veld: KlantVeld; fout: ValidatieFout };

export type WizardInvoer = Parameters<typeof ontbrekendeVelden>[1] & Pick<KlusInvoer, 'dakvlakken'>;

/**
 * Alles wat nog ontbreekt of ongeldig is, in de volgorde van de stappen: per ontbrekend verplicht veld
 * één punt, en de ongeldige klantvelden (OFM-030) na de ontbrekende velden van stap 1.
 */
export function wizardPunten(klant: Klant, invoer: WizardInvoer, verplicht: Verplicht): WizardPunt[] {
  const ontbreekt = ontbrekendeVelden(klant, invoer, verplicht).map((veld): WizardPunt => ({
    stap: VELD_STAP[veld],
    soort: 'ontbreekt',
    veld,
  }));
  const ongeldig = (Object.entries(ongeldigeKlantVelden(klant)) as [KlantVeld, ValidatieFout][]).map(
    ([veld, fout]): WizardPunt => ({ stap: 1, soort: 'ongeldig', veld, fout }),
  );
  return [...ontbreekt.filter((p) => p.stap === 1), ...ongeldig, ...ontbreekt.filter((p) => p.stap !== 1)];
}

/** De velden van stap 1 die ontbreken (voor de rode melding onder het veld). */
export function ontbrekendInStap1(punten: readonly WizardPunt[]): ReadonlySet<WizardVeld> {
  return new Set(punten.flatMap((p) => (p.soort === 'ontbreekt' && p.stap === 1 ? [p.veld] : [])));
}

/** Aantal punten per stap (index 0 = stap 1), voor de markeringen in de stappenbalk. */
export function puntenPerStap(punten: readonly WizardPunt[]): [number, number, number, number] {
  const aantal = (stap: WizardStapNummer) => punten.filter((p) => p.stap === stap).length;
  return [aantal(1), aantal(2), aantal(3), aantal(4)];
}

/** Sleutel van een punt, uniek binnen de lijst (voor React-lijsten). */
export function puntSleutel(punt: WizardPunt): string {
  return `${punt.soort}:${punt.veld}`;
}
