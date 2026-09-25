import { dialog } from 'electron';
import { nietBeschikbaar } from '@shared/fouten';
import { huidigVenster } from '../venster';
import {
  haalVoorbeeld,
  keurGoed,
  lijstVoorbeelden,
  maakOnleesbaar,
  verwijderVoorbeeld,
  voegVoorbeeldenToe,
  zetTemplate,
} from '../voorbeelden/beheer';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-019 (tekstenUitTemplate: OFM-024). De logica staat in `voorbeelden/beheer.ts` (V-03).
type Kanalen =
  | 'voorbeelden:lijst'
  | 'voorbeelden:voegToe'
  | 'voorbeelden:haal'
  | 'voorbeelden:maakOnleesbaar'
  | 'voorbeelden:keurGoed'
  | 'voorbeelden:zetTemplate'
  | 'voorbeelden:verwijder'
  | 'voorbeelden:tekstenUitTemplate';

/** Bestandsdialoog voor voorbeeldoffertes (`.pdf`, `.docx`, meerdere tegelijk); leeg bij annuleren. */
export async function kiesVoorbeeldPaden(): Promise<string[]> {
  const opties: Electron.OpenDialogOptions = {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF of Word', extensions: ['pdf', 'docx'] }],
  };
  const venster = huidigVenster();
  const keuze = venster ? await dialog.showOpenDialog(venster, opties) : await dialog.showOpenDialog(opties);
  return keuze.canceled ? [] : keuze.filePaths;
}

export const voorbeeldenHandlers: DomeinHandlers<Kanalen> = {
  'voorbeelden:lijst': () => lijstVoorbeelden(),
  'voorbeelden:voegToe': async ({ paden }) =>
    voegVoorbeeldenToe(paden && paden.length > 0 ? paden : await kiesVoorbeeldPaden()),
  'voorbeelden:haal': ({ id }) => haalVoorbeeld(id),
  'voorbeelden:maakOnleesbaar': ({ id, fragment }) => maakOnleesbaar(id, fragment),
  'voorbeelden:keurGoed': ({ id }) => keurGoed(id),
  'voorbeelden:zetTemplate': ({ id }) => zetTemplate(id),
  'voorbeelden:verwijder': ({ id }) => verwijderVoorbeeld(id),
  'voorbeelden:tekstenUitTemplate': nietBeschikbaar,
};
