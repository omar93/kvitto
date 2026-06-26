import { CATEGORIES } from '../../types.js';

export function buildPrompt(rawText) {
  return [
    'You extract structured data from a Swedish grocery store receipt.',
    'Return ONLY a JSON object with this exact shape:',
    '{',
    '  "store": string,            // store name, e.g. "Willys - Port73"',
    '  "date": "YYYY-MM-DD",       // purchase date',
    '  "total": number,            // total amount',
    '  "items": [ { "name": string, "price": number, "category": string } ]',
    '}',
    `Each item "category" MUST be exactly one of: ${CATEGORIES.map((c) => `"${c}"`).join(', ')}.`,
    'Use "Mat" for normal groceries, "Läsk/Snäx" for soda/snacks/candy,',
    '"Vård" for hygiene/health, "Hem" for household goods.',
    'Prices use a dot decimal separator. Do not include currency symbols.',
    'Exclude deposit/pant lines unless attached to an item. Output JSON only, no prose.',
    '',
    'RECEIPT TEXT:',
    rawText
  ].join('\n');
}
