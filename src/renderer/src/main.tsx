import log from 'electron-log/renderer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
// Inter lokaal uit de bundel, geen extern verzoek (TDO §13.2).
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './styles/app.css';
import { App } from './App';
import { queryClient } from './api/queryClient';

// Onafgevangen fouten in de renderer gaan via de electron-log-preload naar logMap\main.log (§15.3).
log.errorHandler.startCatching({ showDialog: false });

const root = document.getElementById('root');
if (!root) throw new Error('Element #root ontbreekt in index.html.');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
