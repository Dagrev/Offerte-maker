import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

/** `app:info`: versie, `vandaag` (V-10), `welkomVoltooid` en de mappen. */
export function useAppInfo() {
  return useQuery({
    queryKey: queryKeys.appInfo(),
    queryFn: () => roep(window.api.appInfo()),
  });
}
