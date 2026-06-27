import { coercePrice } from './schema.js';

// Deterministic parser for the structured Swedish self-scan receipt format
// (Willys/ICA "Självscanning"). It reads the columns exactly instead of asking
// an LLM to do arithmetic, so prices, quantities, weights, discounts and pant
// come out right. Returns the same shape as the LLM parser, or null if the text
// is not a recognised self-scan receipt (caller then falls back to the LLM).

// A money amount at the end of a line (Swedish "13,90" / "-22,77" or dot form).
const AMOUNT_RE = /(-?\d[\d\s.]*,\d{2}|-?\d[\d\s.]*\.\d{2})\s*$/;
// "2st*14,90", "3 st * 13,15"
const COUNT_RE = /(\d+)\s*st\s*\*\s*(-?[\d\s.,]+?)(?=\s|$)/i;
// "1,002kg*112,62kr/kg"
const WEIGHT_RE = /([\d.,]+)\s*kg\s*\*\s*([\d.,]+)\s*kr\s*\/\s*kg/i;

const NOISE = [
  /^[-=_*\s.]+$/,            // separator rows
  /sj[äa]lvscanning/i,
  /^\s*tel\b/i,
  /^\s*org\b/i,
  /^\s*totalt\b/i,
  /\bSEK\b/i,
  /\bmoms\b/i,
  /kontrollenh|kvittokopia|butik\s*nr/i
];
const isNoise = (s) => NOISE.some((re) => re.test(s));

function trailingAmount(s) {
  const m = s.match(AMOUNT_RE);
  return m ? coercePrice(m[1]) : null;
}

function findDate(text) {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = text.match(/\b(\d{2})[/.](\d{2})[/.](20\d{2})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const compact = text.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return '';
}

function firstStore(lines) {
  for (const raw of lines) {
    const s = raw.trim();
    if (s && !isNoise(s)) return s;
  }
  return '';
}

function totalAmount(lines) {
  // The total line often ends with "SEK", so match the amount anywhere on it.
  const ANY_AMOUNT = /(-?\d[\d\s.]*,\d{2}|-?\d[\d\s.]*\.\d{2})/;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/totalt/i.test(lines[i])) {
      const m = lines[i].match(ANY_AMOUNT);
      if (m) return coercePrice(m[1]);
    }
  }
  return null;
}

// Lines between "Start Självscanning" and "Slut Självscanning"; null if absent.
function itemRegion(lines) {
  const si = lines.findIndex((l) => /start\s+sj[äa]lvscanning/i.test(l));
  const ei = lines.findIndex((l) => /slut\s+sj[äa]lvscanning/i.test(l));
  if (si === -1 || ei === -1 || ei <= si) return null;
  return lines.slice(si + 1, ei);
}

export function parseReceiptText(rawText) {
  const allLines = String(rawText || '').split(/\r?\n/);
  const region = itemRegion(allLines);
  if (!region) return null; // not a recognised self-scan receipt

  const items = [];
  const last = () => items[items.length - 1];
  let pendingName = null;
  const push = (it) => items.push({ discount: 0, deposit: 0, quantity: 1, category: null, ...it });

  for (const raw of region) {
    const s = raw.trim();
    if (!s) continue;

    // Weight continuation line: "1,002kg*112,62kr/kg  112,85" (name was on the line above).
    const w = s.match(WEIGHT_RE);
    if (w) {
      push({ name: pendingName || 'Vara', price: coercePrice(w[2]) ?? 0, quantity: coercePrice(w[1]) ?? 1 });
      pendingName = null;
      continue;
    }

    if (isNoise(s)) { pendingName = null; continue; }

    const amt = trailingAmount(s);

    // An indented modifier line belongs to the item above; its SIGN decides:
    //   negative -> discount (subtract),  positive pant line -> deposit (add).
    // We use the line's own total, so no per-unit maths is needed.
    if (amt != null && amt < 0) {
      if (last()) last().discount += Math.abs(amt);
      continue;
    }
    if (amt != null && amt > 0 && /pant/i.test(s)) {
      if (last()) last().deposit += amt;
      continue;
    }

    // No trailing amount: hold as a name for a following weight line.
    if (amt == null) { pendingName = s; continue; }

    // Item with an explicit count: "GURKA SVERIGE ST  2st*14,90  29,80".
    const c = s.match(COUNT_RE);
    if (c) {
      const n = Number(c[1]);
      push({ name: s.slice(0, c.index).trim() || pendingName || 'Vara', price: coercePrice(c[2]) ?? amt, quantity: n > 0 ? n : 1 });
      pendingName = null;
      continue;
    }

    // Plain item: "KASSE VIT/RÖD FLG  10,00".
    push({ name: s.replace(AMOUNT_RE, '').trim() || pendingName || 'Vara', price: amt, quantity: 1 });
    pendingName = null;
  }

  if (items.length < 2) return null;

  const computed = items.reduce((acc, it) => acc + (it.price * it.quantity - it.discount + it.deposit), 0);
  return {
    store: firstStore(allLines),
    date: findDate(rawText),
    total: totalAmount(allLines) ?? Math.round(computed * 100) / 100,
    items
  };
}

/** Swedish decimal comma -> dot, so a weaker LLM reads numbers more reliably. */
export function normalizeDecimals(text) {
  return String(text ?? '').replace(/(\d)[,](\d)/g, '$1.$2');
}
