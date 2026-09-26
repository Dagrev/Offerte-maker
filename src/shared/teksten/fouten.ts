import type { FoutCode } from '../fouten';

// Foutmeldingen (TDO §15.1, V-11, V-19). Main heeft ze nodig voor `Resultaat.melding`; alle overige
// interfacetekst staat in src/renderer/src/teksten/.

/** Maximale bestandsgrootte in MB bij `BESTAND_TE_GROOT`: 20 voor voorbeelden, 5 voor het logo (V-11). */
export function bestandTeGroot(maxMb: number): string {
  return `Dit bestand is te groot (maximaal ${maxMb} MB).`;
}

/** Standaardmelding per foutcode. `VALIDATIE` heeft per geval een eigen tekst (zie hieronder). */
export const FOUTMELDINGEN: Record<FoutCode, string> = {
  CLAUDE_NIET_GEINSTALLEERD:
    'De koppeling met Claude is niet ingesteld. Vraag de beheerder om dit in te stellen.',
  CLAUDE_TE_OUD: 'Claude Code is te oud. Vraag de beheerder om het bij te werken.',
  CLAUDE_NIET_INGELOGD: 'Je bent niet (meer) ingelogd bij Claude.',
  GEEN_INTERNET:
    'Er is geen internetverbinding. Je offerte is bewaard als concept; probeer het later opnieuw.',
  LIMIET_BEREIKT: 'Je Claude-tegoed is voor nu op. Probeer het over een tijdje opnieuw.',
  AGENT_ONBRUIKBAAR: 'Het is niet gelukt de offerte te maken. Probeer opnieuw.',
  AGENT_TIMEOUT: 'Het duurde te lang. Je offerte is bewaard als concept.',
  AGENT_AFGEBROKEN: 'Gestopt. Je offerte is bewaard als concept.',
  PRIVACY_GEBLOKKEERD:
    'Er stond nog een persoonsgegeven in de opdracht. Er is niets verstuurd. Haal namen, adressen en telefoonnummers uit het veld Overig en probeer opnieuw.',
  PDF_BESTAND_BEZET: 'Het bestand is nog open in een ander programma. Sluit het en druk op Opnieuw.',
  BESTAND_TYPE_ONBEKEND: 'Dit soort bestand kan ik niet lezen. Gebruik een PDF- of Word-bestand.',
  BESTAND_TE_GROOT: bestandTeGroot(20),
  BESTAND_GEEN_TEKST: 'In dit bestand staat geen leesbare tekst. Misschien is het een scan.',
  BESTAND_ONLEESBAAR: 'Dit bestand kan niet worden geopend. Misschien is het beschadigd of beveiligd.',
  VALIDATIE: 'Ongeldige invoer.',
  BACKUP_MISLUKT: 'De back-up is niet gelukt. Probeer het opnieuw of vraag de beheerder.',
  HERSTEL_MISLUKT: 'Terugzetten is niet gelukt. Er is niets veranderd.',
  MAIL_GEEN_PROGRAMMA:
    'Er is geen mailprogramma ingesteld op deze computer. Stel er een in bij Windows-instellingen › Apps › Standaard-apps, of voeg de PDF zelf toe aan een mail (Toon in map).',
  ONBEKEND: 'Er ging iets mis. Je werk is bewaard.',
};

/** Vaste `VALIDATIE`-meldingen (V-03, V-11, V-19, V-27). */
export const VALIDATIE_MELDINGEN = {
  ongeldigeInvoer: 'Ongeldige invoer.',
  nogNietBeschikbaar: 'Nog niet beschikbaar.',
  eerstDefinitief: 'Maak de offerte eerst definitief.',
  eerstGoedkeuren: 'Keur dit voorbeeld eerst goed.',
  backupVanNieuwereVersie:
    'Deze back-up komt van een nieuwere versie van de app en kan niet worden teruggezet.',
  // Keuzelijsten (OFM-034)
  keuzeInGebruik: 'Deze keuze staat nog in een offerte. Je kunt hem wel verbergen.',
  keuzeVast: 'Dit is de standaardkeuze van een nieuwe offerte. Je kunt hem alleen een andere naam geven.',
  onbekendeKeuze: 'Deze keuze bestaat niet (meer). Kies een andere.',
  // Werkzaamheden en materialen (OFM-043)
  werkInGebruik:
    'Dit onderdeel staat nog in een offerte en kan niet worden verwijderd. Je kunt het wel verbergen.',
  werkDubbel: 'Een werkzaamheid, optie of materiaal staat er twee keer in. Laad het scherm opnieuw.',
  werkOnbekendeKoppeling: 'Een gekoppelde soort werk of een gekoppeld materiaal bestaat niet (meer).',
  werkLeegLabel: 'Vul bij elke werkzaamheid, optie en elk materiaal een naam in.',
  werkEenStandaard: 'Kies per werkzaamheid hooguit één standaardmateriaal.',
  werkPrijspostVast:
    'Deze prijspost hoort bij een werkzaamheid, optie of materiaal. Verwijder of hernoem die onder Werkzaamheden.',
} as const;
