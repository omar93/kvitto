import { buildVisionPrompt } from './prompt.js';
import { validateReceipt } from './schema.js';
import { ollamaError } from './ollama-error.js';

/**
 * Parse a receipt image directly with a local Ollama vision model (no OCR step).
 * @param {Buffer|Uint8Array} buffer
 * @param {{ host: string, model: string, categories?: string[], fetchImpl?: Function }} opts
 * @returns {Promise<import('../../types.js').ReceiptData>}
 */
export async function parseReceiptFromImage(buffer, opts) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const base64 = Buffer.from(buffer).toString('base64');
  let lastErrors = ['no attempts'];

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetchImpl(`${opts.host}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        prompt: buildVisionPrompt(opts.categories),
        images: [base64],
        stream: false,
        format: 'json'
      })
    });
    if (!res.ok) throw new Error(await ollamaError(res));
    const data = await res.json();
    let obj;
    try {
      obj = JSON.parse(data.response);
    } catch {
      lastErrors = ['response was not valid JSON'];
      continue;
    }
    const result = validateReceipt(obj, opts.categories);
    if (result.ok) return result.value;
    lastErrors = result.errors;
  }
  throw new Error(`Could not parse receipt image after 2 attempts: ${lastErrors.join('; ')}`);
}
