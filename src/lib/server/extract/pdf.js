import { extractText, getDocumentProxy } from 'unpdf';

// unpdf bundles a modern, maintained pdf.js build that works on current Node.
// (pdf-parse's vendored 2018-era pdf.js fails with "bad XRef entry" on Node 22.)

/**
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<string>}
 */
export async function extractPdfText(buffer) {
  // pdf.js rejects Node Buffers specifically, even though Buffer extends
  // Uint8Array — convert to a plain Uint8Array.
  const bytes = Buffer.isBuffer(buffer) ? new Uint8Array(buffer) : buffer;
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (typeof text === 'string' ? text : text.join('\n')).trim();
}
