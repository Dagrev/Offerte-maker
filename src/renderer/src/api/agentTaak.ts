import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

// Hulp rond agenttaken (OFM-013). De taken zelf staan in `stores/agentTaken.ts`.

/**
 * Actie "Opnieuw inloggen" van `Foutmelding` bij `CLAUDE_NIET_INGELOGD` (§15.1): start `claude:login`
 * en haalt daarna de Claude-status opnieuw op. Een mislukte login laat de melding gewoon staan.
 */
export function useOpnieuwInloggen(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void roep(window.api.claudeLogin())
      .catch(() => undefined)
      .finally(() => void queryClient.invalidateQueries({ queryKey: queryKeys.claudeStatus() }));
  }, [queryClient]);
}
