import type { Weergave } from '../stores/navigatie';

// Interfacetekst (NFE-006, V-11). Eigenaar: OFM-009 (schermen/Overzicht.tsx, componenten/OfferteRij.tsx).
// Alleen het eigenaarticket vult deze module.
export const overzicht = {
  titel: 'Offertes',
  nieuweOfferte: 'Maak nieuwe offerte',
  instellingen: 'Instellingen',
  prullenbak: 'Prullenbak',

  weergaven: 'Weergave',
  weergave: { dag: 'Dag', week: 'Week', maand: 'Maand', jaar: 'Jaar' } satisfies Record<Weergave, string>,
  vorige: 'Vorige periode',
  volgende: 'Volgende periode',
  vandaag: 'Vandaag',

  /** Periodekiezer (OFM-037): kalenderknop en klikbaar periodelabel. */
  kiesPeriode: 'Kies periode',
  kiezer: {
    titel: {
      dag: 'Kies een dag',
      week: 'Kies een week',
      maand: 'Kies een maand',
      jaar: 'Kies een jaar',
    } satisfies Record<Weergave, string>,
    uitleg: 'Kies met de muis, of met de pijltjestoetsen en Enter.',
    vorigeMaand: 'Vorige maand',
    volgendeMaand: 'Volgende maand',
    vorigJaar: 'Vorig jaar',
    volgendJaar: 'Volgend jaar',
    vandaag: 'Vandaag',
    sluiten: 'Sluiten',
    week: 'Week',
    weekdagen: ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'],
  },

  zoeken: 'Zoek op naam of nummer',
  zoekWissen: 'Zoekveld leegmaken',
  zoekResultaten: (aantal: number) => (aantal === 1 ? '1 offerte gevonden' : `${aantal} offertes gevonden`),
  zoekLimiet: (max: number) => `Alleen de eerste ${max} treffers staan hier. Zoek preciezer.`,
  geenTreffers: 'Geen offertes gevonden.',

  leeg: 'Geen offertes in deze periode.',
  laden: 'Offertes laden…',

  concept: 'Concept',
  nogNietGemaakt: 'nog niet gemaakt',
  kolommen: {
    nummer: 'Nummer',
    klant: 'Klant',
    plaats: 'Plaats',
    omschrijving: 'Omschrijving',
    totaal: 'Totaal incl. btw',
    status: 'Status',
  },

  /** FE-014: "4 offertes · € 600 totaal · 1 akkoord" (enkelvoud bij 1, V-27). */
  samenvatting: (aantal: number, totaal: string, akkoord: number) =>
    `${aantal} ${aantal === 1 ? 'offerte' : 'offertes'} · ${totaal} totaal · ${akkoord} akkoord`,
  subtotaal: (bedrag: string) => `subtotaal ${bedrag}`,
};
