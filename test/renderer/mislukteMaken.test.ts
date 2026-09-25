import { beforeEach, describe, expect, it } from 'vitest';
import {
  isMislukt,
  markeerMislukt,
  toonZonderClaude,
  wisMislukt,
} from '../../src/renderer/src/stores/mislukteMaken';

// OFM-025, V-09: wanneer de knop Maak zonder Claude zichtbaar is.

beforeEach(() => wisMislukt());

describe('toonZonderClaude (V-09)', () => {
  it('gekoppeld of status nog onbekend, zonder mislukte poging: niet zichtbaar', () => {
    expect(toonZonderClaude(null, 'o1')).toBe(false);
    expect(toonZonderClaude({ toestand: 'gekoppeld', versie: '2.1', via: 'account' }, 'o1')).toBe(false);
  });

  it('statusfout: zichtbaar', () => {
    expect(
      toonZonderClaude({ toestand: 'fout', code: 'CLAUDE_NIET_INGELOGD', melding: 'x' } as never, 'o1'),
    ).toBe(true);
  });

  it('mislukte poging in deze sessie: zichtbaar voor die offerte, niet voor een andere', () => {
    markeerMislukt('o1');
    expect(isMislukt('o1')).toBe(true);
    expect(toonZonderClaude({ toestand: 'gekoppeld', versie: '2.1', via: 'account' }, 'o1')).toBe(true);
    expect(toonZonderClaude(null, 'o2')).toBe(false);
  });
});
