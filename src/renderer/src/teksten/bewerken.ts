// Interfacetekst (NFE-006, V-11). Eigenaar: OFM-014 (schermen/Bewerken.tsx).
// Alleen het eigenaarticket vult deze module.
export const bewerken = {
  titel: 'Offerte aanpassen',
  laden: 'De offerte wordt geopend…',
  terug: 'Terug naar de offerte',

  teksten: 'Teksten',
  titelVeld: 'Titel',
  inleiding: 'Inleiding',
  werkomschrijving: 'Werkomschrijving',
  werkomschrijvingHint: 'Eén stap per regel.',
  uitvoering: 'Uitvoering',
  opmerkingen: 'Opmerkingen',
  afsluiting: 'Afsluiting',

  regels: 'Prijsregels',
  omschrijving: 'Omschrijving',
  aantal: 'Aantal',
  eenheid: 'Eenheid',
  prijs: 'Prijs per eenheid (€)',
  btw: 'Btw',
  btwOptie: (tarief: number) => `${tarief}%`,
  bedrag: 'Bedrag',
  geschat: 'Geschatte prijs',
  regelOmhoog: (nr: number) => `Regel ${nr} omhoog`,
  regelOmlaag: (nr: number) => `Regel ${nr} omlaag`,
  regelVerwijderen: (nr: number) => `Regel ${nr} verwijderen`,
  regelToevoegen: 'Regel toevoegen',
  geenRegels: 'Er zijn nog geen regels.',

  subtotaal: 'Subtotaal excl. btw',
  btwRegel: (tarief: number, grondslag: string) => `Btw ${tarief}% over ${grondslag}`,
  totaal: 'Totaal incl. btw',

  controlepunten: 'Controlepunten',
  controlepuntenHint: 'Haal een punt weg als je het hebt gecontroleerd.',
  controlepuntVerwijderen: (nr: number) => `Controlepunt ${nr} weghalen`,

  klaar: 'Klaar met aanpassen',
  annuleren: 'Annuleren',
  bezigMetBewaren: 'Bezig met bewaren…',

  annulerenTitel: 'Wijzigingen weggooien?',
  annulerenTekst: 'Je aanpassingen worden niet bewaard.',
  weggooien: 'Weggooien',
  verderAanpassen: 'Verder aanpassen',
};
