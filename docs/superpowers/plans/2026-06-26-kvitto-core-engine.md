# Kvitto Core Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local-first receipt-processing engine as a plain Node ESM library plus a CLI that takes one receipt file (screenshot or PDF) and prints exactly what it would write to the Google Sheet — without writing anything unless explicitly told to.

**Architecture:** Small, single-responsibility modules under `src/lib/server/`, each unit-tested in isolation. Pure-logic modules (period, schema, settings, categorize, row-building) are tested directly; modules wrapping external tools (pdf-parse, tesseract.js, googleapis, Ollama) are thin and tested with injected mocks/fixtures. A `cli.js` wires them into an end-to-end dry-run.

**Tech Stack:** Node.js 20+ (ESM), Vitest (tests), `pdf-parse` (PDF text), `tesseract.js` (image OCR), `googleapis` (Sheets), Ollama HTTP API (local LLM via the global `fetch`).

## Global Constraints

- **Never write to any Google Sheet unless the user explicitly authorizes it.** All write paths are gated behind an explicit `--commit` flag (CLI) and default to dry-run. Reads are allowed.
- **Only the Groceries block (columns J–N) is ever touched.** Columns A–I must never be read-modified-written or overwritten.
- **Column meaning:** J=name, K=price (store row = `=SUM` formula), L=date (store row only, `YYYY-MM-DD`), M=category/location, N=card ("Köpt med", store row only).
- **Categories (exact strings):** `Mat`, `Läsk/Snäx`, `Vård`, `Hem`.
- **Tab name format:** `YYYY-MM/MM` where `YYYY-MM` is the pay-period **start** month (payday = 25th) and the second `MM` is the end month. Example: 25 Jun 2026–24 Jul 2026 → `2026-06/07`. December start → `YYYY-12/01`.
- **Default target tab = the period containing today's date.** If a tab is missing it is created by duplicating a configured template tab.
- **Secrets never committed.** The service-account key JSON path comes from an env var / settings; it is covered by `.gitignore`.
- **Local-first:** no receipt data leaves the machine except the Google Sheets call to the user's own sheet.
- Frequent, small commits. ESM everywhere (`"type": "module"`).

## File Structure

```
package.json                         # ESM, scripts, deps
vitest.config.js                     # test config
.env.example                         # documents env vars (no secrets)
src/
  lib/
    types.js                         # JSDoc typedefs + CATEGORIES constant
    server/
      period/period.js               # date -> tab name (pay-period logic)
      period/period.test.js
      parse/schema.js                # ReceiptData validation
      parse/schema.test.js
      parse/prompt.js                # LLM prompt builder
      parse/parse.js                 # Ollama call -> validated ReceiptData
      parse/parse.test.js
      settings/settings.js           # JSON config load/save + helpers
      settings/settings.test.js
      categorize/categorize.js       # category resolution + learning
      categorize/categorize.test.js
      extract/pdf.js                 # pdf-parse wrapper
      extract/ocr.js                 # tesseract.js wrapper
      extract/extract.js             # dispatch pdf vs image
      extract/extract.test.js
      sheets/client.js               # googleapis auth + client factory
      sheets/client.test.js
      sheets/tabs.js                 # list/resolve/create tab from template
      sheets/tabs.test.js
      sheets/writer.js               # find row, build rows + borders, write
      sheets/writer.test.js
cli.js                               # end-to-end dry-run entry point
README.md                            # how to run, env vars, dry-run usage
test/fixtures/                       # sample PDF + sample receipt text
```

---

### Task 1: Project scaffold + test harness

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `.env.example`
- Create: `src/lib/types.js`
- Test: `src/lib/types.test.js`

**Interfaces:**
- Produces: `CATEGORIES` (string[]) exported from `src/lib/types.js`; JSDoc typedefs `ReceiptItem`, `ReceiptData`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "kvitto",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "cli": "node cli.js"
  },
  "dependencies": {
    "googleapis": "^144.0.0",
    "pdf-parse": "^1.1.1",
    "tesseract.js": "^5.1.1"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node'
  }
});
```

- [ ] **Step 3: Create `.env.example`**

```bash
# Path to the Google service-account key JSON (never commit the real file)
GOOGLE_APPLICATION_CREDENTIALS=./service-account.key.json

# Google Sheet to write to
KVITTO_SPREADSHEET_ID=1r-_ah7YmHsDvR_X8U3Getjz4s6_6E6zuuTkiCNX2h5Y

# Tab used as the template when a month tab is missing
KVITTO_TEMPLATE_TAB=TEMPLATE

# Ollama
KVITTO_OLLAMA_HOST=http://localhost:11434
KVITTO_OLLAMA_MODEL=llama3.1:8b
```

- [ ] **Step 4: Create `src/lib/types.js`**

```js
/**
 * @typedef {Object} ReceiptItem
 * @property {string} name
 * @property {number} price
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
```

- [ ] **Step 5: Write the failing test `src/lib/types.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { CATEGORIES } from './types.js';

describe('CATEGORIES', () => {
  it('contains the four exact category strings', () => {
    expect(CATEGORIES).toEqual(['Mat', 'Läsk/Snäx', 'Vård', 'Hem']);
  });
});
```

- [ ] **Step 6: Install deps and run the test**

Run: `npm install && npm test`
Expected: install succeeds; the types test PASSES (1 passed).

- [ ] **Step 7: Commit**

```bash
git add package.json vitest.config.js .env.example src/lib/types.js src/lib/types.test.js
git commit -m "chore: scaffold node esm project with vitest and shared types"
```

---

### Task 2: Pay-period → tab name (`period/`)

**Files:**
- Create: `src/lib/server/period/period.js`
- Test: `src/lib/server/period/period.test.js`

**Interfaces:**
- Produces:
  - `tabNameForYmd(year: number, month1to12: number, day: number): string`
  - `tabNameForDate(date?: Date): string`
  - `tabNameForDateString(s: string /* 'YYYY-MM-DD' */): string`

- [ ] **Step 1: Write the failing test `src/lib/server/period/period.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { tabNameForYmd, tabNameForDateString } from './period.js';

describe('tabNameForYmd', () => {
  it('uses current month as start on/after the 25th', () => {
    expect(tabNameForYmd(2026, 6, 25)).toBe('2026-06/07');
    expect(tabNameForYmd(2026, 6, 30)).toBe('2026-06/07');
  });

  it('uses previous month as start before the 25th', () => {
    expect(tabNameForYmd(2026, 7, 24)).toBe('2026-06/07');
    expect(tabNameForYmd(2026, 6, 1)).toBe('2026-05/06');
  });

  it('wraps January back to previous December', () => {
    expect(tabNameForYmd(2026, 1, 10)).toBe('2025-12/01');
  });

  it('names a December start period as 12/01', () => {
    expect(tabNameForYmd(2026, 12, 26)).toBe('2026-12/01');
  });
});

