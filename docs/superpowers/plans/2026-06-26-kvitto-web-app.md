# Kvitto Web App Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local SvelteKit web app on top of the Plan 1 engine: ingest receipts (clipboard paste, file upload, watched folder) into a review queue, edit/confirm each, and commit to Google Sheets — writes happen only when the user clicks commit.

**Architecture:** Single SvelteKit process (adapter-node). All real logic lives in `src/lib/server/*` (queue, pipeline, service) and is unit-tested with Vitest; SvelteKit route handlers are thin wrappers that call the service and return JSON, verified by building + curl. The browser UI polls a small JSON API.

**Tech Stack:** SvelteKit + adapter-node, Svelte 5, Vite, Vitest, chokidar (folder watch), plus the Plan 1 modules (unpdf, tesseract.js, googleapis, Ollama).

## Global Constraints

- **Never write to the sheet except on an explicit user commit action.** Preview is dry-run; `commit` is the only write path and is triggered by the user clicking Commit (or the equivalent API call).
- **Only the Groceries block (columns J–N) is ever touched.** Columns A–I are never read-modify-written.
- **Categories (exact strings):** `Mat`, `Läsk/Snäx`, `Vård`, `Hem`.
- **Tab name format:** `YYYY-MM/MM`, pay-period start month, payday 25th; default tab = period containing today.
- **Template tab is named `Mall`** (does not exist yet; the user creates it later). Tab creation duplicates `Mall`.
- **Purchase separator:** thick black bottom border (`SOLID_THICK`) on the last item row, across J–N. No blank row. (Keep as-is; ignore the orange dots in the screenshot.)
- **Secrets never committed.** Service-account key at `credentials.json` (gitignored).
- **All logic in `src/lib/server/*` is Vitest-tested; route handlers stay thin.** Keep `vitest.config.js` separate from `vite.config.js` so the SvelteKit plugin never loads during tests.
- ESM everywhere. Frequent, small commits.

## File Structure

```
svelte.config.js                         # adapter-node
vite.config.js                           # sveltekit() plugin (dev/build only)
vitest.config.js                         # unchanged: node env, src/**/*.test.js
src/
  app.html
  app.css
  hooks.server.js                        # start folder watcher once
  routes/
    +layout.svelte
    +page.svelte                         # main UI: ingest + queue + review
    api/
      receipts/+server.js                # GET list, POST ingest (multipart 'file')
      receipts/[id]/+server.js           # GET one, PATCH edit, DELETE
      receipts/[id]/preview/+server.js   # GET dry-run plan
      receipts/[id]/commit/+server.js    # POST real write
      settings/+server.js                # GET, PUT
      tabs/+server.js                    # GET existing tabs (read-only)
  lib/
    components/
      ReceiptCard.svelte                 # one queue item summary
      ReceiptReview.svelte               # edit form + preview + commit
      SettingsPanel.svelte               # settings form
    client/api.js                        # tiny fetch wrappers for the UI
    server/
      queue/queue.js                     # in-memory queue (NEW)
      queue/queue.test.js
      pipeline.js                        # extract->parse->categorize (NEW)
      pipeline.test.js
      service.js                         # orchestration used by routes (NEW)
      service.test.js
      ingest/watcher.js                  # chokidar wiring + handleNewFile (NEW)
      ingest/watcher.test.js
      settings/settings.js               # MODIFY: add updateSettings
      app.js                             # singleton service from env (NEW)
```

---

### Task 1: SvelteKit scaffold

**Files:**
- Modify: `package.json` (scripts + deps)
- Create: `svelte.config.js`, `vite.config.js`, `src/app.html`, `src/app.css`
- Create: `src/routes/+layout.svelte`, `src/routes/+page.svelte`

**Interfaces:**
- Produces: a buildable SvelteKit app; existing Vitest suite still passes because `vitest.config.js` (separate file) keeps precedence and never loads the SvelteKit plugin.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install -D @sveltejs/kit @sveltejs/vite-plugin-svelte svelte vite
npm install @sveltejs/adapter-node chokidar
```
Expected: installs succeed.

- [ ] **Step 2: Add scripts to `package.json`**

Merge these into the existing `"scripts"` block (keep `test`/`test:watch`/`cli`):
```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "cli": "node cli.js"
  }
}
```

- [ ] **Step 3: Create `svelte.config.js`**

```js
import adapter from '@sveltejs/adapter-node';

export default {
  kit: { adapter: adapter() }
};
```

- [ ] **Step 4: Create `vite.config.js`**

```js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Note: vitest uses vitest.config.js (which takes precedence), so the SvelteKit
// plugin here never loads during `npm test`.
export default defineConfig({
  plugins: [sveltekit()]
});
```

- [ ] **Step 5: Create `src/app.html`**

```html
<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 6: Create `src/app.css`**

```css
:root { font-family: system-ui, sans-serif; color: #1a1a1a; }
body { margin: 0; background: #f7f7f8; }
button { cursor: pointer; }
.kv-container { max-width: 1100px; margin: 0 auto; padding: 16px; }
```

- [ ] **Step 7: Create `src/routes/+layout.svelte`**

```svelte
<script>
  import '../app.css';
  let { children } = $props();
</script>

<div class="kv-container">
  <h1>Kvitto</h1>
  {@render children()}
</div>
```

- [ ] **Step 8: Create `src/routes/+page.svelte`**

```svelte
<p>Kvitto-appen är igång.</p>
```

