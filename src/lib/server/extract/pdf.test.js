import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { extractPdfText } from './pdf.js';

describe('extractPdfText', () => {
  it('reads the text layer from a PDF', async () => {
    const buf = await readFile('test/fixtures/sample.pdf');
    const text = await extractPdfText(buf);
    expect(text).toContain('Willys');
    expect(text).toContain('19,90');
  });
});
