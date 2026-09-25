import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

/**
 * `claude:status` voor het statusbolletje (FE-093). Het kanaal zelf bouwt OFM-012; tot dan (of bij
 * een onverwachte fout) is de status onbekend (`null`). Na wijzigen van de koppeling invalideert
 * OFM-020 `queryKeys.claudeStatus()`.
 */
export function useClaudeStatus() {
  const query = useQuery({
    queryKey: queryKeys.claudeStatus(),
    queryFn: () => roep(window.api.claudeStatus()),
  });
  return query.data ?? null;
}