- [ ] **Step 9: Verify build and existing tests**

Run:
```bash
npm run build
npm test
```
Expected: `npm run build` completes (creates `build/`); `npm test` shows 41 passed (unchanged).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json svelte.config.js vite.config.js src/app.html src/app.css src/routes/
git commit -m "feat(web): scaffold SvelteKit app with adapter-node"
```

---

### Task 2: settings.updateSettings

**Files:**
- Modify: `src/lib/server/settings/settings.js`
- Modify: `src/lib/server/settings/settings.test.js`

**Interfaces:**
- Produces: `updateSettings(filePath: string, patch: object): Promise<Settings>` — loads, deep-merges patch over current, saves, returns merged.

- [ ] **Step 1: Add the failing test (append to `settings.test.js`)**

```js
import { updateSettings } from './settings.js';

describe('updateSettings', () => {
  it('deep-merges a patch and persists it', async () => {
    const dir2 = await mkdtemp(join(tmpdir(), 'kvitto-'));
    const f = join(dir2, 's.json');
    await updateSettings(f, { lastUsed: { location: 'Stockholm' } });
    const merged = await updateSettings(f, { lastUsed: { card: 'Skandia' } });
    expect(merged.lastUsed).toEqual({ location: 'Stockholm', card: 'Skandia' });
    const reloaded = await loadSettings(f);
    expect(reloaded.lastUsed).toEqual({ location: 'Stockholm', card: 'Skandia' });
    await rm(dir2, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/settings/settings.test.js`
Expected: FAIL with "updateSettings is not a function" / import error.

- [ ] **Step 3: Implement (append to `settings.js`)**

```js
export async function updateSettings(filePath, patch) {
  const current = await loadSettings(filePath);
  const merged = deepMerge(current, patch);
  await saveSettings(filePath, merged);
  return merged;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/settings/settings.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/settings/
git commit -m "feat(settings): add updateSettings deep-merge helper"
```

---

### Task 3: In-memory receipt queue

**Files:**
- Create: `src/lib/server/queue/queue.js`
- Test: `src/lib/server/queue/queue.test.js`

**Interfaces:**
- Produces: `createQueue()` returning `{ add, list, get, update, remove }`.
  - `add({ filename, mimetype, buffer, source }) -> item`
  - item shape: `{ id, filename, mimetype, buffer, source, status:'pending', error:null, text:null, receipt:null, meta:null, createdAt }`
  - `list() -> item[]` (oldest first), `get(id) -> item|null`, `update(id, patch) -> item|null`, `remove(id) -> boolean`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { createQueue } from './queue.js';

describe('createQueue', () => {
  it('adds items with an id and pending status', () => {
    const q = createQueue();
    const item = q.add({ filename: 'a.png', mimetype: 'image/png', buffer: Buffer.from('x'), source: 'upload' });
    expect(item.id).toBeTruthy();
    expect(item.status).toBe('pending');
    expect(q.get(item.id)).toBe(item);
  });

  it('lists items oldest-first and updates and removes', () => {
    const q = createQueue();
    const a = q.add({ filename: 'a', mimetype: 'image/png', buffer: Buffer.from('1'), source: 'upload' });
    const b = q.add({ filename: 'b', mimetype: 'image/png', buffer: Buffer.from('2'), source: 'upload' });
    expect(q.list().map((i) => i.id)).toEqual([a.id, b.id]);
    const updated = q.update(a.id, { status: 'ready' });
    expect(updated.status).toBe('ready');
    expect(q.remove(a.id)).toBe(true);
    expect(q.get(a.id)).toBeNull();
  });

  it('returns null when updating or getting an unknown id', () => {
    const q = createQueue();
    expect(q.get('nope')).toBeNull();
    expect(q.update('nope', { status: 'ready' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/queue/queue.test.js`
Expected: FAIL with import error.

- [ ] **Step 3: Implement `src/lib/server/queue/queue.js`**

```js
import { randomUUID } from 'node:crypto';

export function createQueue() {
  const items = new Map();
  return {
    add({ filename, mimetype, buffer, source }) {
      const id = randomUUID();
      const item = {
        id, filename, mimetype, buffer, source,
        status: 'pending', error: null, text: null, receipt: null, meta: null,
        createdAt: Date.now()
      };
      items.set(id, item);
      return item;
    },
    list() {
      return [...items.values()].sort((a, b) => a.createdAt - b.createdAt);
    },
    get(id) {
      return items.get(id) || null;
    },
    update(id, patch) {
      const it = items.get(id);
      if (!it) return null;
      Object.assign(it, patch);
      return it;
    },
    remove(id) {
      return items.delete(id);
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/queue/queue.test.js`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/queue/
git commit -m "feat(queue): in-memory receipt queue"
```

---

### Task 4: Pipeline (extract → parse → categorize)

**Files:**
- Create: `src/lib/server/pipeline.js`
- Test: `src/lib/server/pipeline.test.js`

**Interfaces:**
- Consumes: `extractText`, `parseReceipt`, `applyCategories` (overridable via `deps`).
- Produces: `processReceipt(item, { settings, deps? }): Promise<{ status, text?, receipt?, source?, error? }>`
  - success → `{ status:'ready', text, receipt, source, error:null }`
  - failure → `{ status:'error', error: <message> }`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { processReceipt } from './pipeline.js';

const settings = {
  ollama: { host: 'http://h:11434', model: 'm' },
  learnedCategories: { banan: 'Mat' }
};
const item = { buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf' };

describe('processReceipt', () => {
  it('returns a ready receipt with categories applied', async () => {
    const deps = {
      extractText: vi.fn().mockResolvedValue({ text: 'RAW', source: 'pdf' }),
      parseReceipt: vi.fn().mockResolvedValue({
        store: 'Maxi', date: '2026-04-24', total: 24.18,
        items: [{ name: 'Banan', price: 24.18, category: null }]
      }),
      applyCategories: (items, learned) =>
        items.map((i) => ({ ...i, category: learned[i.name.toLowerCase()] ?? i.category }))
    };
    const r = await processReceipt(item, { settings, deps });
    expect(r.status).toBe('ready');
    expect(r.source).toBe('pdf');
    expect(r.receipt.items[0].category).toBe('Mat');
    expect(deps.parseReceipt).toHaveBeenCalledWith('RAW', { host: 'http://h:11434', model: 'm' });
  });

  it('captures errors without throwing', async () => {
    const deps = { extractText: vi.fn().mockRejectedValue(new Error('no text layer')) };
    const r = await processReceipt(item, { settings, deps });
    expect(r.status).toBe('error');
    expect(r.error).toMatch(/no text layer/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/pipeline.test.js`
Expected: FAIL with import error.

- [ ] **Step 3: Implement `src/lib/server/pipeline.js`**

```js
import { extractText } from './extract/extract.js';
import { parseReceipt } from './parse/parse.js';
import { applyCategories } from './categorize/categorize.js';

/**
 * @param {{buffer:Buffer,filename?:string,mimetype?:string}} item
 * @param {{ settings: any, deps?: any }} ctx
 */
export async function processReceipt(item, { settings, deps = {} }) {
  const extract = deps.extractText || extractText;
  const parse = deps.parseReceipt || parseReceipt;
  const apply = deps.applyCategories || applyCategories;
  try {
    const { text, source } = await extract({
      buffer: item.buffer, filename: item.filename, mimetype: item.mimetype
    });
    const parsed = await parse(text, { host: settings.ollama.host, model: settings.ollama.model });
    const receipt = { ...parsed, items: apply(parsed.items, settings.learnedCategories) };
    return { status: 'ready', text, receipt, source, error: null };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/pipeline.test.js`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/pipeline.js src/lib/server/pipeline.test.js
git commit -m "feat(pipeline): orchestrate extract/parse/categorize per receipt"
```

---

### Task 5: Service layer

**Files:**
- Create: `src/lib/server/service.js`
- Test: `src/lib/server/service.test.js`

**Interfaces:**
- Consumes: `createQueue`, `processReceipt`, `loadSettings`/`updateSettings`, `recordCorrection`, `tabNameForDate`, `writeReceipt`, `listTabs`, `createSheetsClient`.
- Produces: `createService(config)` where `config = { settingsPath, spreadsheetId, templateTab, keyFile, now?, deps? }`.
  - `deps` may override: `processReceipt`, `createSheetsClient`, `loadSettings`, `updateSettings`.
  - Methods:
    - `ingest({ buffer, filename, mimetype, source }): Promise<PublicItem>` — adds, processes, sets `meta` defaults (`location`/`card` from `lastUsed`, `tab` from `now`).
    - `listPublic(): PublicItem[]`, `getPublic(id): PublicItem|null`
    - `update(id, { receipt?, meta? }): PublicItem|null`
    - `remove(id): boolean`
    - `preview(id): Promise<{ plan }>` — `writeReceipt(dryRun:true)`
    - `commit(id): Promise<{ applied, plan }>` — `writeReceipt(dryRun:false)`, records each item's category as a correction, updates `lastUsed`, marks item `committed`.
    - `getSettings(): Promise<Settings>`, `updateSettings(patch): Promise<Settings>`
    - `listSheetTabs(): Promise<{title,sheetId}[]>`
  - `PublicItem = { id, filename, source, status, error, text, receipt, meta }` (no `buffer`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createService } from './service.js';

let dir, settingsPath;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'kvitto-')); settingsPath = join(dir, 's.json'); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

const readyReceipt = {
  store: 'Willys', date: '2026-04-24', total: 19.9,
  items: [{ name: 'Mjölk', price: 19.9, category: 'Mat' }]
};

function baseConfig(extra = {}) {
  return {
    settingsPath, spreadsheetId: 'SID', templateTab: 'Mall', keyFile: 'k.json',
    now: () => new Date('2026-06-26T10:00:00'),
    deps: {
      processReceipt: vi.fn().mockResolvedValue({ status: 'ready', text: 'RAW', source: 'pdf', receipt: readyReceipt }),
      createSheetsClient: vi.fn().mockReturnValue({ __sheets: true }),
      ...extra
    }
  };
}

describe('service.ingest', () => {
  it('processes a receipt and sets meta defaults (tab from now, location/card from lastUsed)', async () => {
    const svc = createService(baseConfig());
    await svc.updateSettings({ lastUsed: { location: 'Stockholm', card: 'Skandia' } });
    const item = await svc.ingest({ buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf', source: 'upload' });
    expect(item.status).toBe('ready');
    expect(item.receipt.store).toBe('Willys');
    expect(item.meta).toEqual({ location: 'Stockholm', card: 'Skandia', tab: '2026-06/07' });
    expect(item.buffer).toBeUndefined();
  });
});

describe('service.commit', () => {
  it('writes (dryRun false), records corrections, updates lastUsed, marks committed', async () => {
    const writeReceipt = vi.fn().mockResolvedValue({ applied: true, plan: { valueRange: { range: "'2026-06/07'!J2:N3" } } });
    const svc = createService(baseConfig({ writeReceipt }));
    const item = await svc.ingest({ buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf', source: 'upload' });
    svc.update(item.id, { meta: { location: 'Göteborg', card: 'Amex', tab: '2026-06/07' } });

    const res = await svc.commit(item.id);
    expect(res.applied).toBe(true);
    expect(writeReceipt).toHaveBeenCalledWith(
      { __sheets: true }, 'SID', readyReceipt,
      expect.objectContaining({ tabName: '2026-06/07', location: 'Göteborg', card: 'Amex', templateTab: 'Mall', dryRun: false })
    );
    expect(svc.getPublic(item.id).status).toBe('committed');

    const s = await svc.getSettings();
    expect(s.learnedCategories['mjölk']).toBe('Mat');
    expect(s.lastUsed).toEqual({ location: 'Göteborg', card: 'Amex' });
  });
});

describe('service.preview', () => {
  it('calls writeReceipt with dryRun true', async () => {
    const writeReceipt = vi.fn().mockResolvedValue({ applied: false, plan: { valueRange: { range: 'X' } } });
    const svc = createService(baseConfig({ writeReceipt }));
    const item = await svc.ingest({ buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf', source: 'upload' });
    await svc.preview(item.id);
    expect(writeReceipt).toHaveBeenCalledWith(
      { __sheets: true }, 'SID', readyReceipt, expect.objectContaining({ dryRun: true })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/service.test.js`
Expected: FAIL with import error.

- [ ] **Step 3: Implement `src/lib/server/service.js`**

```js
import { createQueue } from './queue/queue.js';
import { processReceipt as defaultProcess } from './pipeline.js';
import { loadSettings, updateSettings as defaultUpdate } from './settings/settings.js';
import { recordCorrection } from './categorize/categorize.js';
import { tabNameForDate } from './period/period.js';
import { writeReceipt as defaultWrite } from './sheets/writer.js';
import { listTabs } from './sheets/tabs.js';
import { createSheetsClient as defaultCreateClient } from './sheets/client.js';

function publicItem(it) {
  if (!it) return null;
  const { buffer, mimetype, createdAt, ...pub } = it;
  return pub;
}

export function createService(config) {
  const {
    settingsPath, spreadsheetId, templateTab, keyFile,
    now = () => new Date(), deps = {}
  } = config;

  const queue = createQueue();
  const process = deps.processReceipt || defaultProcess;
  const updateSettingsFn = deps.updateSettings || defaultUpdate;
  const createClient = deps.createSheetsClient || defaultCreateClient;
  const write = deps.writeReceipt || defaultWrite;

  const getSettings = () => loadSettings(settingsPath);
  const sheets = () => createClient({ keyFile });

  async function ingest({ buffer, filename, mimetype, source }) {
    const item = queue.add({ filename, mimetype, buffer, source });
    const settings = await getSettings();
    const result = await process(item, { settings });
    queue.update(item.id, result);
    queue.update(item.id, {
      meta: {
        location: settings.lastUsed.location,
        card: settings.lastUsed.card,
        tab: tabNameForDate(now())
      }
    });
    return publicItem(queue.get(item.id));
  }

  return {
    ingest,
    listPublic: () => queue.list().map(publicItem),
    getPublic: (id) => publicItem(queue.get(id)),
    update: (id, patch) => publicItem(queue.update(id, patch)),
    remove: (id) => queue.remove(id),

    async preview(id) {
      const it = queue.get(id);
      const { location, card, tab } = it.meta;
      const result = await write(sheets(), spreadsheetId, it.receipt, {
        tabName: tab, location, card, templateTab, create: true, dryRun: true
      });
      return result;
    },

    async commit(id) {
      const it = queue.get(id);
      const { location, card, tab } = it.meta;
      const result = await write(sheets(), spreadsheetId, it.receipt, {
        tabName: tab, location, card, templateTab, create: true, dryRun: false
      });
      const settings = await getSettings();
      let learned = settings.learnedCategories;
      for (const line of it.receipt.items) {
        if (line.category) learned = recordCorrection(learned, line.name, line.category);
      }
      await updateSettingsFn(settingsPath, { learnedCategories: learned, lastUsed: { location, card } });
      queue.update(id, { status: 'committed' });
      return result;
    },

    getSettings,
    updateSettings: (patch) => updateSettingsFn(settingsPath, patch),
    async listSheetTabs() {
      return listTabs(sheets(), spreadsheetId);
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/service.test.js`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/service.js src/lib/server/service.test.js
git commit -m "feat(service): orchestrate queue, pipeline, settings and sheets"
```

---

### Task 6: Folder watcher

**Files:**
- Create: `src/lib/server/ingest/watcher.js`
- Test: `src/lib/server/ingest/watcher.test.js`

**Interfaces:**
- Produces:
  - `mimeFromName(name: string): string|null` — `.pdf`→`application/pdf`, `.png`→`image/png`, `.jpg`/`.jpeg`→`image/jpeg`, else `null`.
  - `handleNewFile(path, { readFile, ingest }): Promise<void>` — ignores unsupported extensions; otherwise reads the file and calls `ingest({ buffer, filename, mimetype, source:'folder' })`.
  - `startWatcher(folder, { ingest, watch? }): watcher` — wires chokidar `add` events to `handleNewFile`. `watch` injectable.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { mimeFromName, handleNewFile } from './watcher.js';

describe('mimeFromName', () => {
  it('maps known receipt extensions', () => {
    expect(mimeFromName('a.PDF')).toBe('application/pdf');
    expect(mimeFromName('a.png')).toBe('image/png');
    expect(mimeFromName('a.jpeg')).toBe('image/jpeg');
    expect(mimeFromName('a.txt')).toBeNull();
  });
});

describe('handleNewFile', () => {
  it('reads and ingests a supported file', async () => {
    const ingest = vi.fn().mockResolvedValue({});
    const readFile = vi.fn().mockResolvedValue(Buffer.from('data'));
    await handleNewFile('/dir/kvitto.png', { readFile, ingest });
    expect(ingest).toHaveBeenCalledWith({
      buffer: Buffer.from('data'), filename: 'kvitto.png', mimetype: 'image/png', source: 'folder'
    });
  });

  it('ignores unsupported files', async () => {
    const ingest = vi.fn();
    const readFile = vi.fn();
    await handleNewFile('/dir/notes.txt', { readFile, ingest });
    expect(readFile).not.toHaveBeenCalled();
    expect(ingest).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/ingest/watcher.test.js`
Expected: FAIL with import error.

- [ ] **Step 3: Implement `src/lib/server/ingest/watcher.js`**

```js
import { readFile as fsReadFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import chokidar from 'chokidar';

const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

export function mimeFromName(name) {
  return MIME[extname(name).toLowerCase()] || null;
}

export async function handleNewFile(path, { readFile = fsReadFile, ingest }) {
  const mimetype = mimeFromName(path);
  if (!mimetype) return;
  const buffer = await readFile(path);
  await ingest({ buffer, filename: basename(path), mimetype, source: 'folder' });
}

export function startWatcher(folder, { ingest, watch = chokidar.watch }) {
  const watcher = watch(folder, { ignoreInitial: true });
  watcher.on('add', (path) => {
    handleNewFile(path, { ingest }).catch((err) => console.error('[watcher]', err.message));
  });
  console.log(`[watcher] watching ${folder}`);
  return watcher;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/ingest/watcher.test.js`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/ingest/
git commit -m "feat(ingest): watched-folder handler and chokidar wiring"
```

---

### Task 7: Singleton + hooks + API routes

**Files:**
- Create: `src/lib/server/app.js`
- Create: `src/hooks.server.js`
- Create: `src/routes/api/receipts/+server.js`
- Create: `src/routes/api/receipts/[id]/+server.js`
- Create: `src/routes/api/receipts/[id]/preview/+server.js`
- Create: `src/routes/api/receipts/[id]/commit/+server.js`
- Create: `src/routes/api/settings/+server.js`
- Create: `src/routes/api/tabs/+server.js`

**Interfaces:**
- Consumes: `createService`.
- Produces: a shared `service` singleton and a JSON API:
  - `GET /api/receipts` → `PublicItem[]`; `POST /api/receipts` (multipart, field `file`) → `PublicItem`
  - `GET /api/receipts/:id` → `PublicItem`; `PATCH` (JSON `{receipt?,meta?}`) → `PublicItem`; `DELETE` → `{ok:true}`
  - `GET /api/receipts/:id/preview` → `{ plan }`; `POST /api/receipts/:id/commit` → `{ applied, plan }`
  - `GET /api/settings` → `Settings`; `PUT` (JSON patch) → `Settings`
  - `GET /api/tabs` → `{title,sheetId}[]`

- [ ] **Step 1: Implement `src/lib/server/app.js`**

```js
import { createService } from './service.js';

export const service = createService({
  settingsPath: 'data/settings.json',
  spreadsheetId: process.env.KVITTO_SPREADSHEET_ID || '',
  templateTab: process.env.KVITTO_TEMPLATE_TAB || 'Mall',
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'credentials.json'
});
```

- [ ] **Step 2: Implement `src/hooks.server.js`**

```js
import { service } from '$lib/server/app.js';
import { startWatcher } from '$lib/server/ingest/watcher.js';

let started = false;
async function startOnce() {
  if (started) return;
  started = true;
  const settings = await service.getSettings();
  const folder = settings.watchFolder;
  if (folder) {
    startWatcher(folder, { ingest: (input) => service.ingest(input) });
  }
}
startOnce();

export async function handle({ event, resolve }) {
  return resolve(event);
}
```

- [ ] **Step 3: Implement `src/routes/api/receipts/+server.js`**

```js
import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function GET() {
  return json(service.listPublic());
}

export async function POST({ request }) {
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'no file' }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const item = await service.ingest({
    buffer, filename: file.name || 'pasted', mimetype: file.type || 'application/octet-stream', source: 'upload'
  });
  return json(item);
}
```

- [ ] **Step 4: Implement `src/routes/api/receipts/[id]/+server.js`**

```js
import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function GET({ params }) {
  const item = service.getPublic(params.id);
  return item ? json(item) : json({ error: 'not found' }, { status: 404 });
}

export async function PATCH({ params, request }) {
  const patch = await request.json();
  const item = service.update(params.id, patch);
  return item ? json(item) : json({ error: 'not found' }, { status: 404 });
}

export async function DELETE({ params }) {
  return json({ ok: service.remove(params.id) });
}
```

- [ ] **Step 5: Implement `src/routes/api/receipts/[id]/preview/+server.js`**

```js
import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function GET({ params }) {
  try {
    return json(await service.preview(params.id));
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 6: Implement `src/routes/api/receipts/[id]/commit/+server.js`**

```js
import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function POST({ params }) {
  try {
    return json(await service.commit(params.id));
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 7: Implement `src/routes/api/settings/+server.js`**

```js
import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function GET() {
  return json(await service.getSettings());
}

export async function PUT({ request }) {
  const patch = await request.json();
  return json(await service.updateSettings(patch));
}
```

- [ ] **Step 8: Implement `src/routes/api/tabs/+server.js`**

```js
import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function GET() {
  try {
    return json(await service.listSheetTabs());
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 9: Build and smoke-test the API**

Run:
```bash
npm run build
npx vite preview --port 4173 &   # or: npm run dev -- --port 5173
sleep 3
curl -s http://localhost:4173/api/settings
curl -s http://localhost:4173/api/tabs
curl -s -F "file=@test/fixtures/sample.pdf" http://localhost:4173/api/receipts
curl -s http://localhost:4173/api/receipts
```
Expected: `/api/settings` returns JSON settings; `/api/tabs` returns `[{"title":"Sheet1","sheetId":0}]` (with credentials present); the POST returns a `ready` item with a parsed `receipt`; the list shows it. Stop the server afterward.

- [ ] **Step 10: Commit**

```bash
git add src/lib/server/app.js src/hooks.server.js src/routes/api/
git commit -m "feat(api): receipts/settings/tabs endpoints over the service"
```

---

### Task 8: Frontend — ingest, queue, review, commit

**Files:**
- Create: `src/lib/client/api.js`
- Create: `src/lib/components/ReceiptCard.svelte`
- Create: `src/lib/components/ReceiptReview.svelte`
- Modify: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: the JSON API from Task 7.
- Produces: a working single-page UI: paste (Ctrl+V) / file picker / drag-drop to ingest; a queue list; a review panel to edit the selected receipt, preview the dry-run plan, and commit.

- [ ] **Step 1: Implement `src/lib/client/api.js`**

```js
const j = (r) => r.json();

export const api = {
  list: () => fetch('/api/receipts').then(j),
  get: (id) => fetch(`/api/receipts/${id}`).then(j),
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch('/api/receipts', { method: 'POST', body: fd }).then(j);
  },
  patch: (id, patch) =>
    fetch(`/api/receipts/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) }).then(j),
  remove: (id) => fetch(`/api/receipts/${id}`, { method: 'DELETE' }).then(j),
  preview: (id) => fetch(`/api/receipts/${id}/preview`).then(j),
  commit: (id) => fetch(`/api/receipts/${id}/commit`, { method: 'POST' }).then(j),
  settings: () => fetch('/api/settings').then(j),
  saveSettings: (patch) =>
    fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) }).then(j),
  tabs: () => fetch('/api/tabs').then(j)
};

export const CATEGORIES = ['Mat', 'Läsk/Snäx', 'Vård', 'Hem'];
```

- [ ] **Step 2: Implement `src/lib/components/ReceiptCard.svelte`**

```svelte
<script>
  let { item, selected, onselect } = $props();
  const badge = { pending: '⏳', ready: '✅', error: '⚠️', committed: '💾' };
</script>

<button class="card" class:selected onclick={() => onselect(item.id)}>
  <span>{badge[item.status] ?? ''}</span>
  <strong>{item.receipt?.store ?? item.filename}</strong>
  <small>{item.status}{item.error ? `: ${item.error}` : ''}</small>
</button>

<style>
  .card { display: flex; gap: 8px; align-items: center; width: 100%; text-align: left;
    padding: 8px; border: 1px solid #ddd; border-radius: 8px; background: #fff; margin-bottom: 6px; }
  .card.selected { border-color: #2b6cb0; box-shadow: 0 0 0 2px #bee3f8; }
  small { color: #666; margin-left: auto; }
</style>
```

- [ ] **Step 3: Implement `src/lib/components/ReceiptReview.svelte`**

```svelte
<script>
  import { CATEGORIES, api } from '$lib/client/api.js';
  let { item, tabs, onchange } = $props();

  let receipt = $state(structuredClone(item.receipt));
  let meta = $state(structuredClone(item.meta));
  let preview = $state(null);
  let busy = $state(false);
  let message = $state('');

  $effect(() => { receipt = structuredClone(item.receipt); meta = structuredClone(item.meta); preview = null; message = ''; });

  async function save() {
    busy = true;
    await api.patch(item.id, { receipt, meta });
    busy = false;
    onchange?.();
  }
  async function doPreview() {
    await save();
    busy = true;
    const r = await api.preview(item.id);
    preview = r.error ? null : r.plan;
    message = r.error ? `Förhandsvisning misslyckades: ${r.error}` : '';
    busy = false;
  }
  async function doCommit() {
    await save();
    busy = true;
    const r = await api.commit(item.id);
    message = r.error ? `Commit misslyckades: ${r.error}` : `Skrev ${r.plan?.valueRange?.range ?? ''}`;
    busy = false;
    onchange?.();
  }
</script>

{#if receipt}
  <div class="review">
    <div class="row">
      <label>Butik <input bind:value={receipt.store} /></label>
      <label>Datum <input bind:value={receipt.date} /></label>
    </div>
    <div class="row">
      <label>Plats (M) <input bind:value={meta.location} /></label>
      <label>Köpt med (N) <input bind:value={meta.card} /></label>
      <label>Flik
        <select bind:value={meta.tab}>
          {#if !tabs?.some((t) => t.title === meta.tab)}<option value={meta.tab}>{meta.tab} (skapas)</option>{/if}
          {#each tabs ?? [] as t}<option value={t.title}>{t.title}</option>{/each}
        </select>
      </label>
    </div>

    <table>
      <thead><tr><th>Vara</th><th>Pris</th><th>Kategori</th></tr></thead>
      <tbody>
        {#each receipt.items as line}
          <tr>
            <td><input bind:value={line.name} /></td>
            <td><input type="number" step="0.01" bind:value={line.price} /></td>
            <td>
              <select bind:value={line.category}>
                <option value={null}>—</option>
                {#each CATEGORIES as c}<option value={c}>{c}</option>{/each}
              </select>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <div class="actions">
      <button onclick={save} disabled={busy}>Spara</button>
      <button onclick={doPreview} disabled={busy}>Förhandsgranska (dry-run)</button>
      <button onclick={doCommit} disabled={busy || item.status === 'committed'}>Skriv till Sheet</button>
    </div>

    {#if message}<p class="msg">{message}</p>{/if}
    {#if preview}
      <h4>Skulle skriva {preview.valueRange.range}</h4>
      <table>
        <tbody>
          {#each preview.valueRange.values as r}
            <tr>{#each r as c}<td>{c}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}

<style>
  .review { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
  label { display: flex; flex-direction: column; font-size: 12px; color: #555; gap: 2px; }
  input, select { padding: 4px 6px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td, th { border: 1px solid #eee; padding: 4px; text-align: left; }
  .actions { display: flex; gap: 8px; margin-top: 8px; }
  .msg { color: #2b6cb0; }
</style>
```

- [ ] **Step 4: Implement `src/routes/+page.svelte`**

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { api } from '$lib/client/api.js';
  import ReceiptCard from '$lib/components/ReceiptCard.svelte';
  import ReceiptReview from '$lib/components/ReceiptReview.svelte';

  let items = $state([]);
  let tabs = $state([]);
  let selectedId = $state(null);
  let dragOver = $state(false);
  let timer;

  const selected = $derived(items.find((i) => i.id === selectedId) ?? null);

  async function refresh() { items = await api.list(); }

  onMount(async () => {
    await refresh();
    try { tabs = await api.tabs(); } catch { tabs = []; }
    timer = setInterval(refresh, 2000);
  });
  onDestroy(() => clearInterval(timer));

  async function uploadFiles(files) {
    for (const f of files) {
      const item = await api.upload(f);
      selectedId = item.id;
    }
    await refresh();
  }

  function onPaste(e) {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) { e.preventDefault(); uploadFiles(files); }
  }
  function onDrop(e) {
    e.preventDefault(); dragOver = false;
    uploadFiles([...(e.dataTransfer?.files ?? [])]);
  }
</script>

<svelte:window on:paste={onPaste} />

<div
  class="dropzone" class:over={dragOver}
  role="button" tabindex="0"
  ondragover={(e) => { e.preventDefault(); dragOver = true; }}
  ondragleave={() => (dragOver = false)}
  ondrop={onDrop}
>
  Klistra in (Ctrl+V), släpp filer här, eller
  <input type="file" multiple accept="image/*,application/pdf"
    onchange={(e) => uploadFiles([...e.currentTarget.files])} />
  <a href="/settings">Inställningar</a>
</div>

<div class="grid">
  <div class="queue">
    {#each items as item (item.id)}
      <ReceiptCard {item} selected={item.id === selectedId} onselect={(id) => (selectedId = id)} />
    {/each}
    {#if items.length === 0}<p>Inga kvitton i kön ännu.</p>{/if}
  </div>
  <div>
    {#if selected && selected.status === 'ready'}
      <ReceiptReview item={selected} {tabs} onchange={refresh} />
    {:else if selected}
      <p>Status: {selected.status}{selected.error ? ` — ${selected.error}` : ''}</p>
    {:else}
      <p>Välj ett kvitto i kön.</p>
    {/if}
  </div>
</div>

<style>
  .dropzone { border: 2px dashed #cbd5e0; border-radius: 8px; padding: 16px; margin-bottom: 16px;
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap; background: #fff; }
  .dropzone.over { border-color: #2b6cb0; background: #ebf8ff; }
  .grid { display: grid; grid-template-columns: 320px 1fr; gap: 16px; }
</style>
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev` and open the shown URL. With Ollama running and `credentials.json` present:
1. Drag `test/fixtures/sample.pdf` (or pick it) → a card appears, turns ✅ ready.
2. Select it → review form shows store/date/items; tab defaults to the current period.
3. Click **Förhandsgranska** → a dry-run table appears; nothing is written.
Expected: all three work. Stop the server afterward.

- [ ] **Step 6: Commit**

```bash
git add src/lib/client/ src/lib/components/ReceiptCard.svelte src/lib/components/ReceiptReview.svelte src/routes/+page.svelte
git commit -m "feat(web): ingest, queue, review and dry-run preview UI"
```

---

### Task 9: Frontend — settings page + README + end-to-end check

**Files:**
- Create: `src/lib/components/SettingsPanel.svelte`
- Create: `src/routes/settings/+page.svelte`
- Modify: `README.md`

**Interfaces:**
- Consumes: `/api/settings`.
- Produces: a settings page to edit confirmation toggles, last-used values, sheet config (spreadsheetId/templateTab), Ollama config, and the watch folder.

- [ ] **Step 1: Implement `src/lib/components/SettingsPanel.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/client/api.js';

  let s = $state(null);
  let saved = $state(false);

  onMount(async () => { s = await api.settings(); });

  async function save() {
    s = await api.saveSettings(s);
    saved = true;
    setTimeout(() => (saved = false), 1500);
  }
</script>

{#if s}
  <div class="panel">
    <h3>Bekräftelser (stäng av för express-läge)</h3>
    {#each Object.keys(s.confirmations) as key}
      <label><input type="checkbox" bind:checked={s.confirmations[key]} /> {key}</label>
    {/each}

    <h3>Senast använt</h3>
    <label>Plats <input bind:value={s.lastUsed.location} /></label>
    <label>Köpt med <input bind:value={s.lastUsed.card} /></label>

    <h3>Sheet</h3>
    <label>Spreadsheet-ID <input bind:value={s.sheet.spreadsheetId} /></label>
    <label>Mall-flik <input bind:value={s.sheet.templateTab} /></label>

    <h3>Ollama</h3>
    <label>Host <input bind:value={s.ollama.host} /></label>
    <label>Modell <input bind:value={s.ollama.model} /></label>

    <h3>Bevakad mapp</h3>
    <label>Sökväg <input bind:value={s.watchFolder} placeholder="t.ex. C:\\Users\\omar\\kvitton" /></label>

    <div class="actions">
      <button onclick={save}>Spara</button>
      {#if saved}<span class="ok">Sparat ✓</span>{/if}
      <a href="/">Tillbaka</a>
    </div>
  </div>
{/if}

<style>
  .panel { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px; max-width: 560px; }
  label { display: flex; gap: 8px; align-items: center; margin: 4px 0; }
  input[type='text'], input:not([type]) { flex: 1; padding: 4px 6px; }
  h3 { margin: 14px 0 6px; }
  .actions { margin-top: 12px; display: flex; gap: 12px; align-items: center; }
  .ok { color: green; }
</style>
```

- [ ] **Step 2: Implement `src/routes/settings/+page.svelte`**

```svelte
<script>
  import SettingsPanel from '$lib/components/SettingsPanel.svelte';
</script>

<h2>Inställningar</h2>
<SettingsPanel />
```

- [ ] **Step 3: Update `README.md`** — add a "Web app" section

Append:
```markdown
## Web app (Plan 2)
```bash
npm run dev      # open the printed URL
```
- Paste a screenshot (Ctrl+V), drop files, or pick files → they enter the review queue.
- A watched folder can be set under **Inställningar** (`watchFolder`).
- Review a receipt, hit **Förhandsgranska** for a dry-run, then **Skriv till Sheet** to commit.
- Nothing is written to the sheet until you click **Skriv till Sheet**.
```

- [ ] **Step 4: Build, test, and end-to-end manual check**

Run:
```bash
npm run build
npm test
```
Expected: build succeeds; `npm test` shows all tests passing (Plan 1 + Plan 2 suites).
Then `npm run dev`, open Settings, set `watchFolder`, save; drop a receipt; confirm dry-run preview works against the real (empty) sheet. Nothing written.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/SettingsPanel.svelte src/routes/settings/ README.md
git commit -m "feat(web): settings page and web-app docs"
```

---

## Self-Review

**Spec coverage:**
- Three ingest methods (paste/upload/watched folder) → Task 8 (paste/upload), Task 6 + Task 7 hooks (folder).
- Multi-receipt queue with per-item state + error capture → Tasks 3, 4, 5, 8.
- Review UI: edit items/categories, store-row location+card prefilled from lastUsed, confirm tab → Tasks 5 (meta defaults), 8.
- Confirmation toggles in settings → Task 9 (and `confirmations` already exists from Plan 1).
- Commit only on explicit action; records corrections + updates lastUsed → Task 5, 8.
- Tab from today, create-from-`Mall` → Task 5 (`tabNameForDate(now)`, `templateTab`).
- Only J–N touched; thick bottom border; no writes without commit → inherited from Plan 1 `writeReceipt`; commit is the only `dryRun:false` caller (Task 5).
- Email module → still out of scope (reserved).

**Note on confirmation toggles:** Plan 1 stores `confirmations` and Plan 2 edits them in Settings. Wiring each toggle to *skip* its review step in the UI (true express mode) is a thin follow-up; this plan ships the preview/commit flow and the editable toggles. If express-mode auto-commit is wanted, it is a small addition to `+page.svelte` (auto-call commit when all `confirmations` are false) — flagged here, not built, to avoid an accidental auto-write path before the user has tested commits.

**Placeholder scan:** No TBD/TODO; every code step contains complete code; server-logic steps include real tests.

**Type consistency:** `PublicItem` (no buffer) is produced by `service` (Task 5) and consumed by routes (Task 7) and UI (Task 8). `item.meta = { location, card, tab }` is set in `service.ingest` and read by `ReceiptReview`/`commit`. `writeReceipt` options object matches Plan 1's signature (`tabName/location/card/templateTab/create/dryRun`). `CATEGORIES` is duplicated client-side in `src/lib/client/api.js` (the server copy in `types.js` is server-only and cannot be imported into the browser) — values are identical and asserted by Plan 1's `types.test.js`.
