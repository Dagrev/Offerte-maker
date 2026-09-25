import { app } from 'electron';
import { stopAlleTaken } from './agent/taken';
import { sluitDatabase } from './db/verbinding';
import { log } from './log';
import { opstart } from './opstart';

// App-lifecycle. De opstartvolgorde staat in opstart.ts (TDO §14.1).
opstart().catch((fout: unknown) => {
  log.error('opstart mislukt', fout);
  app.exit(1);
});

app.on('window-all-closed', () => {
  app.quit();
});

// Lopende agenttaken afbreken, zodat er geen Claude-subproces achterblijft (OFM-013/014).
app.on('before-quit', stopAlleTaken);

app.on('will-quit', () => {
  sluitDatabase();
});
