import { coercePrice } from './schema.js';

// Deterministic parser for structured Swedish grocery receipts. PDF text extracts
// as one long space-separated stream (no reliable line breaks), so we work on
// tokens. Two layouts are supported:
//   - Willys/ICA self-scan ("Start/Slut Självscanning"): every logical line ends
//     at a standalone amount; an indented modifier (Rabatt/Willys Plus/+PANT) is
//     such a line whose sign decides discount (-) vs pant (+).
//   - ICA Maxi columns ("Beskrivning Artikelnummer Pris Mängd Summa"): each item
//     is <name> <7-digit artnr> <pris> <mängd> <st|kg> <summa>, optionally followed
//     by a discount line ending in a negative amount.
// Returns the LLM-parser shape, or null if the text matches neither layout.

const AMOUNT = /^-?\d[\d. ]*,\d{2}$|^-?\d[\d. ]*\.\d{2}$/; // "10,00", "-5,00"
const COUNT = /^(\d+)st\*([\d.,]+)$/i;             // "2st*14,90"
const WEIGHT = /^([\d.,]+)kg\*([\d.,]+)kr\/kg$/i;  // "1,002kg*112,62kr/kg"
const SEP = /^[-=_*.]+$/;                          // separator runs like "====="
const ARTNR = /^\d{7}$/;                           // ICA article number

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

function findDate(text) {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = text.match(/\b(\d{2})[/.](\d{2})[/.](20\d{2})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const compact = text.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return '';
}

const sumItems = (items) => round(items.reduce((a, it) => a + ((it.price - it.discount) * it.quantity + it.deposit), 0), 2);

export function parseReceiptText(rawText) {
  const flat = String(rawText || '').replace(/\s+/g, ' ').trim();
  if (/slut\s+sj[äa]lvscanning/i.test(flat)) return parseSelfScan(flat);
  if (/artikelnummer/i.test(flat) && /m[äa]ngd/i.test(flat)) return parseIca(flat);
  return null;
}

// ---- Willys / ICA self-scan -------------------------------------------------

function selfScanStore(flat) {
  const m = flat.match(/^(.*?)\s+(?:Tel:|Org:|-{3,}|={3,})/i);
  return (m ? m[1] : flat.split(' ').slice(0, 3).join(' ')).trim();
}

function selfScanTotal(flat) {
  const m = flat.match(/Totalt\s+(\d[\d . ]*,\d{2})\s*SEK/i) || flat.match(/(\d[\d . ]*,\d{2})\s*SEK/i);
  return m ? coercePrice(m[1]) : null;
}

// Close one logical line: `buf` is its leading tokens, `amt` its trailing amount.
function handleSelfScanLine(items, buf, amt) {
  const last = items[items.length - 1];
  const joined = buf.join(' ');

  if (amt < 0) { if (last) last.discount += Math.abs(amt); return; }
  if (/pant/i.test(joined)) { if (last) last.deposit += amt; return; }

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

function parseSelfScan(flat) {
  const m = flat.match(/start\s+sj[äa]lvscanning(.*?)slut\s+sj[äa]lvscanning/i);
  if (!m) return null;
  const tokens = m[1].split(' ').filter((t) => t && !SEP.test(t));

  const items = [];
  let buf = [];
  for (const tok of tokens) {
    if (!AMOUNT.test(tok)) { buf.push(tok); continue; }
    handleSelfScanLine(items, buf, coercePrice(tok));
    buf = [];
  }

  if (items.length < 2) return null;
  return {
    store: selfScanStore(flat),
    date: findDate(flat),
    total: selfScanTotal(flat) ?? sumItems(items),
    items
  };
}

// ---- ICA Maxi column layout -------------------------------------------------

function icaStore(flat) {
  return flat.replace(/^Kvitto\s+/i, '').split(' ').slice(0, 4).join(' ');
}

function icaTotal(flat) {
  const m = flat.match(/Betalat\s+(\d[\d . ]*,\d{2})/i) || flat.match(/Totalt\s+SEK\s+(\d[\d . ]*,\d{2})/i);
  return m ? coercePrice(m[1]) : null;
}

function parseIca(flat) {
  const m = flat.match(/Summa\s*\(SEK\)(.*?)\bBetalat\b/i);
  if (!m) return null;
  const tokens = m[1].split(' ').filter(Boolean);

  const items = [];
  const last = () => items[items.length - 1];
  let pant = 0;
  let buf = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    // "<name> <artnr> <pris> <mängd> <enhet> <summa>"
    if (ARTNR.test(tok)) {
      const name = buf.join(' ').replace(/^\*+\s*/, '').trim() || 'Vara';
      buf = [];
      const pris = coercePrice(tokens[i + 1]) ?? 0;
      const mangd = coercePrice(tokens[i + 2]) || 1;
      const enhet = (tokens[i + 3] || '').toLowerCase();
      const summa = coercePrice(tokens[i + 4]) ?? 0;
      i += 4;
      if (enhet.startsWith('kg')) {
        // weight item: price per kg, quantity = weight (mängd column is unreliable)
        items.push({ name, price: pris, quantity: pris ? round(summa / pris, 3) : 1, discount: 0, deposit: 0, category: null });
      } else {
        // gross unit price; a following discount line fills in the per-unit discount
        items.push({ name, price: round(summa / mangd, 2), quantity: mangd, discount: 0, deposit: 0, category: null });
      }
      continue;
    }

    const amt = AMOUNT.test(tok) ? coercePrice(tok) : null;
    if (amt != null && amt < 0) {
      if (/pant/i.test(buf.join(' '))) pant += amt;                 // pant return (money back)
      else if (last()) last().discount = round(last().discount + Math.abs(amt) / last().quantity, 2);
      buf = [];
      continue;
    }

    buf.push(tok);
  }

  if (pant !== 0) items.push({ name: 'Pantretur', price: round(pant, 2), quantity: 1, discount: 0, deposit: 0, category: null });

  if (items.length < 2) return null;
  return {
    store: icaStore(flat),
    date: findDate(flat),
    total: icaTotal(flat) ?? sumItems(items),
    items
  };
}

/** Swedish decimal comma -> dot, so a weaker LLM reads numbers more reliably. */
export function normalizeDecimals(text) {
  return String(text ?? '').replace(/(\d)[,](\d)/g, '$1.$2');
}
