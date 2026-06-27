import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseReceiptText } from './parse-text.js';
import { extractPdfText } from '../extract/pdf.js';

// Data-driven: every receipt in fixtures/receipts/ that has a matching
// <name>.expected.json is parsed and asserted against it. Drop a receipt + its
// expected result and the parser is locked to it. Files without an expected.json
// are skipped, so you can drop one first and fill in the result afterwards.
const DIR = resolve(process.cwd(), 'fixtures/receipts');

const receipts = existsSync(DIR) ? readdirSync(DIR).filter((f) => /\.(txt|pdf)$/i.test(f)) : [];

async function textFor(file) {
  const full = join(DIR, file);
  return /\.pdf$/i.test(file) ? extractPdfText(readFileSync(full)) : readFileSync(full, 'utf8');
}

describe('receipt fixtures', () => {
  if (!receipts.length) {
    it.skip('no fixtures in fixtures/receipts yet', () => {});
    return;
  }

  for (const file of receipts) {
    const expectedPath = join(DIR, file.replace(/\.(txt|pdf)$/i, '.expected.json'));
    const run = existsSync(expectedPath) ? it : it.skip;
    run(`parses ${file} to its expected result`, async () => {
      const parsed = parseReceiptText(await textFor(file));
      const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
      expect(parsed).toEqual(expected);
    });
  }
});
