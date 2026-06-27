import { CATEGORIES } from '../../types.js';

// Shared extraction rules, used by both the text prompt and the vision prompt.
function instructions(categories) {
  return [
    'Return ONLY a JSON object with this exact shape:',
    '{',
    '  "store": string,            // store name, e.g. "Willys - Port73"',
    '  "date": "YYYY-MM-DD",       // purchase date',
    '  "total": number,            // total amount',
    '  "items": [ { "name": string, "price": number, "discount": number, "quantity": number, "deposit": number, "category": string } ]',
    '}',
    `Each item "category" MUST be exactly one of: ${categories.map((c) => `"${c}"`).join(', ')}.`,
    'Pick the closest fit for a grocery item (food, drinks/snacks, hygiene, household).',
    '',
    'RULES (follow exactly):',
    '- "price" is the ORDINARY unit price (before any discount), copied EXACTLY.',
    '  Do not multiply by quantity, do not subtract the discount, do not invent digits.',
    '- "quantity" is the number of units bought. Use 1 unless a count is clearly',
    '  printed (e.g. "4 st", "x4", "2 @ 15.00").',
    '- "discount" is 0 for almost every item. Set it ONLY when the receipt shows a',
    '  sale/campaign reduction (e.g. "Rabatt", "Prisnedsättning", "Extrapris",',
    '  "Kampanj") for that line; put the PER-UNIT amount removed as a positive number.',
    '  When discount > 0, append a short marker to the name, e.g. "Kycklingfilé -R".',
    '- "deposit" is 0 for almost every item. Set it ONLY when the receipt has an',
    '  explicit "pant" line with its own amount; then put the PER-UNIT pant in deposit.',
    '  NEVER copy the price into deposit or discount. If unsure, use 0.',
    '- One printed product line = one item.',
    '- Prices use a dot decimal separator. Do not include currency symbols.',
    'Examples:',
    '  plain:       { "name": "Banan", "price": 24.18, "discount": 0, "quantity": 1, "deposit": 0, "category": "Mat" }',
    '  with pant:   { "name": "Cola", "price": 13.00, "discount": 0, "quantity": 1, "deposit": 2.00, "category": "Läsk/Snäx" }',
    '  on sale:     { "name": "Kycklingfilé -R", "price": 100, "discount": 20, "quantity": 1, "deposit": 0, "category": "Mat" }',
    '  sale + pant: { "name": "Läsk -R", "price": 15, "discount": 2, "quantity": 4, "deposit": 2, "category": "Läsk/Snäx" }',
    'Output JSON only, no prose.'
  ];
}

export function buildPrompt(rawText, categories = CATEGORIES) {
  return [
    'You extract structured data from a Swedish grocery store receipt.',
    ...instructions(categories),
    '',
    'RECEIPT TEXT:',
    rawText
  ].join('\n');
}

export function buildVisionPrompt(categories = CATEGORIES) {
  return [
    'You read a photo or screenshot of a Swedish grocery store receipt and extract its data.',
    ...instructions(categories),
    '',
    'Read every product line from the image carefully, column by column.'
  ].join('\n');
}
