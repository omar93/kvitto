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
    '- Include EVERY product line, even cheap ones like a bag ("Kasse"). Do not skip any.',
    '- For a normal item, "price" is the unit price printed and "quantity" is 1.',
    '- For a line printed as "N st * unitprice" (e.g. "2st*14,90"), set "price" to the',
    '  unit price and "quantity" to N. Do NOT put the line total in "price".',
    '- For a weight item printed as "1,002kg*112,62kr/kg", set "price" to the price per',
    '  kg (112.62) and "quantity" to the weight (1.002).',
    '- "discount" is 0 for almost every item. An indented line under an item showing a',
    '  NEGATIVE amount (e.g. "Rabatt:... -5,00", "Willys Plus:... -22,77") is a discount',
    '  for the item ABOVE it: put that amount as a positive number in that item\'s',
    '  "discount" (the flat amount removed from the whole line). When discount > 0,',
    '  append " -R" to the name, e.g. "Kycklingfilé -R".',
    '- "deposit" is 0 for almost every item. A "+PANT" line (e.g. "+PANT ... 3st*2,00")',
    '  is the pant for the item ABOVE: put the PER-UNIT pant (2.00) in that item\'s',
    '  "deposit". Pant is NOT a discount. NEVER copy the price into deposit or discount,',
    '  and never invent a discount that is not printed. If unsure, use 0.',
    '- Prices use a dot decimal separator. Do not include currency symbols.',
    'Examples:',
    '  plain:       { "name": "Kasse", "price": 10.00, "discount": 0, "quantity": 1, "deposit": 0, "category": "Hem" }',
    '  count:       { "name": "Gurka", "price": 14.90, "discount": 0, "quantity": 2, "deposit": 0, "category": "Mat" }',
    '  with pant:   { "name": "Cola Sockerfri 2L", "price": 13.15, "discount": 0, "quantity": 3, "deposit": 2.00, "category": "Läsk/Snäx" }',
    '  flat sale:   { "name": "Nötfärs -R", "price": 99.90, "discount": 10.00, "quantity": 1, "deposit": 0, "category": "Mat" }',
    '  weight+sale: { "name": "Kycklingfilé -R", "price": 112.62, "discount": 22.77, "quantity": 1.002, "deposit": 0, "category": "Mat" }',
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
