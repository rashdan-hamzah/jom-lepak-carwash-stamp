# carwash-stamp

A premium digital loyalty stamp concept for carwash businesses.

## What is included

- A polished customer-facing UI with a tap-to-flip loyalty card
- A Cloudflare Worker endpoint for stamp events
- A Google Apps Script bridge pattern for writing into Google Sheets

## Current structure

- `index.html` - the visual prototype
- `styles.css` - the full UI styling
- `app.js` - the card interaction and stamp state
- `worker/index.js` - the Cloudflare Worker bridge to Apps Script
- `apps-script/Code.gs` - the Google Apps Script webhook that appends rows to Sheets
- `apps-script/SHEET_LAYOUT.md` - the admin sheet structure reference
- `apps-script/appsscript.json` - Apps Script project settings
- `wrangler.toml` - Worker configuration

## API flow

1. The app sends requests to a configurable bridge URL.
2. The bridge can expose `health`, `config`, `customer`, `setup`, and `stamp` routes.
3. The bridge reads and writes Google Sheets.
4. The latest sheet row is reflected back into the app on load or lookup.

## Apps Script setup

1. Create a Google Sheet.
2. Open Apps Script and paste in `apps-script/Code.gs`.
3. Set Script Properties:
	- `SHEET_ID` = your Google Sheet ID
	- `SHEET_NAME` = `Stamp Log` or your preferred tab name
4. Deploy as a web app.
5. Copy the web app URL into Cloudflare as `APPS_SCRIPT_WEBHOOK_URL`.
6. Run `setupWorkbook()` once to create the admin tabs and headers.
7. If you want one-click seeding, set `ADMIN_TOKEN` in Script Properties and call the Worker `POST /api/setup` route.

## GitHub Pages setup

1. Host `index.html`, `styles.css`, and `app.js` on GitHub Pages.
2. Set `window.CARWASH_CONFIG.apiBaseUrl` in `index.html` to your Cloudflare Worker base URL.
3. The frontend will call these routes on that base URL:
	- `/health`
	- `/config?action=config`
	- `/customer`
	- `/stamp`
	- `/setup`
4. Test the page directly from the GitHub Pages URL.

## Customer lookup and repeat visits

- The app looks up customers by `customerId`, `phone`, or `customerName`.
- If a matching sheet row exists, the current stamp count and status are loaded into the UI.
- If no match is found, the app prepares a new record using the entered name and lookup value.
- Repeat visits update the same customer row in `Customers` instead of creating a new one.
- Redeeming a reward updates the same customer status in Sheets.
- The one-time workbook bootstrap is protected by `ADMIN_TOKEN` if you use the web route.

## Sheet columns

The main event log writes these columns:

- Timestamp
- Customer Name
- Customer ID
- Phone
- Collected
- Total
- Remaining
- Progress
- Source

The `Customers` sheet is the source of truth for the customer profile shown on the page.

See `apps-script/SHEET_LAYOUT.md` for the full workbook layout.

## Next step

Add a Google Apps Script endpoint that appends rows to a sheet, then point `APPS_SCRIPT_WEBHOOK_URL` at that endpoint.
