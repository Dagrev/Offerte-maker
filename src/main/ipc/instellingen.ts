import { dialog } from 'electron';
import {
  bewaarInstellingen,
  bewaarLogoBestand,
  haalInstellingen,
  opmaakVoorbeeldHtml,
  verwijderLogo,
} from '../instellingen/beheer';
import { huidigVenster } from '../venster';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-018 (TDO §6.2, V-15, V-16, V-22). De logica staat in `instellingen/beheer.ts`.
type Kanalen =
  | 'instellingen:haal'
  | 'instellingen:bewaar'
  | 'instellingen:kiesLogo'
  | 'instellingen:verwijderLogo'
  | 'instellingen:opmaakVoorbeeld';

/** Bestandsdialoog voor het logo (alleen PNG/JPG); `null` bij annuleren. */
async function kiesLogoPad(): Promise<string | null> {
  const opties: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [{ name: 'Afbeelding', extensions: ['png', 'jpg', 'jpeg'] }],
  };
  const venster = huidigVenster();
  const keuze = venster ? await dialog.showOpenDialog(venster, opties) : await dialog.showOpenDialog(opties);
  return keuze.canceled ? null : (keuze.filePaths[0] ?? null);
}

export const instellingenHandlers: DomeinHandlers<Kanalen> = {
  'instellingen:haal': () => haalInstellingen(),
  'instellingen:bewaar': (invoer) => bewaarInstellingen(invoer),
  'instellingen:kiesLogo': async () => {
    const pad = await kiesLogoPad();
    if (!pad) return { gekozen: false };
    bewaarLogoBestand(pad);
    return { gekozen: true };
  },
  'instellingen:verwijderLogo': () => verwijderLogo(),
  'instellingen:opmaakVoorbeeld': ({ opmaak }) => opmaakVoorbeeldHtml(opmaak),
};
