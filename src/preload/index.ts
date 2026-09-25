import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { IPC_KANALEN, VOORTGANG_KANAAL, apiNaam } from '@shared/ipcKanalen';
import type { Api, Voortgang } from '@shared/types';

// Gesandboxte preload (TDO §6.1, §17): `window.api` met precies één functie per kanaal uit
// ipcKanalen.ts, plus voortgang en bestandspaden. Geen generieke invoke. Validatie gebeurt in main.

function maakApi(): Api {
  const api: Record<string, unknown> = {};
  for (const kanaal of IPC_KANALEN) {
    api[apiNaam(kanaal)] = (invoer?: unknown) => ipcRenderer.invoke(kanaal, invoer);
  }
  api['opVoortgang'] = (cb: (voortgang: Voortgang) => void) => {
    const luisteraar = (_event: IpcRendererEvent, voortgang: Voortgang) => cb(voortgang);
    ipcRenderer.on(VOORTGANG_KANAAL, luisteraar);
    return () => {
      ipcRenderer.removeListener(VOORTGANG_KANAAL, luisteraar);
    };
  };
  api['padVanBestand'] = (bestand: File) => webUtils.getPathForFile(bestand);
  return api as Api;
}

contextBridge.exposeInMainWorld('api', maakApi());
