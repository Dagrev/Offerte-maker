import { dialog } from 'electron';
import { bewaarApiSleutel } from '../agent/apiSleutel';
import { bepaalClaudeStatus } from '../agent/claudeStatus';
import { loginClaude, testClaude } from '../agent/koppeling';
import { huidigVenster } from '../venster';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-012 (bewaarApiSleutel en kiesPad: OFM-020). Vervang een stub door de echte handler; de kanalen zelf staan vast (V-03).
type Kanalen =
  'claude:status' | 'claude:login' | 'claude:test' | 'claude:bewaarApiSleutel' | 'claude:kiesPad';

/** Bestandsdialoog voor claude.exe (V-27); `null` bij annuleren of een ander bestand dan een `.exe`. */
async function kiesClaudePad(): Promise<string | null> {
  const opties: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [{ name: 'claude.exe', extensions: ['exe'] }],
  };
  const venster = huidigVenster();
  const keuze = venster ? await dialog.showOpenDialog(venster, opties) : await dialog.showOpenDialog(opties);
  const pad = keuze.canceled ? null : (keuze.filePaths[0] ?? null);
  return pad && /\.exe$/i.test(pad) ? pad : null;
}

export const claudeHandlers: DomeinHandlers<Kanalen> = {
  'claude:status': () => bepaalClaudeStatus(),
  'claude:login': () => loginClaude(),
  'claude:test': () => testClaude(),
  'claude:bewaarApiSleutel': ({ sleutel }) => {
    bewaarApiSleutel(sleutel);
    return null;
  },
  'claude:kiesPad': async () => ({ pad: await kiesClaudePad() }),
};
