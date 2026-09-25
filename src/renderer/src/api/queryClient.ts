import { QueryClient } from '@tanstack/react-query';

// Alle data komt lokaal via IPC: geen netwerk, dus niet opnieuw proberen en niet opnieuw ophalen
// bij focus. Na een wijziging invalideert de mutatie zelf de betrokken query-keys.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
    },
    mutations: { retry: false },
  },
});
