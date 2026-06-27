import { CATEGORIES } from '../../types.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @returns {number|null} */
export function coercePrice(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  // strip currency + spaces (incl. nbsp), use ',' as decimal if present
  let s = v.replace(/kr/gi, '').replace(/[\s ]/g, '').trim();
  if (s === '') return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normCategory(c, categories) {
  return categories.includes(c) ? c : null;
}

/** Coerce a quantity to a positive number (fractional allowed for weight); null if unreadable. */
export function coerceQty(v) {
  const n = coercePrice(v);
  if (n === null) return null;
  return n > 0 ? n : null;
}

/** Total contributed by one item: (price - discount) * qty + deposit. */
export function lineTotal(it) {
  return (it.price - it.discount) * it.quantity + it.deposit;
}

/** Strip a leading formula trigger (= + @) so Sheets treats the name as text. */
export function cleanName(s) {
  return String(s ?? '').replace(/^\s*[=+@]+\s*/, '').trim();
}

/**
 * @param {unknown} obj
 * @returns {{ok: true, value: import('../../types.js').ReceiptData} | {ok: false, errors: string[]}}
 */
export function validateReceipt(obj, categories = CATEGORIES) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['not an object'] };
  const o = /** @type {any} */ (obj);

  if (typeof o.store !== 'string' || o.store.trim() === '') errors.push('store missing');
  if (typeof o.date !== 'string' || !DATE_RE.test(o.date)) errors.push('date must be YYYY-MM-DD');
  if (!Array.isArray(o.items) || o.items.length === 0) errors.push('items must be a non-empty array');

  const items = [];
  if (Array.isArray(o.items)) {
    o.items.forEach((it, i) => {
      const price = coercePrice(it?.price);
      if (typeof it?.name !== 'string' || it.name.trim() === '') errors.push(`item ${i}: name missing`);
      if (price === null) errors.push(`item ${i}: price invalid`);
      const deposit = coercePrice(it?.deposit) ?? 0;
      const discount = coercePrice(it?.discount) ?? 0;
      const quantity = coerceQty(it?.quantity) ?? 1;
      items.push({
        name: cleanName(it?.name),
        price: price ?? 0,
        discount,
        quantity,
        deposit,
        category: normCategory(it?.category, categories)
      });
    });
  }

  if (errors.length) return { ok: false, errors };

  const total = coercePrice(o.total);
  return {
    ok: true,
    value: {
      store: cleanName(o.store),
      date: o.date,
      total: total ?? items.reduce((s, it) => s + lineTotal(it), 0),
      items
    }
  };
}
