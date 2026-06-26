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
