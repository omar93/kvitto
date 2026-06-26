import { createWorker as defaultCreateWorker } from 'tesseract.js';

/**
 * @param {Buffer} buffer
 * @param {{ lang?: string, createWorker?: Function }} [opts]
 * @returns {Promise<string>}
 */
export async function extractImageText(buffer, opts = {}) {
  const lang = opts.lang || 'swe+eng';
  const createWorker = opts.createWorker || defaultCreateWorker;
  const worker = await createWorker(lang);
  try {
    const { data } = await worker.recognize(buffer);
    return (data.text || '').trim();
  } finally {
    await worker.terminate();
  }
}
