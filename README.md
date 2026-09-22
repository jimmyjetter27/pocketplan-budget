# PocketPlan

A private Windows desktop planner for spending, household essentials, budgets and rent savings. Works offline with dark and light themes.

## Open the app

Run `release/PocketPlan 1.0.0.exe`. Create a vault password of at least 4 characters. Keep the password safe: there is no recovery service.

Your starting plan contains GHS800 available cash, GHS4,000 existing savings, expected salary of GHS7,120, a payday window of the 22nd–31st, and a monthly savings target of GHS2,000. Starting balances are dated 22 September 2026. Edit these records under Transactions if your situation has changed. Set your total rent goal in Settings; no rent amount has been assumed.

## Everyday use

- **Overview:** see cash, savings, current-month spending and expected payday. Salary only becomes cash when you record it as received.
- **Transactions:** add, edit, delete, search and filter by month. Amounts are stored in integer pesewas. Expenses subtract cash; income adds cash; savings transfers move between cash and savings without becoming expenses. Transactions are recorded when they occur, not as future forecasts.
- **Household:** track quantity, unit, optional unit price and availability. Quantity is a tracked or planned amount, not an automatically depleted stock count. Low and out-of-stock estimates use quantity × known unit price. Buy records an expense and marks the item available.
- **Budgets:** set category limits that repeat each month. Editing a limit changes the plan shown for all months. Spending uses calendar months, not salary cycles. Budgets do not automatically move money.
- **Savings:** record deposits and withdrawals, see your rent goal and monthly contribution progress. Existing starting savings is separate from new monthly transfers.
- **Settings:** edit salary, payday window, savings and rent targets; export or restore encrypted backups.

The daily figure divides current cash across the days through the end of the payday window (including today); it does not account for bills you have not entered. After the window passes the app asks you to check payday. The app does not connect to banks or move real money.

## Database and backups

The app uses SQLite through sql.js, holding the open database in memory. On every change it writes an encrypted database to `%APPDATA%/PocketPlan/budget.vault` (the exact path is shown in Settings). The database is stored as a single versioned planner record in SQLite; it is not a plaintext JSON file. The complete SQLite bytes are encrypted using AES-256-GCM with a random nonce per write and a 256-bit password-derived key using scrypt (N=32768, r=8, p=1, random 16-byte salt). Files are written through a temporary file and renamed. No financial database or password is committed to Git.

Use **Export encrypted backup** to save a `.vault` file to a folder, external drive or cloud drive you control. Copy backups regularly. The Windows executable is portable, but the active data stays in the user's app-data folder. On a new computer create a vault, then use Restore with the original backup password. The restored data is re-encrypted using the current vault's password. Restore keeps an encrypted pre-restore copy at `budget.vault.bak`; copy that to a `.vault` filename if you need to restore it.

The app locks after 10 minutes without pointer/keyboard activity and on Windows screen lock when no file operation is active. Explicit Lock clears the open database and encryption key. Decrypted data exists in memory while unlocked; encryption does not protect against malware in an unlocked session. There is no telemetry, cloud service, or password recovery. Keep at least one backup separately from your computer.

The renderer uses sandboxing, context isolation, no Node integration, a restrictive content security policy, and a narrow IPC bridge with sender validation, following [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

## Development

Requires Node.js and npm:

```sh
npm ci
npm start
npm test
npm run test:desktop
npm run dist
```

If your npm installation blocks Electron's install script, approve that dependency's install script or run `node node_modules/electron/install.js` before starting. `test:desktop` launches Electron with a disposable temporary vault and captures dark/light screenshots under `artifacts`. `POCKETPLAN_DATA_DIR` is an optional environment override for isolated testing.

The Windows build is unsigned; a paid code-signing certificate and auto-update service are not configured. Source code and lockfile are in this local Git repository. No GitHub repository is created.
