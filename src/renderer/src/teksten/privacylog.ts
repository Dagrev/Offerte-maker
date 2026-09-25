import type { PrivacylogItem } from '@shared/types';

// Interfacetekst (NFE-006, V-11). Eigenaar: OFM-021 (Geavanceerd, Wat is naar Claude gestuurd).
// Alleen het eigenaarticket vult deze module.
export const privacylog = {
  titel: 'Wat is naar Claude gestuurd',
  uitleg:
    'Hier zie je precies wat de app naar Claude heeft gestuurd en wat er terugkwam. Namen, adressen en andere klantgegevens staan er niet in: die zijn vervangen door codes zoals [KLANT_NAAM]. Regels ouder dan een jaar worden automatisch verwijderd.',
  leeg: 'Er is nog niets naar Claude gestuurd.',
  limiet: (max: number) => `De nieuwste ${max} verzendingen staan hier.`,
  kolommen: { tijdstip: 'Datum en tijd', offerte: 'Offerte', soort: 'Soort', resultaat: 'Resultaat' },
  soort: {
    maken: 'Offerte maken',
    aanpassen: 'Aanpassen',
    template_teksten: 'Teksten uit template',
    test: 'Test',
  } satisfies Record<PrivacylogItem['soort'], string>,
  gelukt: 'Gelukt',
  mislukt: (melding: string) => `Mislukt: ${melding}`,
  gestopt: 'Gestopt',
  geenOfferte: '—',
  concept: 'Concept',
  openen: (tijdstip: string, soort: string) => `Bekijk ${soort} van ${tijdstip}`,
  terug: 'Terug naar de lijst',
  verstuurd: 'Verstuurd',
  antwoord: 'Antwoord',
  geenAntwoord: 'Er is geen antwoord ontvangen.',
};
