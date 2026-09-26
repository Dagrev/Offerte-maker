import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type { z } from 'zod';
import { AppFout, type Resultaat } from '@shared/fouten';
import { IPC_KANALEN, type Kanaal } from '@shared/ipcKanalen';
import { invoerSchemas } from '@shared/schemas';
import { FOUTMELDINGEN, VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { KanaalInvoer, KanaalUitvoer } from '@shared/types';
import { log } from '../log';
import { adresHandlers } from './adres';
import { appHandlers } from './app';
import { backupHandlers } from './backup';
import { claudeHandlers } from './claude';
import { instellingenHandlers } from './instellingen';
import { keuzelijstenHandlers } from './keuzelijsten';
import { mailHandlers } from './mail';
import { offerteAgentHandlers } from './offerteAgent';
import { offerteBeheerHandlers } from './offerteBeheer';
import { offerteDefinitiefHandlers } from './offerteDefinitief';
import { offerteInhoudHandlers } from './offerteInhoud';
import { offerteInvoerHandlers } from './offerteInvoer';
import { overzichtHandlers } from './overzicht';
import { privacylogHandlers } from './privacylog';
import { prijzenHandlers } from './prijzen';
import { voorbeeldenHandlers } from './voorbeelden';
import { welkomHandlers } from './welkom';

// IPC-registratie (TDO §6.1, NFE-014). Elke handler krijgt gevalideerde invoer en geeft data terug of
// gooit een AppFout; de omzetting naar `Resultaat<T>` gebeurt hier. Naar de renderer wordt nooit gegooid.

/** Handler voor één kanaal: invoer is al met het zod-schema gevalideerd. */
export type Handler<K extends Kanaal> = (
  invoer: KanaalInvoer<K>,
  event: IpcMainInvokeEvent,
) => KanaalUitvoer[K] | Promise<KanaalUitvoer[K]>;

/** Handlers van één domeinbestand (`src/main/ipc/<domein>.ts`). */
export type DomeinHandlers<K extends Kanaal> = { [P in K]: Handler<P> };

export type AlleHandlers = DomeinHandlers<Kanaal>;

export const alleHandlers: AlleHandlers = {
  ...appHandlers,
  ...welkomHandlers,
  ...overzichtHandlers,
  ...offerteInvoerHandlers,
  ...offerteAgentHandlers,
  ...offerteInhoudHandlers,
  ...offerteDefinitiefHandlers,
  ...mailHandlers,
  ...offerteBeheerHandlers,
  ...instellingenHandlers,
  ...keuzelijstenHandlers,
  ...adresHandlers,
  ...prijzenHandlers,
  ...voorbeeldenHandlers,
  ...claudeHandlers,
  ...privacylogHandlers,
  ...backupHandlers,
};

function offerteIdUit(invoer: unknown): string | null {
  if (typeof invoer === 'object' && invoer !== null && 'id' in invoer && typeof invoer.id === 'string') {
    return invoer.id;
  }
  return null;
}

/** Valideert, roept de handler aan en zet uitkomst of fout om in `Resultaat<T>`. */
export function maakIpcHandler<K extends Kanaal>(
  kanaal: K,
  handler: Handler<K>,
  schema: z.ZodType = invoerSchemas[kanaal],
): (event: IpcMainInvokeEvent, invoer: unknown) => Promise<Resultaat<KanaalUitvoer[K]>> {
  return async (event, invoer) => {
    const gecontroleerd = schema.safeParse(invoer);
    if (!gecontroleerd.success) {
      // Alleen pad en soort fout loggen, nooit de invoerwaarden (§15.3).
      const problemen = gecontroleerd.error.issues
        .map((i) => `${i.path.join('.') || '(invoer)'}: ${i.code}`)
        .join('; ');
      log.warn(`ipc ${kanaal}: VALIDATIE (${problemen})`);
      return { ok: false, fout: { code: 'VALIDATIE', melding: VALIDATIE_MELDINGEN.ongeldigeInvoer } };
    }

    try {
      const data = await handler(gecontroleerd.data as KanaalInvoer<K>, event);
      return { ok: true, data };
    } catch (fout: unknown) {
      const id = offerteIdUit(gecontroleerd.data);
      const idTekst = id ? ` offerte=${id}` : '';
      if (fout instanceof AppFout) {
        log.warn(`ipc ${kanaal}: ${fout.code}${idTekst}`);
        return { ok: false, fout: { code: fout.code, melding: fout.melding } };
      }
      log.error(`ipc ${kanaal}: ONBEKEND${idTekst}`, fout);
      return { ok: false, fout: { code: 'ONBEKEND', melding: FOUTMELDINGEN.ONBEKEND } };
    }
  };
}

/** §14.1 stap 7: alle kanalen registreren. `handlers` is alleen voor tests te vervangen. */
export function registreerIpc(ipc: Pick<IpcMain, 'handle'>, handlers: AlleHandlers = alleHandlers): void {
  for (const kanaal of IPC_KANALEN) {
    ipc.handle(kanaal, maakIpcHandler(kanaal, handlers[kanaal] as Handler<typeof kanaal>));
  }
}
