import { extractPdfText } from './pdf.js';
import { extractImageText } from './ocr.js';

const MIN_PDF_TEXT = 20;

function isPdf(input) {
  if (input.mimetype) return input.mimetype === 'application/pdf';
  if (input.filename) return /\.pdf$/i.test(input.filename);
  return false;
}

/**
 * @param {{ buffer: Buffer, filename?: string, mimetype?: string }} input
 * @param {{ pdf?: Function, image?: Function }} [deps]
 * @returns {Promise<{ text: string, source: 'pdf'|'ocr' }>}
 */
export async function extractText(input, deps = {}) {
  const pdf = deps.pdf || extractPdfText;
  const image = deps.image || extractImageText;

  if (isPdf(input)) {
    const text = (await pdf(input.buffer)) || '';
    if (text.replace(/\s/g, '').length < MIN_PDF_TEXT) {
      throw new Error('PDF has no usable text layer (image-only PDF needs OCR, not supported yet)');
    }
    return { text, source: 'pdf' };
  }

  const text = (await image(input.buffer)) || '';
  return { text, source: 'ocr' };
}
