import type { Eenheid } from '@shared/types';
import type { InstellingenTab } from '../stores/navigatie';

// Interfacetekst (NFE-006, V-11). Eigenaar: OFM-018 (container en tabs Bedrijf, Opmaak, Teksten, Prijzen).
// De inhoud van Voorbeelden en de Geavanceerd-subtabs staat in hun eigen modules (OFM-019 t/m 022).
export const instellingen = {
  titel: 'Instellingen',
  terug: 'Terug naar overzicht',
  tabs: 'Onderdelen',
  subtabs: 'Geavanceerd',
  geavanceerd: 'Geavanceerd',
  tab: {
    bedrijf: 'Bedrijf',
    opmaak: 'Opmaak',
    teksten: 'Teksten',
    prijzen: 'Prijzen',
    keuzelijsten: 'Keuzelijsten',
    voorbeelden: 'Voorbeelden',
    claudeKoppeling: 'Claude-koppeling',
    privacylog: 'Wat is naar Claude gestuurd',
    backups: 'Back-ups',
    over: 'Over',
  } satisfies Record<InstellingenTab, string>,

  bedrijf: {
    uitleg: 'Deze gegevens staan op elke offerte.',
    naam: 'Bedrijfsnaam',
    contactpersoon: 'Contactpersoon',
    adres: 'Adres',
    postcode: 'Postcode',
    plaats: 'Plaats',
    telefoon: 'Telefoon',
    email: 'E-mail',
    website: 'Website',
    kvk: 'KvK-nummer',
    btwNummer: 'Btw-nummer',
    iban: 'IBAN',
    logo: 'Logo',
    logoHint: 'PNG of JPG, maximaal 5 MB.',
    logoKiezen: 'Logo kiezen',
    logoVervangen: 'Ander logo kiezen',
    logoVerwijderen: 'Logo verwijderen',
    geenLogo: 'Nog geen logo gekozen.',
    logoAlt: 'Logo van het bedrijf',
  },

  opmaak: {
    uitleg: 'Zo zien nieuwe offertes eruit. Bestaande PDF-bestanden veranderen niet.',
    layout: 'Lay-out',
    layouts: { klassiek: 'Klassiek', modern: 'Modern', compact: 'Compact' },
    accentkleur: 'Accentkleur',
    eigenKleur: 'Eigen kleur',
    eigenKleurHint: 'Als code, bijvoorbeeld #1F4E79.',
    eigenKleurFout: 'Gebruik een # met zes tekens (0–9, A–F), bijvoorbeeld #1F4E79.',
    kleurKiezer: 'Kleur kiezen',
    lettertype: 'Lettertype',
    lettertypes: { inter: 'Inter', merriweather: 'Merriweather', 'source-sans-3': 'Source Sans 3' },
    voorbeeld: 'Voorbeeld van een offerte met deze opmaak',
    voorbeeldLayout: (naam: string) => `Voorbeeld van lay-out ${naam}`,
  },

  teksten: {
    uitleg: 'Deze teksten komen in elke nieuwe offerte. Claude gebruikt ze als basis.',
    inleiding: 'Inleiding',
    garantie10: 'Garantietekst 10 jaar',
    garantie20: 'Garantietekst 20 jaar (verzekerd)',
    betalingsvoorwaarden: 'Betalingsvoorwaarden',
    geldigheidDagen: 'Geldigheid van de offerte',
    geldigheidEenheid: 'dagen',
    geldigheidFout: 'Vul een aantal dagen in van 1 tot en met 365.',
    afsluiting: 'Afsluiting',
    voetnoot: 'Voetnoot',
    voetnootHint: 'Kleine tekst onderaan de offerte. Mag leeg blijven.',
  },

  prijzen: {
    uitleg:
      'Prijzen zijn exclusief btw. Een post zonder prijs mag: Claude schat die dan, en de offerte vraagt je om te controleren.',
    omschrijving: 'Omschrijving',
    eenheid: 'Eenheid',
    prijs: 'Prijs excl. btw',
    btw: 'Btw',
    btwTarief: (tarief: number) => `${tarief}%`,
    eenheden: { 'm²': 'm²', 'm¹': 'm¹', stuk: 'stuk', post: 'post', uur: 'uur', dag: 'dag' } satisfies Record<
      Eenheid,
      string
    >,
    toevoegen: 'Prijspost toevoegen',
    nieuwePost: 'Nieuwe post',
    verwijder: (omschrijving: string) => `Verwijder ${omschrijving}`,
    verwijderTitel: 'Prijspost verwijderen?',
    verwijderTekst: (omschrijving: string) => `"${omschrijving}" verdwijnt uit de prijslijst.`,
    verwijderJa: 'Verwijderen',
    verwijderNee: 'Annuleren',
    omschrijvingFout: 'Vul een omschrijving in.',
    rijLabel: (omschrijving: string, veld: string) => `${veld} van ${omschrijving}`,
  },
};
