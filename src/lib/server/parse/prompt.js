import { CATEGORIES } from '../../types.js';

export function buildPrompt(rawText, categories = CATEGORIES) {
  return [
    'You extract structured data from a Swedish grocery store receipt.',
    'Return ONLY a JSON object with this exact shape:',
    '{',
    '  "store": string,            // store name, e.g. "Willys - Port73"',
    '  "date": "YYYY-MM-DD",       // purchase date',
    '  "total": number,            // total amount',
    '  "items": [ { "name": string, "price": number, "deposit": number, "category": string } ]',
    '}',
    `Each item "category" MUST be exactly one of: ${categories.map((c) => `"${c}"`).join(', ')}.`,
    'Pick the closest fit for a grocery item (food, drinks/snacks, hygiene, household).',
    '',
    'RULES (follow exactly):',
    '- "price" is the amount printed for that line, copied EXACTLY. Do not multiply',
    '  by quantity, do not add other numbers, do not invent digits.',
    '- "deposit" is 0 for almost every item. Set it ONLY when the receipt has an',
    '  explicit "pant" line with its own amount; then put that amount in the deposit',
    '  of the item it belongs to. NEVER copy the price into deposit. If unsure, use 0.',
    '- One printed product line = one item. The customer bought quantity 1 unless a',
    '  quantity is clearly printed.',
    '- Prices use a dot decimal separator. Do not include currency symbols.',
    'Examples:',
    '  no deposit:  { "name": "Banan", "price": 24.18, "deposit": 0, "category": "Mat" }',
    '  with pant:   { "name": "Cola", "price": 13.00, "deposit": 2.00, "category": "Läsk/Snäx" }',
    'Output JSON only, no prose.',
    '',
    'RECEIPT TEXT:',
    rawText
  ].join('\n');
}
