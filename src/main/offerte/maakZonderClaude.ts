import { maakInhoudZonderClaude } from '@shared/zonderClaude';
import { haalInstelling } from '../db/repo/instellingen';
import { haalKeuzes } from '../db/repo/keuzeopties';
import { bewaarNieuweVersie, haalOfferteVoorAgent } from '../db/repo/offertesInhoud';
import { haalPrijspostOpSleutel } from '../db/repo/prijsposten';
import { haalWerkzaamheden } from '../db/repo/werkzaamheden';
import { log } from '../log';
import { terugNaarPlaatshouders } from '../privacy/invullen';

// `offerte:maakZonderClaude` (TDO §9.5, §10.7 stap 7, V-09, FE-110). Er gaat niets naar Claude: geen
// provider, geen privacylog. Eigenaar: OFM-025.

/** Bouwt de offerte uit wizard, prijslijst en standaardteksten en schrijft een nieuwe versie weg. */
export function maakZonderClaude(id: string): { controlepunten: number } {
  const offerte = haalOfferteVoorAgent(id);
  const teksten = haalInstelling('teksten');
  const inhoud = maakInhoudZonderClaude({
    invoer: offerte.invoer,
    keuzes: haalKeuzes(),
    catalogus: haalWerkzaamheden(),
    postOpSleutel: haalPrijspostOpSleutel,
    teksten: { inleiding: teksten.inleiding, afsluiting: teksten.afsluiting },
  });
  // Opslaginvariant (§11.4): `overig` en andere velden kunnen klantgegevens bevatten.
  const opgeslagen = terugNaarPlaatshouders(inhoud, offerte.klant);
  bewaarNieuweVersie({ id, inhoud: opgeslagen, bron: 'zonder_claude', wizardStap: 4 });
  log.info(
    `zonder Claude: ${opgeslagen.regels.length} regels, ${opgeslagen.controlepunten.length} controlepunten`,
  );
  return { controlepunten: opgeslagen.controlepunten.length };
}
