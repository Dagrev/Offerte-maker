// Interfacetekst (NFE-006, V-11). Eigenaar: OFM-019 (tab Voorbeelden en schermen/instellingen/VoorbeeldReview.tsx), OFM-024.
// Alleen het eigenaarticket vult deze module. Foutmeldingen staan in `src/shared/teksten/fouten.ts`.
export const voorbeelden = {
  reviewTitel: 'Voorbeeld controleren',

  // Tab
  uitleg:
    'Voeg oude offertes toe als PDF- of Word-bestand. De app haalt namen, adressen en nummers eruit. Controleer daarna elk voorbeeld: alleen goedgekeurde voorbeelden gebruikt Claude.',
  toevoegen: 'Voeg voorbeeldofferte toe',
  sleepHint: 'Je kunt PDF- of Word-bestanden ook hierheen slepen.',
  sleepLos: 'Laat los om toe te voegen',
  bezigToevoegen: 'Bezig met lezen en anonimiseren…',
  toegevoegd: (n: number) => (n === 1 ? '1 voorbeeld toegevoegd.' : `${n} voorbeelden toegevoegd.`),
  nietToegevoegd: 'Niet toegevoegd:',
  foutBijBestand: (bestandsnaam: string, melding: string) => `${bestandsnaam}: ${melding}`,
  leeg: 'Er zijn nog geen voorbeeldoffertes.',
  lijstLabel: 'Voorbeeldoffertes',
  toegevoegdOp: (datum: string) => `Toegevoegd op ${datum}`,
  status: {
    te_controleren: 'Nog controleren',
    goedgekeurd: 'Goedgekeurd',
  },
  template: 'Template',
  bekijk: 'Bekijken',
  bekijkLabel: (bestandsnaam: string) => `${bestandsnaam} bekijken`,
  verwijder: (bestandsnaam: string) => `${bestandsnaam} verwijderen`,
  verwijderTitel: 'Dit voorbeeld verwijderen?',
  verwijderTekst: (bestandsnaam: string) =>
    `${bestandsnaam} wordt verwijderd en niet meer als voorbeeld gebruikt.`,
  verwijderJa: 'Verwijderen',
  verwijderNee: 'Annuleren',

  // Review
  terug: 'Terug naar de lijst',
  reviewUitleg:
    'De zwarte balkjes zijn weggehaald. Zie je nog een naam, adres of nummer staan? Selecteer het met de muis en kies Onleesbaar maken.',
  tekstLabel: 'Geanonimiseerde tekst',
  balkVerwijderd: 'Weggehaald',
  balkBedrijf: 'Je eigen bedrijfsgegevens',
  onleesbaarMaken: 'Onleesbaar maken',
  selectieTeLang: 'Selecteer een kleiner stuk (maximaal 200 tekens).',
  zietErGoedUit: 'Ziet er goed uit',
  goedgekeurd: 'Goedgekeurd: Claude gebruikt dit voorbeeld.',
  nogControleren: 'Nog niet goedgekeurd: Claude gebruikt dit voorbeeld pas na Ziet er goed uit.',
  gebruikAlsTemplate: 'Gebruik als template',
  isTemplate: 'Dit is het template: Claude volgt de indeling en toon ervan.',
  geenTemplateMeer: 'Niet meer als template gebruiken',
};
