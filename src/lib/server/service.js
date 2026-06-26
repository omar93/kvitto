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
