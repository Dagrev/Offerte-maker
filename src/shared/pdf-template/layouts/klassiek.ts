// Lay-out Klassiek (TDO §12.2): logo links, bedrijfsgegevens rechts uitgelijnd, dunne lijn in de
// accentkleur onder de kop; titels in de accentkleur; tabel met grijze rasterlijnen en een grijze kop.
export const klassiekCss = `
.kop { justify-content: space-between; align-items: flex-start; padding-bottom: 8pt; margin-bottom: 18pt;
  border-bottom: 1.25pt solid var(--accent); }
.kop .bedrijf { margin-left: auto; text-align: right; }
.kop .gegevens { font-size: 9pt; color: #444444; }
h1, h2 { color: var(--accent); }
.prijstabel th, .prijstabel td { border: 0.5pt solid #BDBDBD; }
.prijstabel thead th { background: #EEEEEE; }
`;
