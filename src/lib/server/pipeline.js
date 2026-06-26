import { extractText } from './extract/extract.js';
import { parseReceipt } from './parse/parse.js';
import { applyCategories } from './categorize/categorize.js';

/**
 * @param {{buffer:Buffer,filename?:string,mimetype?:string}} item
 * @param {{ settings: any, deps?: any }} ctx
 */
export async function processReceipt(item, { settings, deps = {} }) {
  const extract = deps.extractText || extractText;
  const parse = deps.parseReceipt || parseReceipt;
  const apply = deps.applyCategories || applyCategories;
  try {
    const { text, source } = await extract({
      buffer: item.buffer, filename: item.filename, mimetype: item.mimetype
    });
    const parsed = await parse(text, { host: settings.ollama.host, model: settings.ollama.model });
    const receipt = { ...parsed, items: apply(parsed.items, settings.learnedCategories) };
    return { status: 'ready', text, receipt, source, error: null };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}
