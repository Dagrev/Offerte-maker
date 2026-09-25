import { useQuery } from '@tanstack/react-query';
import type { Resultaat } from '@shared/fouten';
import { queryClient } from './queryClient';
import { roep } from './roep';

// Back-ups (OFM-022, FE-101). Eigen key onder `['backups']`; `queryKeys.ts` blijft ongewijzigd (V-03).
const backupsKey = ['backups'] as const;

export function useBackups() {
  return useQuery({ queryKey: backupsKey, queryFn: () => roep(window.api.backupLijst()) });
}

/** `backup:maak` (reden handmatig); ververst daarna de lijst. */
export async function maakBackupNu(): Promise<{ bestand: string }> {
  const uit = await roep(window.api.backupMaak());
  await queryClient.invalidateQueries({ queryKey: backupsKey });
  return uit;
}

/**
 * `backup:zetTerug`. Bij succes herstart de app en komt er geen antwoord (§14.2); er komt alleen
 * een antwoord als main weigert of het terugzetten mislukt. Geeft dan het `Resultaat` met de fout.
 */
export function zetBackupTerug(bestand: string): Promise<Resultaat<null>> {
  return window.api.backupZetTerug({ bestand });
}