describe('tabNameForDateString', () => {
  it('parses YYYY-MM-DD without timezone drift', () => {
    expect(tabNameForDateString('2026-04-24')).toBe('2026-03/04');
    expect(tabNameForDateString('2026-04-25')).toBe('2026-04/05');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/period/period.test.js`
Expected: FAIL with "Failed to resolve import './period.js'".

- [ ] **Step 3: Implement `src/lib/server/period/period.js`**

```js
const pad = (n) => String(n).padStart(2, '0');

/**
 * @param {number} year
 * @param {number} month1to12
 * @param {number} day
 * @returns {string} tab name like "2026-06/07"
 */
export function tabNameForYmd(year, month1to12, day) {
  let y = year;
  let m = month1to12; // start month of the pay period
  if (day < 25) {
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  const endM = m === 12 ? 1 : m + 1;
  return `${y}-${pad(m)}/${pad(endM)}`;
}

/** @param {Date} [date] */
export function tabNameForDate(date = new Date()) {
  return tabNameForYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** @param {string} s "YYYY-MM-DD" */
export function tabNameForDateString(s) {
  const [y, m, d] = s.split('-').map(Number);
  return tabNameForYmd(y, m, d);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/period/period.test.js`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/period/
git commit -m "feat(period): derive month tab name from pay-period (25th rule)"
```

---

### Task 3: Receipt schema validation (`parse/schema.js`)

**Files:**
- Create: `src/lib/server/parse/schema.js`
- Test: `src/lib/server/parse/schema.test.js`

**Interfaces:**
- Consumes: `CATEGORIES` from `src/lib/types.js`.
- Produces:
  - `validateReceipt(obj: unknown): { ok: true, value: ReceiptData } | { ok: false, errors: string[] }`
  - `coercePrice(v: unknown): number|null` (parses `"19,90 kr"`, `"19.90"`, `19.9` → number)

- [ ] **Step 1: Write the failing test `src/lib/server/parse/schema.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { validateReceipt, coercePrice } from './schema.js';

describe('coercePrice', () => {
  it('parses Swedish formatted prices', () => {
    expect(coercePrice('19,90 kr')).toBe(19.9);
    expect(coercePrice('1 241,86 kr')).toBe(1241.86); // nbsp thousands sep
    expect(coercePrice('20.62')).toBe(20.62);
    expect(coercePrice(18.83)).toBe(18.83);
  });

  it('returns null for unparseable input', () => {
    expect(coercePrice('abc')).toBeNull();
    expect(coercePrice(null)).toBeNull();
  });
});

describe('validateReceipt', () => {
  const good = {
    store: 'Willys - Port73',
    date: '2026-04-24',
    total: 241.86,
    items: [
      { name: 'Mjölk 0,5%', price: 19.9, category: 'Mat' },
      { name: 'Cola + pant', price: 15.15, category: 'Läsk/Snäx' }
    ]
  };

  it('accepts a well-formed receipt', () => {
    const r = validateReceipt(good);
    expect(r.ok).toBe(true);
    expect(r.value.items).toHaveLength(2);
  });

  it('coerces string prices and normalizes invalid categories to null', () => {
    const r = validateReceipt({
      ...good,
      total: '241,86 kr',
      items: [{ name: 'X', price: '19,90 kr', category: 'Nonsense' }]
    });
    expect(r.ok).toBe(true);
    expect(r.value.total).toBe(241.86);
    expect(r.value.items[0].price).toBe(19.9);
    expect(r.value.items[0].category).toBeNull();
  });

  it('rejects when store/date/items are missing or malformed', () => {
    expect(validateReceipt({}).ok).toBe(false);
    expect(validateReceipt({ ...good, date: '24/04/2026' }).ok).toBe(false);
    expect(validateReceipt({ ...good, items: [] }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/parse/schema.test.js`
Expected: FAIL with import resolution error.

- [ ] **Step 3: Implement `src/lib/server/parse/schema.js`**

```js
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

function normCategory(c) {
  return CATEGORIES.includes(c) ? c : null;
}

/**
 * @param {unknown} obj
 * @returns {{ok: true, value: import('../../types.js').ReceiptData} | {ok: false, errors: string[]}}
 */
export function validateReceipt(obj) {
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
      items.push({ name: String(it?.name ?? '').trim(), price: price ?? 0, category: normCategory(it?.category) });
    });
  }

  if (errors.length) return { ok: false, errors };

  const total = coercePrice(o.total);
  return {
    ok: true,
    value: {
      store: o.store.trim(),
      date: o.date,
      total: total ?? items.reduce((s, it) => s + it.price, 0),
      items
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/parse/schema.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/parse/schema.js src/lib/server/parse/schema.test.js
git commit -m "feat(parse): validate and coerce receipt data into ReceiptData"
```

---

### Task 4: Settings store (`settings/`)

**Files:**
- Create: `src/lib/server/settings/settings.js`
- Test: `src/lib/server/settings/settings.test.js`

**Interfaces:**
- Produces:
  - `getDefaultSettings(): Settings`
  - `loadSettings(filePath: string): Promise<Settings>` (returns defaults merged with file; defaults if file missing)
  - `saveSettings(filePath: string, settings: Settings): Promise<void>`
  - `normalizeItemKey(name: string): string`
- `Settings` shape:
  ```
  {
    confirmations: { tab, category, storeMeta, finalSave } : boolean,
    lastUsed: { location: string, card: string },
    learnedCategories: { [normalizedName]: category },
    sheet: { spreadsheetId: string, templateTab: string },
    ollama: { host: string, model: string }
  }
  ```

- [ ] **Step 1: Write the failing test `src/lib/server/settings/settings.test.js`**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDefaultSettings, loadSettings, saveSettings, normalizeItemKey } from './settings.js';

let dir, file;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'kvitto-')); file = join(dir, 'settings.json'); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('normalizeItemKey', () => {
  it('lowercases and trims', () => {
    expect(normalizeItemKey('  Cola + Pant ')).toBe('cola + pant');
  });
});

describe('settings load/save', () => {
  it('returns defaults when file does not exist', async () => {
    const s = await loadSettings(file);
    expect(s).toEqual(getDefaultSettings());
  });

  it('round-trips and deep-merges over defaults', async () => {
    await writeFile(file, JSON.stringify({ lastUsed: { location: 'Göteborg' } }));
    const s = await loadSettings(file);
    expect(s.lastUsed.location).toBe('Göteborg');
    expect(s.lastUsed.card).toBe(getDefaultSettings().lastUsed.card); // preserved default
    s.learnedCategories['cola + pant'] = 'Läsk/Snäx';
    await saveSettings(file, s);
    const again = await loadSettings(file);
    expect(again.learnedCategories['cola + pant']).toBe('Läsk/Snäx');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/settings/settings.test.js`
Expected: FAIL with import resolution error.

- [ ] **Step 3: Implement `src/lib/server/settings/settings.js`**

```js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export function getDefaultSettings() {
  return {
    confirmations: { tab: true, category: true, storeMeta: true, finalSave: true },
    lastUsed: { location: '', card: '' },
    learnedCategories: {},
    sheet: { spreadsheetId: '', templateTab: '' },
    ollama: { host: 'http://localhost:11434', model: 'llama3.1:8b' }
  };
}

export function normalizeItemKey(name) {
  return String(name).trim().toLowerCase();
}

function deepMerge(base, override) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof base?.[k] === 'object'
      ? deepMerge(base[k], v)
      : v;
  }
  return out;
}

export async function loadSettings(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return deepMerge(getDefaultSettings(), JSON.parse(raw));
  } catch (err) {
    if (err.code === 'ENOENT') return getDefaultSettings();
    throw err;
  }
}

export async function saveSettings(filePath, settings) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/settings/settings.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/settings/
git commit -m "feat(settings): JSON config store with defaults and deep-merge"
```

---

### Task 5: Category resolution + learning (`categorize/`)

**Files:**
- Create: `src/lib/server/categorize/categorize.js`
- Test: `src/lib/server/categorize/categorize.test.js`

**Interfaces:**
- Consumes: `normalizeItemKey` from settings; `CATEGORIES` from types.
- Produces:
  - `resolveCategory(name: string, suggested: string|null, learned: Record<string,string>): string|null` — learned map wins, else a valid suggestion, else null.
  - `applyCategories(items: ReceiptItem[], learned): ReceiptItem[]` — returns items with `category` resolved.
  - `recordCorrection(learned, name, category): Record<string,string>` — returns a new learned map including the correction (ignores invalid categories).

- [ ] **Step 1: Write the failing test `src/lib/server/categorize/categorize.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { resolveCategory, applyCategories, recordCorrection } from './categorize.js';

describe('resolveCategory', () => {
  const learned = { 'cola + pant': 'Läsk/Snäx' };

  it('prefers a learned mapping over the suggestion', () => {
    expect(resolveCategory('Cola + pant', 'Mat', learned)).toBe('Läsk/Snäx');
  });

  it('falls back to a valid suggestion', () => {
    expect(resolveCategory('Banan', 'Mat', learned)).toBe('Mat');
  });

  it('returns null for an invalid suggestion and no learned entry', () => {
    expect(resolveCategory('Mystery', 'Bogus', learned)).toBeNull();
  });
});

describe('applyCategories', () => {
  it('resolves categories across items', () => {
    const items = [
      { name: 'Cola + pant', price: 15.15, category: 'Mat' },
      { name: 'Banan', price: 24.18, category: null }
    ];
    const out = applyCategories(items, { 'cola + pant': 'Läsk/Snäx' });
    expect(out.map((i) => i.category)).toEqual(['Läsk/Snäx', null]);
  });
});

describe('recordCorrection', () => {
  it('adds a normalized, valid correction without mutating the input', () => {
    const learned = {};
    const next = recordCorrection(learned, ' Tandkräm ', 'Vård');
    expect(next).toEqual({ 'tandkräm': 'Vård' });
    expect(learned).toEqual({});
  });

  it('ignores invalid categories', () => {
    expect(recordCorrection({}, 'X', 'Nope')).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/categorize/categorize.test.js`
Expected: FAIL with import resolution error.

- [ ] **Step 3: Implement `src/lib/server/categorize/categorize.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/categorize/categorize.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/categorize/
git commit -m "feat(categorize): resolve categories with learned overrides"
```

---

### Task 6: PDF text extraction (`extract/pdf.js`)

**Files:**
- Create: `src/lib/server/extract/pdf.js`
- Create: `test/fixtures/sample.pdf` (a tiny text PDF, generated in Step 1)
- Test: `src/lib/server/extract/pdf.test.js`

**Interfaces:**
- Produces: `extractPdfText(buffer: Buffer): Promise<string>`

- [ ] **Step 1: Create a tiny text-bearing fixture PDF**

Run this once to generate the fixture (writes a minimal valid PDF containing the text "Willys Mjolk 19,90"):

```bash
node -e '
const fs = require("fs");
const text = "Willys Mjolk 19,90";
const stream = `BT /F1 18 Tf 40 720 Td (${text}) Tj ET`;
const objs = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
];
let pdf = "%PDF-1.4\n", offsets = [];
objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
offsets.forEach((off) => { pdf += String(off).padStart(10, "0") + " 00000 n \n"; });
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
fs.mkdirSync("test/fixtures", { recursive: true });
fs.writeFileSync("test/fixtures/sample.pdf", pdf, "latin1");
console.log("wrote test/fixtures/sample.pdf");
'
```
Expected: prints "wrote test/fixtures/sample.pdf".

- [ ] **Step 2: Write the failing test `src/lib/server/extract/pdf.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { extractPdfText } from './pdf.js';

describe('extractPdfText', () => {
  it('reads the text layer from a PDF', async () => {
    const buf = await readFile('test/fixtures/sample.pdf');
    const text = await extractPdfText(buf);
    expect(text).toContain('Willys');
    expect(text).toContain('19,90');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/server/extract/pdf.test.js`
Expected: FAIL with import resolution error.

- [ ] **Step 4: Implement `src/lib/server/extract/pdf.js`**

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// pdf-parse is CommonJS; require avoids its index.js debug-mode side effects under ESM.
const pdfParse = require('pdf-parse');

/**
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
export async function extractPdfText(buffer) {
  const data = await pdfParse(buffer);
  return (data.text || '').trim();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/server/extract/pdf.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/extract/pdf.js src/lib/server/extract/pdf.test.js test/fixtures/sample.pdf
git commit -m "feat(extract): read PDF text layer via pdf-parse"
```

---

### Task 7: Image OCR (`extract/ocr.js`)

**Files:**
- Create: `src/lib/server/extract/ocr.js`
- Test: `src/lib/server/extract/ocr.test.js`

**Interfaces:**
- Produces: `extractImageText(buffer: Buffer, opts?: { lang?: string, createWorker?: Function }): Promise<string>`
  - `createWorker` is injectable for testing; defaults to tesseract.js's real worker.

- [ ] **Step 1: Write the failing test `src/lib/server/extract/ocr.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { extractImageText } from './ocr.js';

describe('extractImageText', () => {
  it('runs a worker, returns trimmed text, and terminates the worker', async () => {
    const terminate = vi.fn();
    const recognize = vi.fn().mockResolvedValue({ data: { text: '  Maxi Banan 24,18\n' } });
    const fakeCreateWorker = vi.fn().mockResolvedValue({ recognize, terminate });

    const text = await extractImageText(Buffer.from('img'), {
      lang: 'swe+eng',
      createWorker: fakeCreateWorker
    });

    expect(fakeCreateWorker).toHaveBeenCalledWith('swe+eng');
    expect(recognize).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledOnce();
    expect(text).toBe('Maxi Banan 24,18');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/extract/ocr.test.js`
Expected: FAIL with import resolution error.

- [ ] **Step 3: Implement `src/lib/server/extract/ocr.js`**

```js
import { createWorker as defaultCreateWorker } from 'tesseract.js';

/**
 * @param {Buffer} buffer
 * @param {{ lang?: string, createWorker?: Function }} [opts]
 * @returns {Promise<string>}
 */
export async function extractImageText(buffer, opts = {}) {
  const lang = opts.lang || 'swe+eng';
  const createWorker = opts.createWorker || defaultCreateWorker;
  const worker = await createWorker(lang);
  try {
    const { data } = await worker.recognize(buffer);
    return (data.text || '').trim();
  } finally {
    await worker.terminate();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/extract/ocr.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/extract/ocr.js src/lib/server/extract/ocr.test.js
git commit -m "feat(extract): OCR images via tesseract.js with injectable worker"
```

---

### Task 8: Extraction dispatcher (`extract/extract.js`)

**Files:**
- Create: `src/lib/server/extract/extract.js`
- Test: `src/lib/server/extract/extract.test.js`

**Interfaces:**
- Consumes: `extractPdfText`, `extractImageText`.
- Produces: `extractText(input: { buffer: Buffer, filename?: string, mimetype?: string }, deps?: { pdf?: Function, image?: Function }): Promise<{ text: string, source: 'pdf'|'ocr' }>`
  - PDFs route to `pdf`; a PDF whose text layer is shorter than 20 non-space chars throws a clear error (text-less PDF needs OCR, out of scope here). Images route to `image`.

- [ ] **Step 1: Write the failing test `src/lib/server/extract/extract.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { extractText } from './extract.js';

const deps = (pdfText, imgText) => ({
  pdf: vi.fn().mockResolvedValue(pdfText),
  image: vi.fn().mockResolvedValue(imgText)
});

describe('extractText', () => {
  it('uses pdf extractor for application/pdf', async () => {
    const d = deps('Willys Mjolk 19,90 kr total 241,86', 'X');
    const r = await extractText({ buffer: Buffer.from('x'), mimetype: 'application/pdf' }, d);
    expect(r).toEqual({ text: 'Willys Mjolk 19,90 kr total 241,86', source: 'pdf' });
    expect(d.image).not.toHaveBeenCalled();
  });

  it('routes by .pdf extension when mimetype is absent', async () => {
    const d = deps('Some sufficiently long receipt text here', 'X');
    const r = await extractText({ buffer: Buffer.from('x'), filename: 'kvitto.pdf' }, d);
    expect(r.source).toBe('pdf');
  });

  it('throws for a PDF with no usable text layer', async () => {
    const d = deps('   ', 'X');
    await expect(extractText({ buffer: Buffer.from('x'), mimetype: 'application/pdf' }, d))
      .rejects.toThrow(/no text layer/i);
  });

  it('uses OCR for images', async () => {
    const d = deps('X', 'Maxi Banan 24,18');
    const r = await extractText({ buffer: Buffer.from('x'), mimetype: 'image/png' }, d);
    expect(r).toEqual({ text: 'Maxi Banan 24,18', source: 'ocr' });
    expect(d.pdf).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/extract/extract.test.js`
Expected: FAIL with import resolution error.

- [ ] **Step 3: Implement `src/lib/server/extract/extract.js`**

```js
import { extractPdfText } from './pdf.js';
import { extractImageText } from './ocr.js';

const MIN_PDF_TEXT = 20;

function isPdf(input) {
  if (input.mimetype) return input.mimetype === 'application/pdf';
  if (input.filename) return /\.pdf$/i.test(input.filename);
  return false;
}

/**
 * @param {{ buffer: Buffer, filename?: string, mimetype?: string }} input
 * @param {{ pdf?: Function, image?: Function }} [deps]
 * @returns {Promise<{ text: string, source: 'pdf'|'ocr' }>}
 */
export async function extractText(input, deps = {}) {
  const pdf = deps.pdf || extractPdfText;
  const image = deps.image || extractImageText;

  if (isPdf(input)) {
    const text = (await pdf(input.buffer)) || '';
    if (text.replace(/\s/g, '').length < MIN_PDF_TEXT) {
      throw new Error('PDF has no usable text layer (image-only PDF needs OCR, not supported yet)');
    }
    return { text, source: 'pdf' };
  }

  const text = (await image(input.buffer)) || '';
  return { text, source: 'ocr' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/extract/extract.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/extract/extract.js src/lib/server/extract/extract.test.js
git commit -m "feat(extract): dispatch PDF vs image and guard text-less PDFs"
```

---

### Task 9: LLM parsing via Ollama (`parse/prompt.js`, `parse/parse.js`)

**Files:**
- Create: `src/lib/server/parse/prompt.js`
- Create: `src/lib/server/parse/parse.js`
- Test: `src/lib/server/parse/parse.test.js`

**Interfaces:**
- Consumes: `validateReceipt` (schema), `CATEGORIES`.
- Produces:
  - `buildPrompt(rawText: string): string`
  - `parseReceipt(rawText: string, opts: { host: string, model: string, fetchImpl?: Function }): Promise<ReceiptData>`
    - Calls `POST {host}/api/generate` with `{ model, prompt, stream:false, format:'json' }`; expects `{ response: <json string> }`; validates; retries once on invalid JSON/schema; throws after the second failure.

- [ ] **Step 1: Write the failing test `src/lib/server/parse/parse.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, parseReceipt } from './parse.js';

const okBody = (obj) => ({ ok: true, json: async () => ({ response: JSON.stringify(obj) }) });

const sample = {
  store: 'Willys - Port73',
  date: '2026-04-24',
  total: 241.86,
  items: [{ name: 'Mjölk 0,5%', price: 19.9, category: 'Mat' }]
};

describe('buildPrompt', () => {
  it('includes the raw text and the allowed categories', () => {
    const p = buildPrompt('RAWRECEIPT');
    expect(p).toContain('RAWRECEIPT');
    expect(p).toContain('Läsk/Snäx');
    expect(p).toMatch(/json/i);
  });
});

describe('parseReceipt', () => {
  it('calls Ollama and returns validated data', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okBody(sample));
    const r = await parseReceipt('raw', { host: 'http://h:11434', model: 'm', fetchImpl });
    expect(r.store).toBe('Willys - Port73');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://h:11434/api/generate');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'm', stream: false, format: 'json' });
  });

  it('retries once on invalid output then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'not json' }) })
      .mockResolvedValueOnce(okBody(sample));
    const r = await parseReceipt('raw', { host: 'http://h:11434', model: 'm', fetchImpl });
    expect(r.store).toBe('Willys - Port73');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws after two invalid responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: '{}' }) });
    await expect(parseReceipt('raw', { host: 'http://h:11434', model: 'm', fetchImpl }))
      .rejects.toThrow(/could not parse/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/parse/parse.test.js`
Expected: FAIL with import resolution error.

- [ ] **Step 3: Implement `src/lib/server/parse/prompt.js`**

```js
import { CATEGORIES } from '../../types.js';

export function buildPrompt(rawText) {
  return [
    'You extract structured data from a Swedish grocery store receipt.',
    'Return ONLY a JSON object with this exact shape:',
    '{',
    '  "store": string,            // store name, e.g. "Willys - Port73"',
    '  "date": "YYYY-MM-DD",       // purchase date',
    '  "total": number,            // total amount',
    '  "items": [ { "name": string, "price": number, "category": string } ]',
    '}',
    `Each item "category" MUST be exactly one of: ${CATEGORIES.map((c) => `"${c}"`).join(', ')}.`,
    'Use "Mat" for normal groceries, "Läsk/Snäx" for soda/snacks/candy,',
    '"Vård" for hygiene/health, "Hem" for household goods.',
    'Prices use a dot decimal separator. Do not include currency symbols.',
    'Exclude deposit/pant lines unless attached to an item. Output JSON only, no prose.',
    '',
    'RECEIPT TEXT:',
    rawText
  ].join('\n');
}
```

- [ ] **Step 4: Implement `src/lib/server/parse/parse.js`**

```js
import { buildPrompt } from './prompt.js';
import { validateReceipt } from './schema.js';

export { buildPrompt };

async function callOllama(rawText, { host, model, fetchImpl }) {
  const res = await fetchImpl(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt: buildPrompt(rawText), stream: false, format: 'json' })
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data.response;
}

/**
 * @param {string} rawText
 * @param {{ host: string, model: string, fetchImpl?: Function }} opts
 * @returns {Promise<import('../../types.js').ReceiptData>}
 */
export async function parseReceipt(rawText, opts) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  let lastErrors = ['no attempts'];
  for (let attempt = 0; attempt < 2; attempt++) {
    const responseText = await callOllama(rawText, { ...opts, fetchImpl });
    let obj;
    try {
      obj = JSON.parse(responseText);
    } catch {
      lastErrors = ['response was not valid JSON'];
      continue;
    }
    const result = validateReceipt(obj);
    if (result.ok) return result.value;
    lastErrors = result.errors;
  }
  throw new Error(`Could not parse receipt after 2 attempts: ${lastErrors.join('; ')}`);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/server/parse/parse.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/parse/prompt.js src/lib/server/parse/parse.js src/lib/server/parse/parse.test.js
git commit -m "feat(parse): parse receipt text into ReceiptData via Ollama with retry"
```

---

### Task 10: Sheets client factory (`sheets/client.js`)

**Files:**
- Create: `src/lib/server/sheets/client.js`
- Test: `src/lib/server/sheets/client.test.js`

**Interfaces:**
- Produces: `createSheetsClient({ keyFile?: string, credentials?: object, googleImpl?: object }): SheetsClient`
  - Uses service-account auth, scope `https://www.googleapis.com/auth/spreadsheets`.
  - Throws a clear error when neither `keyFile` nor `credentials` is provided.
  - `googleImpl` is injectable (defaults to the real `google` from `googleapis`).

- [ ] **Step 1: Write the failing test `src/lib/server/sheets/client.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { createSheetsClient } from './client.js';

describe('createSheetsClient', () => {
  it('throws when no credentials are supplied', () => {
    expect(() => createSheetsClient({})).toThrow(/credentials/i);
  });

  it('builds a sheets client with spreadsheets scope from a key file', () => {
    const sheetsObj = { spreadsheets: {} };
    const googleImpl = {
      auth: { GoogleAuth: vi.fn().mockImplementation((cfg) => ({ cfg })) },
      sheets: vi.fn().mockReturnValue(sheetsObj)
    };
    const client = createSheetsClient({ keyFile: '/k.json', googleImpl });
    expect(googleImpl.auth.GoogleAuth).toHaveBeenCalledWith({
      keyFile: '/k.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    expect(googleImpl.sheets).toHaveBeenCalledWith(expect.objectContaining({ version: 'v4' }));
    expect(client).toBe(sheetsObj);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/sheets/client.test.js`
Expected: FAIL with import resolution error.

- [ ] **Step 3: Implement `src/lib/server/sheets/client.js`**

```js
import { google as defaultGoogle } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/**
 * @param {{ keyFile?: string, credentials?: object, googleImpl?: any }} opts
 * @returns {any} sheets v4 client
 */
export function createSheetsClient({ keyFile, credentials, googleImpl } = {}) {
  if (!keyFile && !credentials) {
    throw new Error('createSheetsClient: provide keyFile or credentials (service account)');
  }
  const google = googleImpl || defaultGoogle;
  const auth = new google.auth.GoogleAuth(
    keyFile ? { keyFile, scopes: SCOPES } : { credentials, scopes: SCOPES }
  );
  return google.sheets({ version: 'v4', auth });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/sheets/client.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/sheets/client.js src/lib/server/sheets/client.test.js
git commit -m "feat(sheets): service-account client factory with injectable google impl"
```

---

### Task 11: Tab resolve/create from template (`sheets/tabs.js`)

**Files:**
- Create: `src/lib/server/sheets/tabs.js`
- Test: `src/lib/server/sheets/tabs.test.js`

**Interfaces:**
- Produces:
  - `listTabs(sheets, spreadsheetId): Promise<Array<{ title: string, sheetId: number }>>`
  - `resolveTab(sheets, spreadsheetId, tabName, { templateTab?: string, create?: boolean }): Promise<{ title: string, sheetId: number, created: boolean }>`
    - If the tab exists, return it. If not and `create` is true, duplicate the `templateTab` sheet with `newSheetName = tabName`. If not and `create` is false, throw.

- [ ] **Step 1: Write the failing test `src/lib/server/sheets/tabs.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { listTabs, resolveTab } from './tabs.js';

function fakeSheets(tabs) {
  const state = tabs.map((t) => ({ properties: t }));
  return {
    _state: state,
    spreadsheets: {
      get: vi.fn().mockImplementation(async () => ({ data: { sheets: state } })),
      batchUpdate: vi.fn().mockImplementation(async ({ requestBody }) => {
        const req = requestBody.requests[0].duplicateSheet;
        state.push({ properties: { title: req.newSheetName, sheetId: 999 } });
        return { data: {} };
      })
    }
  };
}

describe('listTabs', () => {
  it('returns titles and ids', async () => {
    const s = fakeSheets([{ title: 'TEMPLATE', sheetId: 1 }, { title: '2026-06/07', sheetId: 2 }]);
    expect(await listTabs(s, 'SID')).toEqual([
      { title: 'TEMPLATE', sheetId: 1 },
      { title: '2026-06/07', sheetId: 2 }
    ]);
  });
});

describe('resolveTab', () => {
  it('returns an existing tab without creating', async () => {
    const s = fakeSheets([{ title: '2026-06/07', sheetId: 2 }]);
    const r = await resolveTab(s, 'SID', '2026-06/07', { templateTab: 'TEMPLATE', create: true });
    expect(r).toEqual({ title: '2026-06/07', sheetId: 2, created: false });
    expect(s.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('creates from the template when missing and create=true', async () => {
    const s = fakeSheets([{ title: 'TEMPLATE', sheetId: 1 }]);
    const r = await resolveTab(s, 'SID', '2026-06/07', { templateTab: 'TEMPLATE', create: true });
    expect(r).toEqual({ title: '2026-06/07', sheetId: 999, created: true });
    const body = s.spreadsheets.batchUpdate.mock.calls[0][0].requestBody;
    expect(body.requests[0].duplicateSheet).toMatchObject({ sourceSheetId: 1, newSheetName: '2026-06/07' });
  });

  it('throws when missing and create=false', async () => {
    const s = fakeSheets([{ title: 'TEMPLATE', sheetId: 1 }]);
    await expect(resolveTab(s, 'SID', '2026-06/07', { create: false })).rejects.toThrow(/does not exist/i);
  });

  it('throws when template is missing', async () => {
    const s = fakeSheets([]);
    await expect(resolveTab(s, 'SID', '2026-06/07', { templateTab: 'TEMPLATE', create: true }))
      .rejects.toThrow(/template/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/sheets/tabs.test.js`
Expected: FAIL with import resolution error.

- [ ] **Step 3: Implement `src/lib/server/sheets/tabs.js`**

```js
export async function listTabs(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets || []).map((s) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId
  }));
}

/**
 * @returns {Promise<{ title: string, sheetId: number, created: boolean }>}
 */
export async function resolveTab(sheets, spreadsheetId, tabName, { templateTab, create = false } = {}) {
  const tabs = await listTabs(sheets, spreadsheetId);
  const existing = tabs.find((t) => t.title === tabName);
  if (existing) return { ...existing, created: false };

  if (!create) throw new Error(`Tab "${tabName}" does not exist`);

  const template = tabs.find((t) => t.title === templateTab);
  if (!template) throw new Error(`Template tab "${templateTab}" not found; cannot create "${tabName}"`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ duplicateSheet: { sourceSheetId: template.sheetId, newSheetName: tabName } }]
    }
  });

  const after = await listTabs(sheets, spreadsheetId);
  const created = after.find((t) => t.title === tabName);
  return { ...created, created: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/sheets/tabs.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/sheets/tabs.js src/lib/server/sheets/tabs.test.js
git commit -m "feat(sheets): resolve a month tab, creating it from a template when missing"
```

---

### Task 12: Row building + guarded write (`sheets/writer.js`)

**Files:**
- Create: `src/lib/server/sheets/writer.js`
- Test: `src/lib/server/sheets/writer.test.js`

**Interfaces:**
- Consumes: `resolveTab` from tabs.
- Produces:
  - `findNextRow(sheets, spreadsheetId, tabName): Promise<number>` — 1-based row after the last non-empty cell in column J.
  - `buildReceiptRows({ receipt, startRow, tabName, sheetId, location, card }): { valueRange, borderRequest, startRow, lastItemRow }`
    - `valueRange = { range: "'TAB'!J{startRow}:N{lastItemRow}", values: [...] }`
    - store row = `[store, "=SUM(K{first}:K{last})", date, location, card]`
    - item row = `[name, price, "", category ?? "", ""]`
    - `borderRequest` = an `updateBorders` request putting a thick bottom border on `lastItemRow` across J:N (col indices 9..14).
  - `writeReceipt(sheets, spreadsheetId, receipt, { tabName, location, card, templateTab, create, dryRun }): Promise<{ plan, applied: boolean }>`
    - Resolves the tab, finds the next row, builds rows. If `dryRun` (default true) returns `{ plan, applied: false }` and writes nothing. Only when `dryRun === false` does it call `values.update` then `batchUpdate` for the border.

- [ ] **Step 1: Write the failing test `src/lib/server/sheets/writer.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { findNextRow, buildReceiptRows, writeReceipt } from './writer.js';

const receipt = {
  store: 'Willys - Port73',
  date: '2026-04-24',
  total: 39.05,
  items: [
    { name: 'Mjölk 0,5%', price: 19.9, category: 'Mat' },
    { name: 'Cola + pant', price: 19.15, category: 'Läsk/Snäx' }
  ]
};

describe('findNextRow', () => {
  it('returns the row after the last filled cell in column J', async () => {
    const sheets = { spreadsheets: { values: { get: vi.fn().mockResolvedValue({
      data: { values: [['Groceries'], ['Willys'], ['Mjölk'], [''], []] }
    }) } } };
    expect(await findNextRow(sheets, 'SID', '2026-06/07')).toBe(4);
    expect(sheets.spreadsheets.values.get).toHaveBeenCalledWith(
      expect.objectContaining({ range: "'2026-06/07'!J1:J1000" })
    );
  });
});

describe('buildReceiptRows', () => {
  it('builds the store row with a SUM formula and item rows', () => {
    const out = buildReceiptRows({
      receipt, startRow: 5, tabName: '2026-06/07', sheetId: 7, location: 'Stockholm', card: 'Skandia'
    });
    expect(out.startRow).toBe(5);
    expect(out.lastItemRow).toBe(7);
    expect(out.valueRange.range).toBe("'2026-06/07'!J5:N7");
    expect(out.valueRange.values).toEqual([
      ['Willys - Port73', '=SUM(K6:K7)', '2026-04-24', 'Stockholm', 'Skandia'],
      ['Mjölk 0,5%', 19.9, '', 'Mat', ''],
      ['Cola + pant', 19.15, '', 'Läsk/Snäx', '']
    ]);
    expect(out.borderRequest.updateBorders.range).toEqual({
      sheetId: 7, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 9, endColumnIndex: 14
    });
    expect(out.borderRequest.updateBorders.bottom.style).toBe('SOLID_THICK');
  });
});

describe('writeReceipt', () => {
  function sheetsWith(existingJ) {
    return {
      spreadsheets: {
        get: vi.fn().mockResolvedValue({ data: { sheets: [{ properties: { title: '2026-06/07', sheetId: 7 } }] } }),
        batchUpdate: vi.fn().mockResolvedValue({ data: {} }),
        values: {
          get: vi.fn().mockResolvedValue({ data: { values: existingJ } }),
          update: vi.fn().mockResolvedValue({ data: {} }),
          batchUpdate: vi.fn().mockResolvedValue({ data: {} })
        }
      }
    };
  }

  it('dry-run returns a plan and writes nothing', async () => {
    const sheets = sheetsWith([['Groceries']]);
    const r = await writeReceipt(sheets, 'SID', receipt, { tabName: '2026-06/07', location: 'Stockholm', card: 'Skandia' });
    expect(r.applied).toBe(false);
    expect(r.plan.valueRange.range).toBe("'2026-06/07'!J2:N4");
    expect(sheets.spreadsheets.values.update).not.toHaveBeenCalled();
    expect(sheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('applies values then border when dryRun is false', async () => {
    const sheets = sheetsWith([['Groceries']]);
    const r = await writeReceipt(sheets, 'SID', receipt, {
      tabName: '2026-06/07', location: 'Stockholm', card: 'Skandia', dryRun: false
    });
    expect(r.applied).toBe(true);
    expect(sheets.spreadsheets.values.update).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'SID',
      range: "'2026-06/07'!J2:N4",
      valueInputOption: 'USER_ENTERED'
    }));
    expect(sheets.spreadsheets.batchUpdate).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'SID'
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/sheets/writer.test.js`
Expected: FAIL with import resolution error.

- [ ] **Step 3: Implement `src/lib/server/sheets/writer.js`**

```js
import { resolveTab } from './tabs.js';

// Column J is the 10th column (0-indexed 9); N is index 13 -> end-exclusive 14.
const COL_J_INDEX = 9;
const COL_N_END = 14;

export async function findNextRow(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!J1:J1000`
  });
  const rows = res.data.values || [];
  let lastFilled = 0;
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i] && rows[i][0];
    if (cell != null && String(cell).trim() !== '') lastFilled = i + 1; // 1-based
  }
  return lastFilled + 1;
}

export function buildReceiptRows({ receipt, startRow, tabName, sheetId, location, card }) {
  const firstItemRow = startRow + 1;
  const lastItemRow = startRow + receipt.items.length;

  const storeRow = [receipt.store, `=SUM(K${firstItemRow}:K${lastItemRow})`, receipt.date, location, card];
  const itemRows = receipt.items.map((it) => [it.name, it.price, '', it.category ?? '', '']);

  return {
    startRow,
    lastItemRow,
    valueRange: {
      range: `'${tabName}'!J${startRow}:N${lastItemRow}`,
      values: [storeRow, ...itemRows]
    },
    borderRequest: {
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: lastItemRow - 1,
          endRowIndex: lastItemRow,
          startColumnIndex: COL_J_INDEX,
          endColumnIndex: COL_N_END
        },
        bottom: { style: 'SOLID_THICK', color: { red: 0, green: 0, blue: 0 } }
      }
    }
  };
}

/**
 * @returns {Promise<{ plan: ReturnType<typeof buildReceiptRows>, applied: boolean }>}
 */
export async function writeReceipt(sheets, spreadsheetId, receipt, opts) {
  const { tabName, location, card, templateTab, create = true, dryRun = true } = opts;
  const tab = await resolveTab(sheets, spreadsheetId, tabName, { templateTab, create });
  const startRow = await findNextRow(sheets, spreadsheetId, tab.title);
  const plan = buildReceiptRows({ receipt, startRow, tabName: tab.title, sheetId: tab.sheetId, location, card });

  if (dryRun) return { plan, applied: false };

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: plan.valueRange.range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: plan.valueRange.values }
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [plan.borderRequest] }
  });
  return { plan, applied: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/sheets/writer.test.js`
Expected: PASS (all writer cases).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all test files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/sheets/writer.js src/lib/server/sheets/writer.test.js
git commit -m "feat(sheets): build receipt rows + border and guard writes behind dry-run"
```

---

### Task 13: End-to-end CLI dry-run + README

**Files:**
- Create: `cli.js`
- Create: `README.md`

**Interfaces:**
- Consumes: every module above + `node:fs`, `node:path`.
- Behavior: `node cli.js <receiptFile> [--commit] [--tab <name>] [--location <x>] [--card <y>]`
  - Loads settings (`data/settings.json`) merged with env vars.
  - Extracts text → parses via Ollama → applies learned categories.
  - Computes the target tab from today's date unless `--tab` is given.
  - Builds the write plan and prints it. With credentials it reads the live sheet for the real start row; without credentials it falls back to start row 2 and warns.
  - Writes **only** when `--commit` is passed AND credentials exist; otherwise dry-run.

- [ ] **Step 1: Implement `cli.js`**

```js
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { loadSettings } from './src/lib/server/settings/settings.js';
import { extractText } from './src/lib/server/extract/extract.js';
import { parseReceipt } from './src/lib/server/parse/parse.js';
import { applyCategories } from './src/lib/server/categorize/categorize.js';
import { tabNameForDate } from './src/lib/server/period/period.js';
import { createSheetsClient } from './src/lib/server/sheets/client.js';
import { writeReceipt, buildReceiptRows } from './src/lib/server/sheets/writer.js';

function arg(flag, fallback = undefined) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const hasFlag = (flag) => process.argv.includes(flag);

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith('--')) {
    console.error('Usage: node cli.js <receiptFile> [--commit] [--tab <name>] [--location <x>] [--card <y>]');
    process.exit(1);
  }

  const settings = await loadSettings('data/settings.json');
  const spreadsheetId = process.env.KVITTO_SPREADSHEET_ID || settings.sheet.spreadsheetId;
  const templateTab = process.env.KVITTO_TEMPLATE_TAB || settings.sheet.templateTab;
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const host = process.env.KVITTO_OLLAMA_HOST || settings.ollama.host;
  const model = process.env.KVITTO_OLLAMA_MODEL || settings.ollama.model;

  const buffer = await readFile(file);
  const { text, source } = await extractText({ buffer, filename: basename(file) });
  console.log(`\n[extract] source=${source}, ${text.length} chars`);

  const parsed = await parseReceipt(text, { host, model });
  const receipt = { ...parsed, items: applyCategories(parsed.items, settings.learnedCategories) };

  const tabName = arg('--tab') || tabNameForDate(new Date());
  const location = arg('--location', settings.lastUsed.location);
  const card = arg('--card', settings.lastUsed.card);
  const commit = hasFlag('--commit');

  console.log(`[receipt] ${receipt.store} | ${receipt.date} | total ${receipt.total}`);
  console.log(`[target ] tab=${tabName} location=${location} card=${card}`);

  if (spreadsheetId && keyFile) {
    const sheets = createSheetsClient({ keyFile });
    const result = await writeReceipt(sheets, spreadsheetId, receipt, {
      tabName, location, card, templateTab, create: true, dryRun: !commit
    });
    console.log(`\n[${result.applied ? 'WROTE' : 'DRY-RUN'}] ${result.plan.valueRange.range}`);
    console.table(result.plan.valueRange.values);
    if (!result.applied) console.log('(nothing written — pass --commit with credentials to write)');
  } else {
    const plan = buildReceiptRows({ receipt, startRow: 2, tabName, sheetId: 0, location, card });
    console.log('\n[DRY-RUN — no credentials; assuming start row 2]', plan.valueRange.range);
    console.table(plan.valueRange.values);
  }
}

main().catch((err) => { console.error('\n[error]', err.message); process.exit(1); });
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Kvitto — receipt importer (core engine)

Local-first engine that reads a grocery receipt (screenshot or PDF), parses it with
a local LLM (Ollama), and prints exactly what it would write to the Groceries block
of the right monthly tab in a Google Sheet. It writes nothing unless you pass `--commit`.

## Prerequisites
- Node.js 20+
- Ollama running locally with a model pulled (default `llama3.1:8b`):
  `ollama pull llama3.1:8b`
- (For real reads/writes) a Google service-account key JSON shared with the sheet.

## Setup
```bash
npm install
cp .env.example .env   # then fill in values; never commit the key file
```

## Usage (dry-run by default)
```bash
# Print what would be written (no credentials needed for a rough plan):
node cli.js path/to/receipt.png

# With credentials set in the environment, dry-run against the live sheet:
GOOGLE_APPLICATION_CREDENTIALS=./service-account.key.json \
KVITTO_SPREADSHEET_ID=... node cli.js path/to/receipt.pdf

# Actually write (explicit):
... node cli.js path/to/receipt.pdf --commit
```

## Tests
```bash
npm test
```
```

- [ ] **Step 3: Smoke-test the CLI without credentials**

Run: `node cli.js test/fixtures/sample.pdf` with Ollama running.
Expected: prints `[extract] source=pdf …`, a `[receipt]` line, and a `[DRY-RUN …]` table. Nothing is written.
(If Ollama is not running the command errors at the parse step with a clear message — that is acceptable for this step; the pipeline wiring is what we are verifying.)

- [ ] **Step 4: Commit**

```bash
git add cli.js README.md
git commit -m "feat(cli): end-to-end dry-run pipeline and project README"
```

---

## Self-Review

**Spec coverage:**
- Local OCR (Tesseract) → Task 7. PDF text layer → Task 6. Dispatch → Task 8.
- Local LLM parsing + categories → Task 9; category learning → Task 5.
- Pay-period tab logic (25th, naming, year-wrap) → Task 2.
- Tab create-from-template → Task 11.
- Write only J–N, store SUM row, item rows, separating bottom border → Task 12.
- No writes without explicit go-ahead (dry-run default, `--commit` gate) → Tasks 12, 13.
- Settings with confirmation toggles, last-used values, learned categories → Task 4.
- Service-account auth → Task 10.
- End-to-end runnable software → Task 13.
- **Deferred to Plan 2 (web app):** SvelteKit UI, clipboard/upload/watched-folder ingest, the multi-receipt queue, the confirmation toggles wired to UI, the email module placeholder. The `confirmations` settings and dry-run gate are already in place for the UI to consume.

**Placeholder scan:** No TBD/TODO; every code step contains complete code; every test contains real assertions.

**Type consistency:** `ReceiptData`/`ReceiptItem` shape is consistent across schema (Task 3), parse (Task 9), categorize (Task 5), and writer (Task 12). `CATEGORIES` is the single source of truth (Task 1) used by schema, prompt, and categorize. `createSheetsClient` (Task 10) returns the object consumed by tabs (Task 11) and writer (Task 12). `resolveTab` signature matches its use in `writeReceipt`.

## Notes for Plan 2 (SvelteKit app — written later)
- Wrap this engine; do not re-implement it. The UI imports from `src/lib/server/*`.
- Ingest: clipboard paste (client → POST), file upload, watched folder (`chokidar`).
- Queue with per-item pipeline state and per-item error capture.
- Review UI: edit items/categories, set store-row location + card (prefill from `lastUsed`), confirm tab; each confirmation skippable per `settings.confirmations`.
- Commit endpoint calls `writeReceipt(..., { dryRun: false })` only after explicit user action; persist corrections via `recordCorrection` + `saveSettings`.
- Open items still pending from the user: exact border/format details (+ the orange dots), the service-account key JSON, and which tab is the template.
```
