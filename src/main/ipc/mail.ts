import { mailOfferte } from '../mail/versturen';
import type { DomeinHandlers } from './registreer';

// Eigenaar: OFM-041. Verstuur per e-mail: concept in het mailprogramma, de app verstuurt niets.
export const mailHandlers: DomeinHandlers<'offerte:mail'> = {
  'offerte:mail': ({ id }) => mailOfferte(id),
};
