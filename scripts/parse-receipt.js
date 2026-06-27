// Parse one receipt file with the deterministic parser and print the result.
// Usage:
//   node scripts/parse-receipt.js fixtures/receipts/<name>.txt
//   node scripts/parse-receipt.js fixtures/receipts/<name>.pdf -- --write
// With --write it also saves <name>.expected.json next to the receipt as a
// starting point for the fixture test (edit it to the result you actually want).
import { readFile, writeFile } from 'node:fs/promises';
import { parseReceiptText } from '../src/lib/server/parse/parse-text.js';
import { extractPdfText } from '../src/lib/server/extract/pdf.js';
import { itemPriceCell } from '../src/lib/server/sheets/writer.js';

const file = process.argv[2];
const write = process.argv.includes('--write');

if (!file || file.startsWith('--')) {
  console.error('Usage: node scripts/parse-receipt.js <receiptFile.(txt|pdf)> [--write]');
  process.exit(1);
}

const text = /\.pdf$/i.test(file) ? await extractPdfText(await readFile(file)) : await readFile(file, 'utf8');
const parsed = parseReceiptText(text);

if (!parsed) {
  console.error('parseReceiptText returned null — not a recognised self-scan receipt');
  console.error('(needs the "Start/Slut Självscanning" markers and >= 2 item lines)');
  process.exit(1);
}

console.log(JSON.stringify(parsed, null, 2));
console.log('\nK-cells:');
for (const it of parsed.items) console.log(`  ${String(itemPriceCell(it)).padEnd(28)} ${it.name}`);

if (write) {
  const out = file.replace(/\.(txt|pdf)$/i, '.expected.json');
  await writeFile(out, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
  console.log(`\nwrote ${out} — edit it to the result you want, then run: npm test`);
}
