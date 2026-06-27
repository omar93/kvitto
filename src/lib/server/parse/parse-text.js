import { coercePrice } from './schema.js';

// Deterministic parser for the structured Swedish self-scan receipt format
// (Willys/ICA "Självscanning"). The PDF text layer comes out as one long
// space-separated stream (no reliable line breaks), so we work on tokens:
// every logical line ends at a standalone money amount, and an indented modifier
// (Rabatt/Willys Plus/+PANT) is just such a line whose sign tells us what to do —
// negative = discount (subtract), positive +PANT = pant (add). Returns the same
// shape as the LLM parser, or null if the text is not a recognised self-scan
// receipt (caller then falls back to the LLM).

const AMOUNT = /^-?\d[\d. ]*,\d{2}$|^-?\d[\d. ]*\.\d{2}$/; // "10,00", "-5,00"
const COUNT = /^(\d+)st\*([\d.,]+)$/i;             // "2st*14,90"
const WEIGHT = /^([\d.,]+)kg\*([\d.,]+)kr\/kg$/i;  // "1,002kg*112,62kr/kg"
const SEP = /^[-=_*.]+$/;                          // separator runs like "====="

function findRegion(flat) {
  const m = flat.match(/start\s+sj[äa]lvscanning(.*?)slut\s+sj[äa]lvscanning/i);
  return m ? m[1] : null;
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

function storeName(flat) {
  const m = flat.match(/^(.*?)\s+(?:Tel:|Org:|-{3,}|={3,})/i);
  return (m ? m[1] : flat.split(' ').slice(0, 3).join(' ')).trim();
}

function totalFromText(flat) {
  const m = flat.match(/Totalt\s+(\d[\d . ]*,\d{2})\s*SEK/i) || flat.match(/(\d[\d . ]*,\d{2})\s*SEK/i);
  return m ? coercePrice(m[1]) : null;
}

// Close one logical line: `buf` is its leading tokens, `amt` its trailing amount.
function handleLine(items, buf, amt) {
  const last = items[items.length - 1];
  const joined = buf.join(' ');

  // Indented modifier on the item above; its sign decides.
  if (amt < 0) { if (last) last.discount += Math.abs(amt); return; }
  if (/pant/i.test(joined)) { if (last) last.deposit += amt; return; }

  // Otherwise a new item; a count or weight qualifier sets price + quantity.
  let price = amt;
  let quantity = 1;
  const nameToks = [];
  for (const t of buf) {
    const c = t.match(COUNT);
    const w = t.match(WEIGHT);
    if (c) { quantity = Number(c[1]) || 1; price = coercePrice(c[2]) ?? amt; }
    else if (w) { quantity = coercePrice(w[1]) ?? 1; price = coercePrice(w[2]) ?? amt; }
    else nameToks.push(t);
  }
  items.push({ name: nameToks.join(' ').trim() || 'Vara', price, quantity, discount: 0, deposit: 0, category: null });
}

export function parseReceiptText(rawText) {
  const flat = String(rawText || '').replace(/\s+/g, ' ').trim();
  const region = findRegion(flat);
  if (!region) return null;

  // Tokenise, dropping separator runs so they never leak into an item name.
  const tokens = region.split(' ').filter((t) => t && !SEP.test(t));

  const items = [];
  let buf = [];
  for (const tok of tokens) {
    if (!AMOUNT.test(tok)) { buf.push(tok); continue; }
    handleLine(items, buf, coercePrice(tok));
    buf = [];
  }

  if (items.length < 2) return null;

  const computed = items.reduce((acc, it) => acc + (it.price * it.quantity - it.discount + it.deposit), 0);
  return {
    store: storeName(flat),
    date: findDate(flat),
    total: totalFromText(flat) ?? Math.round(computed * 100) / 100,
    items
  };
}

/** Swedish decimal comma -> dot, so a weaker LLM reads numbers more reliably. */
export function normalizeDecimals(text) {
  return String(text ?? '').replace(/(\d)[,](\d)/g, '$1.$2');
}
