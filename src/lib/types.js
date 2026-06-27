/**
 * @typedef {Object} ReceiptItem
 * @property {string} name
 * @property {number} price          // item price excluding deposit
 * @property {number} deposit        // pant for this item (0 if none)
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
