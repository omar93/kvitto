import { buildPrompt } from './prompt.js';
import { validateReceipt } from './schema.js';

export { buildPrompt };

async function callOllama(rawText, { host, model, categories, fetchImpl }) {
  const res = await fetchImpl(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt: buildPrompt(rawText, categories), stream: false, format: 'json' })
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data.response;
}

/**
 * @param {string} rawText
 * @param {{ host: string, model: string, fetchImpl?: Function }} opts
 * @returns {Promise<import('../../types.js').ReceiptData>}
 */
export async function parseReceipt(rawText, opts) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  let lastErrors = ['no attempts'];
  for (let attempt = 0; attempt < 2; attempt++) {
    const responseText = await callOllama(rawText, { ...opts, fetchImpl });
    let obj;
    try {
      obj = JSON.parse(responseText);
    } catch {
      lastErrors = ['response was not valid JSON'];
      continue;
    }
    const result = validateReceipt(obj, opts.categories);
    if (result.ok) return result.value;
    lastErrors = result.errors;
  }
  throw new Error(`Could not parse receipt after 2 attempts: ${lastErrors.join('; ')}`);
}
