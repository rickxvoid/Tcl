# TCL price tracker

Fetches the current bestbuy.com price of every TCL TV and sound bar, My Best Buy Plus/Total member prices, and package deals that include a TCL sound bar, and writes them to `../prices/data/`. The page in `../prices/` shows them, with filters for price, size, operating system, panel type and model year.

The **Update TCL prices** workflow (`.github/workflows/update-prices.yml`) runs this every 3 hours, commits the new data to `main` and publishes the site to GitHub Pages at `/prices/`. No API key is needed; everything is read from bestbuy.com search and package pages.

```sh
cd tracker
npm test
npm run fetch   # writes ../prices/data/prices.json (takes a couple of minutes)
npm run serve   # http://localhost:8080/prices/
```

- `scripts/fetch-prices.mjs` collects everything
- `scripts/lib/bestbuy-page.mjs` parses bestbuy.com pages (update this if Best Buy changes its pages)
- `scripts/lib/http.mjs` pauses between requests and retries

Only items sold by Best Buy are listed (marketplace sellers are skipped). A run that finds fewer than 10 TVs doesn't write any data, so a broken run never replaces good prices. Not affiliated with Best Buy or TCL.
