# Kvitto Receipt Importer — Design Spec

**Date:** 2026-06-26
**Status:** Approved direction; pending written-spec review

## 1. Purpose

A local-first JavaScript app that ingests grocery receipts (screenshots or PDFs)
from Swedish stores (Willys, ICA Maxi, etc.), extracts the data locally, lets the
user review and correct it, and writes it into the user's existing Google Sheet —
into the correct monthly tab, into the "Groceries" block only.

Everything runs locally: OCR via Tesseract, structured parsing and category
guessing via a small local LLM (Ollama in Docker). No cloud AI. The only external
service is the Google Sheets API (for the user's own sheet).

## 2. Constraints & Ground Rules

- **No writes without explicit go-ahead.** During development the app must not
  write to any real sheet. Use read-only inspection and a dry-run mode until the
  user explicitly authorizes a write. The test sheet may be written to only when
  the user says so.
- **Only the Groceries block (columns J–N) is ever touched.** Columns A–I contain
  other budget/expense blocks that must be left untouched.
- **Every confirmation step must be toggleable** in Settings ("express mode").
- **Local-first:** no receipt data leaves the machine.
- Many small git commits; the user publishes to remote themselves.

## 3. Key Facts

- **Test sheet ID:** `1r-_ah7YmHsDvR_X8U3Getjz4s6_6E6zuuTkiCNX2h5Y`
- **Service account:** `apartments@apartments-438418.iam.gserviceaccount.com`
  (sheet is shared with this account; the key JSON file will be provided at
  implementation time and kept out of git).
- **Frontend:** SvelteKit.
- **Backend/runtime:** Node.js. SvelteKit's server side hosts the API and serves
  the UI (single process).

## 4. Sheet Layout

Each monthly tab holds several budget blocks side by side. The app only deals with
the **Groceries** block, columns **J–N**:

| Col | Meaning (store header row)   | Meaning (item rows)        |
|-----|------------------------------|----------------------------|
| J   | Store name (e.g. "Willys - Port73") | Item name (e.g. "Mjölk 0,5%") |
| K   | Total = `=SUM(K…)` over the item rows | Item price (e.g. "19,90 kr") |
| L   | Purchase date (YYYY-MM-DD)   | (empty)                    |
| M   | Location (e.g. "Stockholm")  | Category (Mat / Läsk/Snäx / Vård / Hem) |
| N   | Card / "Köpt med" (e.g. "Skandia") | (empty)              |

- M and N are dropdowns (data validation) already present in the sheet/template.
  The app writes plain text values that match existing validation options.
- A purchase = one store header row immediately followed by its item rows.
- **No blank row between purchases.** Purchases are separated by a **bottom border**
  on the last row of each purchase (the thicker line visible in the reference image).
- Exact border/color/formatting details (and the meaning of the orange dots on the
  left of each row) are **to be specified by the user later**; the app must be able
  to set borders/formatting via the Sheets API so those rules can be applied.

## 5. Monthly Tab Selection (Pay-Period Logic)

- Payday is the **25th**. A period runs from the 25th of month *M* to the 24th of
  month *M+1*.
- Tab name format: `YYYY-MM/MM` where `YYYY-MM` is the **start** month and the
  second `MM` is the end month. Example: 25 Jun 2026 – 24 Jul 2026 → `2026-06/07`.
- **Default target = the period containing today's date** (the app knows the current
  day and posts to the corresponding tab). Rule: if day-of-month ≥ 25, start month =
  current month; otherwise start month = previous month.
- Year-wrap: a December start period is named `YYYY-12/01` (year prefix = start year).
- The user can override the tab in the UI (a dropdown of existing tabs) unless that
  confirmation is disabled in Settings.
- **If the target tab does not exist:** copy a designated **template tab** (with
  headers, formatting, and dropdown validation) and rename it to the period name.
  The template tab is configured by the user.

## 6. Architecture

