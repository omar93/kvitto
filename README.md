# Kvitto — receipt importer (core engine)

Local-first engine that reads a grocery receipt (screenshot or PDF), parses it with
a local LLM (Ollama), and prints exactly what it would write to the Groceries block
of the right monthly tab in a Google Sheet. It writes nothing unless you pass `--commit`.

This is **Plan 1** (the core engine + dry-run CLI). The SvelteKit web app (ingest via
paste/upload/watched folder, review queue, guarded commit) is **Plan 2**, built on top
of these modules. See `docs/superpowers/` for the spec and plans.

## Prerequisites
- Node.js 20+ (developed on Node 22)
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

# Actually write (explicit, requires credentials):
... node cli.js path/to/receipt.pdf --commit
```

Flags: `--tab <name>` override the target month tab, `--location <x>` / `--card <y>`
override the store-row dropdowns.

## Architecture
Single-responsibility modules under `src/lib/server/`:
- `period/` — pay-period (25th rule) → tab name `YYYY-MM/MM`
- `extract/` — PDF text (unpdf) and image OCR (tesseract.js), with a dispatcher
- `parse/` — receipt schema + Ollama-based text → `ReceiptData`
- `categorize/` — category resolution with learned overrides
- `settings/` — JSON config (confirmation toggles, last-used values, learned categories)
- `sheets/` — service-account client, tab resolve/create from template, row + border writer

## Web app (Plan 2)
```bash
npm run dev      # open the printed URL
```
- Paste a screenshot (Ctrl+V), drop files, or pick files → they enter the review queue.
- A watched folder can be set under **Inställningar** (`watchFolder`).
- Review a receipt, hit **Förhandsgranska** for a dry-run, then **Skriv till Sheet** to commit.
- Nothing is written to the sheet until you click **Skriv till Sheet**.
- Set `GOOGLE_APPLICATION_CREDENTIALS` (default `credentials.json`), `KVITTO_SPREADSHEET_ID`,
  and `KVITTO_TEMPLATE_TAB` (default `Mall`) in the environment, or via Settings.

## Tests
```bash
npm test
```
```bash
node test/fixtures/make-sample-pdf.mjs   # regenerate the PDF test fixture
```
