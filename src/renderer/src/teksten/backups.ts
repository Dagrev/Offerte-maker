// Interfacetekst (NFE-006, V-11). Eigenaar: OFM-022 (Geavanceerd, Back-ups).
// Alleen het eigenaarticket vult deze module. Foutmeldingen komen uit main (`shared/teksten/fouten.ts`).
export const backups = {
  titel: 'Back-ups',
  uitleg:
    'De app maakt elke dag bij het starten een back-up van alle offertes en instellingen. De laatste 30 back-ups blijven bewaard.',
  maakNu: 'Maak nu een back-up',
  laden: 'Back-ups worden opgehaald…',
  geen: 'Er zijn nog geen back-ups.',
  kolomTijdstip: 'Tijdstip',
  kolomSoort: 'Soort',
  kolomGrootte: 'Grootte',
  zetTerug: 'Zet deze back-up terug',
  zetTerugVan: (tijdstip: string) => `Zet de back-up van ${tijdstip} terug`,
  soort: {
    dagelijks: 'Dagelijks',
    handmatig: 'Handmatig',
    'voor-migratie': 'Voor een update',
    'voor-herstel': 'Voor terugzetten',
  } as Record<string, string>,
  bevestigTitel: 'Back-up terugzetten',
  bevestigTekst: (tijdstip: string) =>
    `Weet je het zeker? Alle offertes en instellingen gaan terug naar de stand van ${tijdstip}. De huidige stand wordt eerst als back-up bewaard.`,
  bevestigKnop: 'Ja, zet terug',
  annuleer: 'Annuleren',
  bezigMetTerugzetten: 'De back-up wordt teruggezet. De app start zo opnieuw op…',
  grootte: (bytes: number) =>
    bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} MB`
      : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('nl-NL')} kB`,
};
