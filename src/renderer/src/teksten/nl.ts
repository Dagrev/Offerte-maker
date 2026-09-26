import { algemeen } from './algemeen';
import { componenten } from './componenten';
import { welkom } from './welkom';
import { overzicht } from './overzicht';
import { wizard } from './wizard';
import { bezig } from './bezig';
import { detail } from './detail';
import { bewerken } from './bewerken';
import { instellingen } from './instellingen';
import { keuzelijsten } from './keuzelijsten';
import { verplicht } from './verplicht';
import { voorbeelden } from './voorbeelden';
import { claudeKoppeling } from './claudeKoppeling';
import { privacylog } from './privacylog';
import { over } from './over';
import { backups } from './backups';
import { prullenbak } from './prullenbak';

/**
 * Alle zichtbare tekst van de renderer, als één genest object (TDO §13.1, NFE-006, V-03).
 * Elk scherm heeft een eigen module; een schermticket vult alleen zijn eigen module en raakt dit
 * verzamelbestand niet. Foutmeldingen komen niet hierin maar uit `Resultaat.melding` (V-11).
 */
export const nl = {
  algemeen,
  componenten,
  welkom,
  overzicht,
  wizard,
  bezig,
  detail,
  bewerken,
  instellingen,
  keuzelijsten,
  verplicht,
  voorbeelden,
  claudeKoppeling,
  privacylog,
  over,
  backups,
  prullenbak,
};
