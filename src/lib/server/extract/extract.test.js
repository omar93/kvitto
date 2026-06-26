import { describe, it, expect, vi } from 'vitest';
import { extractText } from './extract.js';

const deps = (pdfText, imgText) => ({
  pdf: vi.fn().mockResolvedValue(pdfText),
  image: vi.fn().mockResolvedValue(imgText)
});

describe('extractText', () => {
  it('uses pdf extractor for application/pdf', async () => {
    const d = deps('Willys Mjolk 19,90 kr total 241,86', 'X');
    const r = await extractText({ buffer: Buffer.from('x'), mimetype: 'application/pdf' }, d);
    expect(r).toEqual({ text: 'Willys Mjolk 19,90 kr total 241,86', source: 'pdf' });
    expect(d.image).not.toHaveBeenCalled();
  });

  it('routes by .pdf extension when mimetype is absent', async () => {
    const d = deps('Some sufficiently long receipt text here', 'X');
    const r = await extractText({ buffer: Buffer.from('x'), filename: 'kvitto.pdf' }, d);
    expect(r.source).toBe('pdf');
  });

  it('throws for a PDF with no usable text layer', async () => {
    const d = deps('   ', 'X');
    await expect(extractText({ buffer: Buffer.from('x'), mimetype: 'application/pdf' }, d))
      .rejects.toThrow(/no usable text layer/i);
  });

  it('uses OCR for images', async () => {
    const d = deps('X', 'Maxi Banan 24,18');
    const r = await extractText({ buffer: Buffer.from('x'), mimetype: 'image/png' }, d);
    expect(r).toEqual({ text: 'Maxi Banan 24,18', source: 'ocr' });
    expect(d.pdf).not.toHaveBeenCalled();
  });
});
