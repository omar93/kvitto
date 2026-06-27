import { createQueue } from './queue/queue.js';
import { processReceipt as defaultProcess } from './pipeline.js';
import { loadSettings, updateSettings as defaultUpdate } from './settings/settings.js';
import { recordCorrection } from './categorize/categorize.js';
import { tabNameForDate } from './period/period.js';
import { writeReceipt as defaultWrite } from './sheets/writer.js';
import { listTabs } from './sheets/tabs.js';
import { getCategoriesFromSheet } from './sheets/categories.js';
import { createSheetsClient as defaultCreateClient } from './sheets/client.js';
import { CATEGORIES } from '../types.js';

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

  // Settings (the UI) win over the static config/env so the app is usable in
  // `npm run dev` without exporting environment variables.
  async function sheetConfig() {
    const s = await getSettings();
    return {
      spreadsheetId: s.sheet.spreadsheetId || spreadsheetId,
      templateTab: s.sheet.templateTab || templateTab
    };
  }

  // Category list comes from the sheet's data validation (column M), cached after
  // the first successful fetch; falls back to the built-in list.
  let cachedCategories = null;
  async function getCategories() {
    if (cachedCategories) return cachedCategories;
    const cfg = await sheetConfig();
    try {
      const list = await getCategoriesFromSheet(sheets(), cfg.spreadsheetId, cfg.templateTab);
      if (list && list.length) { cachedCategories = list; return list; }
    } catch { /* fall through to the built-in list */ }
    return CATEGORIES;
  }

  async function ingest({ buffer, filename, mimetype, source }) {
    const item = queue.add({ filename, mimetype, buffer, source });
    const settings = await getSettings();
    const categories = await getCategories();
    const result = await process(item, { settings, categories });
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
      const cfg = await sheetConfig();
      const result = await write(sheets(), cfg.spreadsheetId, it.receipt, {
        tabName: tab, location, card, templateTab: cfg.templateTab, create: true, dryRun: true
      });
      return result;
    },

    async commit(id) {
      const it = queue.get(id);
      const { location, card, tab } = it.meta;
      const cfg = await sheetConfig();
      const result = await write(sheets(), cfg.spreadsheetId, it.receipt, {
        tabName: tab, location, card, templateTab: cfg.templateTab, create: true, dryRun: false
      });
      const settings = await getSettings();
      const categories = await getCategories();
      let learned = settings.learnedCategories;
      for (const line of it.receipt.items) {
        if (line.category) learned = recordCorrection(learned, line.name, line.category, categories);
      }
      await updateSettingsFn(settingsPath, { learnedCategories: learned, lastUsed: { location, card } });
      queue.update(id, { status: 'committed' });
      return result;
    },

    getSettings,
    getCategories,
    updateSettings: (patch) => updateSettingsFn(settingsPath, patch),
    async listSheetTabs() {
      const cfg = await sheetConfig();
      return listTabs(sheets(), cfg.spreadsheetId);
    }
  };
}
