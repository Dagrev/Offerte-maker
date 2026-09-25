import type { Api } from '@shared/types';

// Type van `window.api` (de preload, OFM-004). De renderer importeert nooit `electron`.
declare global {
  interface Window {
    api: Api;
  }
}

export {};
