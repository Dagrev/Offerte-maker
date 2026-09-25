import { app } from 'electron';
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

app.on('will-quit', () => {
  sluitDatabase();
});
