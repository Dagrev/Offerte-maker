import { safeStorage } from 'electron';
import { AppFout } from '@shared/fouten';
import { wijzigInstelling } from '../db/repo/instellingen';
import { log } from '../log';
import { legeStatusCache } from './claudeStatus';

// API-sleutel bewaren (TDO §10.8, NFE-015, V-17). Versleuteld met safeStorage (DPAPI onder Windows)
// en als base64 in `claude.apiSleutelVersleuteld`. De sleutel gaat nooit terug naar de renderer.

export const MELDING_GEEN_VERSLEUTELING = 'Versleutelen is op deze computer niet beschikbaar.';

/** `claude:bewaarApiSleutel`: `null` verwijdert de sleutel. Legt daarna de statuscache leeg (V-17). */
export function bewaarApiSleutel(sleutel: string | null): void {
  if (sleutel === null) {
    wijzigInstelling('claude', { apiSleutelVersleuteld: null });
    log.info('claude: API-sleutel verwijderd');
  } else {
    if (!safeStorage.isEncryptionAvailable()) throw new AppFout('VALIDATIE', MELDING_GEEN_VERSLEUTELING);
    const versleuteld = safeStorage.encryptString(sleutel.trim()).toString('base64');
    wijzigInstelling('claude', { apiSleutelVersleuteld: versleuteld });
    log.info('claude: API-sleutel bewaard');
  }
  legeStatusCache();
}
