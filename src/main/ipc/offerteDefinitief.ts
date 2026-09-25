import { drukAf, openPdf, toonInMap } from '../pdf/afdrukken';
import { maakDefinitief } from '../pdf/definitief';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-015. Definitief maken, PDF openen, afdrukken en tonen in de map (TDO §12.3, §12.4, V-01).
type Kanalen = 'offerte:maakDefinitief' | 'offerte:openPdf' | 'offerte:afdrukken' | 'offerte:toonInMap';

export const offerteDefinitiefHandlers: DomeinHandlers<Kanalen> = {
  'offerte:maakDefinitief': ({ id }) => maakDefinitief(id),
  'offerte:openPdf': ({ id }) => openPdf(id),
  'offerte:afdrukken': ({ id }) => drukAf(id),
  'offerte:toonInMap': ({ id }) => toonInMap(id),
};
