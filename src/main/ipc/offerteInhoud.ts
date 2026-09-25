import { renderOfferteHtml } from '@shared/pdf-template/render';
import { bewaarHandmatigeInhoud } from '../db/repo/offertesInhoud';
import { pdfModelVoorOfferte } from '../pdf/pdfModel';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-014. Handmatig bewaren en het voorbeeld van het detailscherm (TDO §6.2, §12.5, V-03).
type Kanalen = 'offerte:bewaarInhoud' | 'offerte:voorbeeldHtml';

export const offerteInhoudHandlers: DomeinHandlers<Kanalen> = {
  'offerte:bewaarInhoud': ({ id, inhoud }) => bewaarHandmatigeInhoud(id, inhoud),

  'offerte:voorbeeldHtml': ({ id }) => ({ html: renderOfferteHtml(pdfModelVoorOfferte(id), 'voorbeeld') }),
};
