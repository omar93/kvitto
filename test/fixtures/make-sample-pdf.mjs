// Regenerates test/fixtures/sample.pdf — a tiny, standards-clean PDF with a text
// layer, used by the PDF extraction test. Run: node test/fixtures/make-sample-pdf.mjs
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const page = doc.addPage([595, 842]);
const lines = [
  'Willys - Port73',
  'Mjolk 0,5%        19,90',
  'Banan             24,18',
  'Totalt            44,08',
  '2026-04-24'
];
lines.forEach((line, i) => {
  page.drawText(line, { x: 40, y: 780 - i * 24, size: 16, font });
});

// useObjectStreams:false keeps a classic xref table that pdf-parse's bundled
// (older) pdf.js can read.
const bytes = await doc.save({ useObjectStreams: false });
await writeFile(join(here, 'sample.pdf'), bytes);
console.log('wrote test/fixtures/sample.pdf');