A single Node process (SvelteKit) with a clear module boundary between the UI
(`src/routes`, `src/lib/components`) and the receipt pipeline (`src/lib/server/*`).

### Data flow

```
Inmatning (3 sätt)            Pipeline                          Mål
─────────────────            ───────────────────────────       ───────────
Paste (Ctrl+V)       ┐
Upload / drag-drop   ┼──►  Queue ─► extract ─► parse ─►  Review/  ─► sheets
Watched folder       ┘             (text)    (LLM→JSON)  edit (UI)    (Google Sheets)
```

1. **Ingest** — receipts arrive via clipboard paste, file upload, or a watched
   folder; each becomes a queue item.
2. **Extract** — PDFs with a text layer are read directly (pdf-parse); images and
   text-less PDFs are OCR'd with Tesseract.
3. **Parse** — raw text → local LLM (Ollama) → structured JSON:
   `{ store, date, total, items: [{ name, price, category }] }`. Output is
   schema-validated; failures are surfaced per receipt without stopping the queue.
4. **Review** — the UI shows each queued receipt; the user adjusts item categories,
   the store-row location + card (prefilled with last-used values), and confirms the
   month tab. All confirmation steps are skippable via Settings.
5. **Sheets** — compute the tab (pay-period logic), create it from the template if
   missing, find the next free Groceries row, write the store header row + item rows
   (with a live `=SUM` for the total) and apply the separating bottom border.

### Modules

| Module | Responsibility |
|--------|----------------|
| `lib/server/ingest/` | Upload handling + folder watcher → queue (clipboard handled client-side, posted to API) |
| `lib/server/extract/` | `pdf-parse` for PDFs, `tesseract.js` for images → raw text |
| `lib/server/parse/` | Ollama client + prompt → validated structured JSON |
| `lib/server/categorize/` | Category guessing (LLM) + persisted memory of user corrections |
| `lib/server/period/` | Pay-period logic (25th rule) → tab name `YYYY-MM/MM` |
| `lib/server/sheets/` | Google Sheets API: resolve/create tab, find row, write values + borders, SUM formula |
| `lib/server/settings/` | Config, confirmation toggles, last-used values (location/card), learned categories (JSON file) |
| `lib/server/queue/` | In-memory/persisted queue of receipts and their pipeline state |
| `src/routes` + `src/lib/components` | SvelteKit UI: ingest, queue, review, settings |
| `lib/server/email/` | *(future)* read receipts from email — placeholder boundary, not built now |

## 7. Tech Stack

- **App:** SvelteKit (UI + server routes), Node.js runtime.
- **Local processing:** `tesseract.js`, `pdf-parse`, Ollama via HTTP (model runs in
  the user's Docker).
- **Google:** `googleapis` with a **service account**; the key JSON lives outside
  git (path via env var) and the sheet is shared with the service-account email.
- **Local persistence:** a JSON file for settings, last-used values, and learned
  category mappings.

## 8. Error Handling & Testing

- Each pipeline stage catches errors per receipt; a bad receipt is flagged in the
  review view with its error and does not block other items.
- Nothing is written to Sheets until the user (or express mode) approves. A dry-run
  mode logs exactly what *would* be written.
- Unit tests:
  - `period/` — date → tab name across month/year boundaries and the 25th edge.
  - `parse/` — JSON schema validation against sample receipt texts.
  - `sheets/` — append-row and border logic against a mocked Sheets client.

## 9. Out of Scope (for now)

- Email ingestion (module boundary reserved, not implemented).
- Editing/auto-creating the other budget blocks (A–I).
- Multi-user / hosted deployment — this is a personal local app.

## 10. Open Items (to be provided by the user later)

- Exact border/formatting/color rules for purchase separation, and the meaning of
  the orange dots to the left of each row.
- The Google service-account **key JSON** file (for read access during development
  and writes once authorized).
- Which tab in the sheet is the **template** for new months.
- Preferred Ollama model name and host (default assumption: a small instruct model
  on `http://localhost:11434`).
