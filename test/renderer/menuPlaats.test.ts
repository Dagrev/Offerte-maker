import { describe, expect, it } from 'vitest';
import { MENU_RAND, plaatsBinnen } from '../../src/renderer/src/componenten/menuPlaats';

const venster = { breedte: 1024, hoogte: 700 };
const maat = { breedte: 300, hoogte: 400 };

describe('plaatsBinnen (OFM-052)', () => {
  it('past het: rechtsonder de positie', () => {
    expect(plaatsBinnen({ x: 100, y: 100 }, maat, venster)).toEqual({ x: 100, y: 100 });
  });

  it('bij de rechter- en onderrand gespiegeld naar links en boven', () => {
    expect(plaatsBinnen({ x: 900, y: 600 }, maat, venster)).toEqual({ x: 600, y: 200 });
  });

  it('past ook gespiegeld niet: tegen de rand, nooit buiten het venster', () => {
    expect(plaatsBinnen({ x: 200, y: 300 }, { breedte: 300, hoogte: 690 }, venster)).toEqual({
      x: 200,
      y: MENU_RAND,
    });
    expect(plaatsBinnen({ x: 1000, y: 10 }, { breedte: 1020, hoogte: 100 }, venster)).toEqual({
      x: MENU_RAND,
      y: 10,
    });
  });
});
