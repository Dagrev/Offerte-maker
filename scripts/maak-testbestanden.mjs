// Maakt de testbestanden voor de tekstextractie (TDO V-27, OFM-007) in test/fixtures/voorbeelden/:
// offerte.pdf, offerte.docx, foto.jpg, scan.pdf (alleen een afbeelding) en kapot.pdf. De bestanden
// worden gecommit; draai dit script alleen opnieuw als ze moeten veranderen:
//   pnpm exec electron scripts/maak-testbestanden.mjs
// Alle namen, adressen en nummers zijn verzonnen.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BrowserWindow, app, nativeImage } from 'electron';
import { Document, Packer, Paragraph } from 'docx';

const doel = resolve(import.meta.dirname, '..', 'test', 'fixtures', 'voorbeelden');

/** Tekst van de voorbeeldofferte, regel voor regel. */
const OFFERTE = [
  'Dakdekkersbedrijf Voorbeeld',
  'Industrieweg 10',
  '5555 AA Eindhoven',
  '',
  'Dhr. P. Bakker',
  'Kerkstraat 5',
  '1234 AB Utrecht',
  '',
  'Offerte 2023-014',
  'Geachte heer Bakker,',
  'Hierbij ontvangt u onze offerte voor het vervangen van de dakbedekking van uw platte dak.',
  'Werkzaamheden: oude bitumen verwijderen, nieuwe EPDM 1,1 mm aanbrengen, daktrim vervangen.',
  'Neem contact op via 06-98765432 of p.bakker@example.nl.',
  'Met vriendelijke groet,',
  'Dakdekkersbedrijf Voorbeeld',
];

function html(inhoud) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(
    `<!doctype html><html><body style="font-family: Arial, sans-serif; font-size: 12pt">${inhoud}</body></html>`,
  )}`;
}

async function pdfVan(venster, inhoud) {
  await venster.loadURL(html(inhoud));
  return venster.webContents.printToPDF({ pageSize: 'A4' });
}

/** Deterministische "willekeurige" bytes (lineaire congruentie), zodat het bestand stabiel blijft. */
function ruis(lengte, zaad) {
  const bytes = Buffer.alloc(lengte);
  let x = zaad;
  for (let i = 0; i < lengte; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    bytes[i] = x & 0xff;
  }
  return bytes;
}

/** BGRA-pixels van een eenvoudig huis: blauwe lucht, bruin dak, gele gevel. */
function tekening(breedte, hoogte) {
  const pixels = Buffer.alloc(breedte * hoogte * 4);
  for (let y = 0; y < hoogte; y++) {
    for (let x = 0; x < breedte; x++) {
      const dak = y >= 60 && y < 170 && Math.abs(x - 200) <= ((y - 60) * 140) / 110;
      const gevel = y >= 170 && x >= 90 && x < 310;
      const [r, g, b] = dak ? [141, 85, 36] : gevel ? [233, 196, 106] : [189, 224, 254];
      const i = (y * breedte + x) * 4;
      pixels[i] = b;
      pixels[i + 1] = g;
      pixels[i + 2] = r;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

async function maak() {
  mkdirSync(doel, { recursive: true });
  const venster = new BrowserWindow({ show: false, width: 400, height: 300 });

  // offerte.pdf: echte tekstlaag
  const tekst = OFFERTE.map((r) => (r === '' ? '<br>' : `<div>${r}</div>`)).join('');
  writeFileSync(join(doel, 'offerte.pdf'), await pdfVan(venster, tekst));

  // foto.jpg: een getekend dak (lucht, dak, gevel), pixel voor pixel via nativeImage
  const beeld = nativeImage.createFromBitmap(tekening(400, 300), { width: 400, height: 300 });
  writeFileSync(join(doel, 'foto.jpg'), beeld.toJPEG(80));

  // scan.pdf: alleen een afbeelding, geen tekstlaag
  const dataUrl = `data:image/jpeg;base64,${beeld.toJPEG(80).toString('base64')}`;
  writeFileSync(join(doel, 'scan.pdf'), await pdfVan(venster, `<img src="${dataUrl}" width="400">`));

  // kapot.pdf: willekeurige bytes
  writeFileSync(join(doel, 'kapot.pdf'), ruis(4096, 42));

  // offerte.docx
  const document = new Document({
    creator: 'Offerte maker (testbestand)',
    sections: [{ children: OFFERTE.map((r) => new Paragraph(r)) }],
  });
  writeFileSync(join(doel, 'offerte.docx'), await Packer.toBuffer(document));

  console.log(`Testbestanden geschreven naar ${doel}`);
}

app.whenReady().then(async () => {
  try {
    await maak();
  } catch (fout) {
    console.error(fout);
    process.exitCode = 1;
  }
  app.quit();
});
