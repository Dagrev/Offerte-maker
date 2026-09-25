// Lay-out Modern (TDO §12.2): volle balk in de accentkleur met logo en bedrijfsnaam in wit;
// sectiekoppen met een accentkleurig blokje ervoor; tabel zonder verticale lijnen, kop in de
// accentkleur met witte tekst. De balk loopt over de volle breedte van het tekstvlak: de PDF-marges
// komen uit printToPDF, en het voorbeeld moet gelijk blijven aan de PDF (FE-050).
export const modernCss = `
.kop { align-items: center; background: var(--accent); color: #FFFFFF; padding: 10pt 12pt; margin-bottom: 18pt; }
.kop .logo { background: #FFFFFF; padding: 3pt; border-radius: 3pt; max-height: 18mm; }
.kop .gegevens { font-size: 8.5pt; }
.kop .gegevens span { display: inline; }
.kop .gegevens span + span::before { content: ' · '; }
h2::before { content: ''; display: inline-block; width: 7pt; height: 7pt; margin: 0 6pt 1pt 0;
  background: var(--accent); vertical-align: middle; }
.prijstabel thead th { background: var(--accent); color: #FFFFFF; }
.prijstabel td { border-bottom: 0.5pt solid #D0D4DA; }
`;
