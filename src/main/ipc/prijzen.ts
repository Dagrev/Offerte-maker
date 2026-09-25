import { bewaarPrijspost, lijstPrijsposten, verwijderPrijspost } from '../db/repo/prijsposten';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-018 (TDO §6.2, V-15). Lege `id` bij bewaren = nieuwe post met volgorde max + 10.
type Kanalen = 'prijzen:lijst' | 'prijzen:bewaar' | 'prijzen:verwijder';

export const prijzenHandlers: DomeinHandlers<Kanalen> = {
  'prijzen:lijst': () => lijstPrijsposten(),
  'prijzen:bewaar': (post) => bewaarPrijspost(post),
  'prijzen:verwijder': ({ id }) => {
    verwijderPrijspost(id);
    return null;
  },
};
