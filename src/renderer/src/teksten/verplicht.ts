import { WIZARD_VELDNAMEN } from '@shared/teksten/wizardPunten';

// Interfacetekst van Instellingen › Verplichte velden (OFM-038, NFE-006, V-11). De veldnamen zijn
// gedeeld met de meldingen van de wizard (`@shared/teksten/wizardPunten`).
export const verplicht = {
  uitleg:
    'Kies welke velden ingevuld moeten zijn voordat een offerte gemaakt kan worden. Een lege verplichte waarde verschijnt pas bij Maak de offerte in de lijst met wat nog ontbreekt.',
  stap: {
    1: 'Stap 1: Klant',
    2: 'Stap 2: Het dak',
    3: "Stap 3: Extra's",
  },
  /** Bij de velden van het werkadres. */
  werkadresHint: 'Alleen als "Het werk is op een ander adres" is aangevinkt.',
  /** Bij de bedrijfsnaam. */
  bedrijfsnaamHint: 'Alleen bij aanhef Bedrijf. Voor- en achternaam zijn dan de contactpersoon.',
  /** Bij soort werk en dakvlak: niet uit te zetten. */
  altijd: 'Altijd verplicht: Claude heeft dit nodig om de offerte te schrijven.',
  hoogteHint: 'Heeft altijd een waarde (standaard "Begane grond / 1 bouwlaag").',
  aanhefHint: 'Heeft altijd een waarde (standaard Dhr.).',
  herstel: 'Herstel standaard',
  veld: WIZARD_VELDNAMEN,
};
