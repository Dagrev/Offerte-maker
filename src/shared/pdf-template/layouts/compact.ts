// Lay-out Compact (TDO §12.2): logo en gegevens klein op één regel; adresblok en offertegegevens
// naast elkaar; accentkleur alleen in de totaalregel (die staat in de basis-CSS); tabel in 9 pt met
// zebrastrepen.
export const compactCss = `
.kop { align-items: center; gap: 8pt; font-size: 8.5pt; padding-bottom: 5pt; margin-bottom: 12pt;
  border-bottom: 0.5pt solid #BDBDBD; }
.kop .logo { max-height: 11mm; max-width: 40mm; }
.kop .bedrijf { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 8pt; }
.kop .bedrijfsnaam { font-size: 10pt; }
.kop .gegevens span { display: inline; }
.kop .gegevens span + span::before { content: ' · '; }
.adres { justify-content: flex-start; gap: 40pt; }
section { margin-bottom: 10pt; }
h1 { font-size: 13pt; }
h2 { font-size: 10.5pt; margin-bottom: 4pt; }
.prijstabel { font-size: 9pt; }
.prijstabel thead th { border-bottom: 0.75pt solid #1A1A1A; }
.prijstabel tbody tr:nth-child(even) { background: #F2F3F5; }
.prijstabel th, .prijstabel td { padding: 2pt 5pt; }
`;
