import { CATEGORIES } from '../../types.js';
import { normalizeItemKey } from '../settings/settings.js';

export function resolveCategory(name, suggested, learned = {}, categories = CATEGORIES) {
  const key = normalizeItemKey(name);
  if (learned[key] && categories.includes(learned[key])) return learned[key];
  if (suggested && categories.includes(suggested)) return suggested;
  return null;
}

export function applyCategories(items, learned = {}, categories = CATEGORIES) {
  return items.map((it) => ({ ...it, category: resolveCategory(it.name, it.category, learned, categories) }));
}

export function recordCorrection(learned, name, category, categories = CATEGORIES) {
  if (!categories.includes(category)) return { ...learned };
  return { ...learned, [normalizeItemKey(name)]: category };
}
