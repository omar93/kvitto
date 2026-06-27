/**
 * @typedef {Object} ReceiptItem
 * @property {string} name
 * @property {number} price          // unit price (or price per kg for weight items), excluding deposit
 * @property {number} discount       // flat amount removed from the whole line (0 if none)
 * @property {number} quantity       // units bought, or weight in kg for weight items (1 if not printed)
 * @property {number} deposit        // pant per unit (0 if none)
 * @property {string|null} category  // one of CATEGORIES, or null if unknown
 */

/**
 * @typedef {Object} ReceiptData
 * @property {string} store          // e.g. "Willys - Port73"
 * @property {string} date           // "YYYY-MM-DD"
 * @property {number} total          // store total
 * @property {ReceiptItem[]} items
 */

/** Exact category strings used in the sheet's dropdown. */
export const CATEGORIES = ['Mat', 'Läsk/Snäx', 'Vård', 'Hem'];
