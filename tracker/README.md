# Best Buy price tracker (TCL and Sony)

Fetches current bestbuy.com prices, My Best Buy Plus/Total member prices and package prices for one brand's TVs and audio, and writes them to that brand's data folder:

| Brand | Settings | Data | Page |
| --- | --- | --- | --- |
| TCL: TVs and sound bars | `brands/tcl.mjs` | `../prices/data/` | `/prices/` |
| Sony: TVs, sound bars, home theater systems, subwoofers and rear speakers | `brands/sony.mjs` | `../sony/data/` | `/sony/` |

Both pages use the same code (`../prices/app.js` and `../prices/styles.css`), with filters for price, size, operating system, panel type and model year. To add a brand, copy a file in `brands/`, add a page like `../sony/index.html`, and add a fetch step to the workflow.

The **Update prices (TCL & Sony)** workflow (`.github/workflows/update-prices.yml`) runs both every 3 hours, commits the new data to `main` and publishes the site to GitHub Pages. If one brand's fetch fails, the other brand's prices are still saved. No API key is needed; everything is read from bestbuy.com search and package pages.

```sh
cd tracker
npm test
npm run fetch        # TCL: writes ../prices/data/prices.json (takes a couple of minutes)
npm run fetch:sony   # Sony: writes ../sony/data/prices.json
npm run serve        # http://localhost:8080/prices/ and /sony/
```

- `scripts/fetch-prices.mjs` collects everything
- `scripts/lib/bestbuy-page.mjs` parses bestbuy.com pages (update this if Best Buy changes its pages)
- `scripts/lib/http.mjs` pauses between requests and retries

Only new items sold by Best Buy are listed (marketplace sellers and refurbished listings are skipped). A run that finds fewer than 10 TVs doesn't write any data, so a broken run never replaces good prices. Not affiliated with Best Buy or TCL.
