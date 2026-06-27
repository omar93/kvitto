# Receipt fixtures

Drop an example receipt here and we lock its parsing down with a test.

## How to add one

1. Save the receipt text as `<name>.txt` (paste the PDF/receipt text), or drop the
   real `<name>.pdf` (its text layer is extracted automatically). Self-scan
   receipts (Willys/ICA, with the "Start/Slut Självscanning" markers) are what the
   deterministic parser handles.
2. Generate a starting expected result:

   ```
   npm run parse fixtures/receipts/<name>.txt -- --write
   ```

   This prints the parsed JSON and the resulting K-cell formulas, and writes
   `<name>.expected.json`.
3. Edit `<name>.expected.json` so it holds the result we actually want.
4. Run the tests — `parse-fixtures.test.js` enforces every `*.expected.json`:

   ```
   npm test
   ```

   Iterate on the parser until it passes.

A receipt without a matching `*.expected.json` is skipped (not failed), so you can
drop a file first and fill in the expected result afterwards.
