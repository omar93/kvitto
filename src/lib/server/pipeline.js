import { extractPdfText } from './extract/pdf.js';
import { parseReceipt } from './parse/parse.js';
import { parseReceiptFromImage } from './parse/vision.js';
import { applyCategories } from './categorize/categorize.js';
import { CATEGORIES } from '../types.js';

const MIN_PDF_TEXT = 20;

function isPdf(item) {
  if (item.mimetype) return item.mimetype === 'application/pdf';
  if (item.filename) return /\.pdf$/i.test(item.filename);
  return false;
}

/**
 * PDFs use the text layer + a text LLM; images go straight to a vision model.
 * @param {{buffer:Buffer,filename?:string,mimetype?:string}} item
 * @param {{ settings: any, categories?: string[], deps?: any }} ctx
 */
export async function processReceipt(item, { settings, categories = CATEGORIES, deps = {} }) {
  const extractPdf = deps.extractPdfText || extractPdfText;
  const parseText = deps.parseReceipt || parseReceipt;
  const parseImage = deps.parseReceiptFromImage || parseReceiptFromImage;
  const apply = deps.applyCategories || applyCategories;
  const { host, model, visionModel } = settings.ollama;

  try {
    let parsed;
    let text;
    let source;

    if (isPdf(item)) {
      text = await extractPdf(item.buffer);
      if (text.replace(/\s/g, '').length < MIN_PDF_TEXT) {
        throw new Error('PDF has no usable text layer (image-only PDF needs a screenshot instead)');
      }
      parsed = await parseText(text, { host, model, categories });
      source = 'pdf';
    } else {
      parsed = await parseImage(item.buffer, { host, model: visionModel, categories });
      source = 'vision';
    }

    const receipt = { ...parsed, items: apply(parsed.items, settings.learnedCategories, categories) };
    return { status: 'ready', text, receipt, source, error: null };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}
