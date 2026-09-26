// Interfacetekst (NFE-006, V-11). Eigenaar: OFM-023 (schermen/Welkom.tsx); OFM-029 geen verplichte velden.
// Alleen het eigenaarticket vult deze module.
export const welkom = {
  titel: 'Welkom',
  intro:
    'Voordat je je eerste offerte maakt, stellen we in drie stappen alles in. Alles wat je invult, wordt meteen bewaard. Je kunt het later aanpassen via Instellingen.',
  stappen: ['Bedrijfsgegevens', 'Claude koppelen', 'Voorbeeldoffertes toevoegen'],
  stapKop: (nummer: number, naam: string) => `${nummer}. ${naam}`,
  uitleg: [
    'Deze gegevens komen op elke offerte.',
    'Claude schrijft je offertes. Koppel hier je Claude-account.',
    'Oude offertes helpen Claude om in jouw stijl te schrijven. Deze stap mag je overslaan.',
  ],
  volgende: 'Volgende',
  vorige: 'Vorige',
  overslaan: 'Overslaan',
  klaar: 'Klaar',
  /** OFM-029: gele, niet-blokkerende melding na stap 1 als er bedrijfsgegevens ontbreken (V-20). */
  nogNietIngevuld: 'Nog niet alles ingevuld',
  laterInvullen: 'Je kunt dit later invullen via Instellingen › Bedrijf',
  nietGekoppeld: 'Claude is nog niet gekoppeld. Dat kan later via Instellingen → Geavanceerd.',
};
