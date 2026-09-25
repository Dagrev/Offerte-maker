import { useQuery } from '@tanstack/react-query';
import type { ClaudeStatus } from '@shared/types';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

/**
 * `claude:status` voor het statusbolletje (FE-093). Tot de status bekend is (of bij een onverwachte
 * fout) is hij `null`. Na wijzigen van de koppeling invalideert OFM-020 `queryKeys.claudeStatus()`.
 */
export function useClaudeStatus() {
  return useClaudeStatusQuery().data ?? null;
}

/** De volledige query, voor het statusblok in de tab Claude-koppeling (OFM-020). */
export function useClaudeStatusQuery() {
  return useQuery({
    queryKey: queryKeys.claudeStatus(),
    queryFn: () => roep(window.api.claudeStatus()),
  });
}

function zetStatus(status: ClaudeStatus): void {
  queryClient.setQueryData(queryKeys.claudeStatus(), status);
}

async function ververs(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.claudeStatus() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.instellingen() }),
  ]);
}

/** `claude:login`: wacht tot het loginvenster sluit en geeft de nieuwe status (FE-091). */
export async function koppelClaude(): Promise<ClaudeStatus> {
  const status = await roep(window.api.claudeLogin());
  zetStatus(status);
  return status;
}

/** `claude:test`: de proefopdracht (FE-092); ververst daarna de status. */
export async function testKoppeling(): Promise<{ duurMs: number }> {
  try {
    return await roep(window.api.claudeTest());
  } finally {
    await queryClient.invalidateQueries({ queryKey: queryKeys.claudeStatus() });
  }
}

/** `claude:bewaarApiSleutel`; `null` verwijdert de sleutel (FE-094). */
export async function bewaarApiSleutel(sleutel: string | null): Promise<void> {
  await roep(window.api.claudeBewaarApiSleutel({ sleutel }));
  await ververs();
}

/** `claude:kiesPad`: bestandsdialoog voor claude.exe; `null` bij annuleren. */
export async function kiesClaudePad(): Promise<string | null> {
  return (await roep(window.api.claudeKiesPad())).pad;
}
