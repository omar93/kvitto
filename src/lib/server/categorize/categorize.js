import { CATEGORIES } from '../../types.js';
import { normalizeItemKey } from '../settings/settings.js';

export function resolveCategory(name, suggested, learned = {}) {
  const key = normalizeItemKey(name);
  if (learned[key] && CATEGORIES.includes(learned[key])) return learned[key];
  if (suggested && CATEGORIES.includes(suggested)) return suggested;
  return null;
}

export function applyCategories(items, learned = {}) {
  return items.map((it) => ({ ...it, category: resolveCategory(it.name, it.category, learned) }));
}

export function recordCorrection(learned, name, category) {
  if (!CATEGORIES.includes(category)) return { ...learned };
  return { ...learned, [normalizeItemKey(name)]: category };
}
