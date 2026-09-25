import log from 'electron-log/renderer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Onafgevangen fouten in de renderer gaan via de electron-log-preload naar logMap\main.log (§15.3).
log.errorHandler.startCatching({ showDialog: false });

// Lege React-root (OFM-001). OFM-008 voegt App.tsx, stijl en navigatie toe.
const root = document.getElementById('root');
if (!root) throw new Error('Element #root ontbreekt in index.html.');

createRoot(root).render(<StrictMode>{null}</StrictMode>);
