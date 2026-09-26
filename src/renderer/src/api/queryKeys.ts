// Query-keys van react-query (TDO §13.1). Mutaties invalideren de betrokken keys; gebruik altijd
// deze functies, zodat een key maar op één plek gespeld wordt.
export const queryKeys = {
  appInfo: () => ['appInfo'] as const,
  overzicht: () => ['overzicht'] as const,
  offerte: (id: string) => ['offerte', id] as const,
  instellingen: () => ['instellingen'] as const,
  prijzen: () => ['prijzen'] as const,
  keuzelijsten: () => ['keuzelijsten'] as const,
  voorbeelden: () => ['voorbeelden'] as const,
  claudeStatus: () => ['claudeStatus'] as const,
};
