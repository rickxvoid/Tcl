#!/usr/bin/env node
// Fetch current bestbuy.com prices for every TV and sound bar (or home theater
// audio product) of one brand, their My Best Buy Plus/Total member prices, and
// package deals that pair a TV with that brand's audio. Writes <dataDir>/prices.json
// and appends price changes to <dataDir>/history.json.
//
//   node scripts/fetch-prices.mjs --brand tcl     (or --brand sony; see brands/)
//
// No API key is needed: everything comes from bestbuy.com search and package
// pages (see scripts/lib/bestbuy-page.mjs for how they're parsed).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHtml, searchUrl } from './lib/http.mjs';
import { parseSearchPage, parseComboPage } from './lib/bestbuy-page.mjs';
import { kindOf as classify, screenSize } from './lib/classify.mjs';
import { updateHistory } from './lib/history.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Which brand to fetch: `--brand sony` (default: tcl). Each brand's searches and
// settings live in brands/<name>.mjs.
const brandArg = process.argv.find((a) => a.startsWith('--brand='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--brand') + 1 || -1]
  ?? 'tcl';
const cfg = (await import(`../brands/${brandArg.toLowerCase()}.mjs`)).default;
const kindOf = (p) => classify(p, cfg.audioTypes, cfg.audioNames);

// Where the site's data files live; PRICES_DATA_DIR (relative to the current
// directory) overrides the brand's default.
const DATA_DIR = process.env.PRICES_DATA_DIR ? resolve(process.env.PRICES_DATA_DIR) : resolve(ROOT, cfg.dataDir);

const RESULTS_PER_PAGE = 18;
const MAX_PAGES = 12;
const SKU_BATCH = 5;

const warnings = [];
const priced = new Map(); // sku -> normalized product (+ checkedAt)
const known = new Map(); // sku -> whatItIs, for every SKU seen
const combos = new Map(); // combo id -> combo
const memberTagged = new Set();

function absorb(page, checkedAt) {
  for (const [sku, kinds] of page.kinds) if (!known.has(sku) || !known.get(sku).length) known.set(sku, kinds);
  for (const [sku, p] of page.products) {
    // Pages include different parts of a product's data (some omit the regular or
    // member price). While the price is the same, fill gaps from what an earlier
    // page in this run already showed instead of replacing it.
    const prev = priced.get(sku);
    const merged = prev && prev.salePrice === p.salePrice ? { ...prev } : {};
    for (const [k, v] of Object.entries(p)) {
      if (v == null || (Array.isArray(v) && !v.length && merged[k]?.length)) continue;
      merged[k] = v;
    }
    priced.set(sku, { ...merged, checkedAt });
  }
  for (const c of page.combos) combos.set(c.id, c);
}

async function fetchListing(query, { allPages = true } = {}) {
  const skus = new Set();
  let count = null;
  for (let cp = 1; cp <= MAX_PAGES; cp++) {
    let html;
    try {
      html = await getHtml(searchUrl({ ...query, cp }));
    } catch (err) {
      warnings.push(`${query.label ?? query.st} page ${cp}: ${err.message}`);
      break;
    }
    const page = parseSearchPage(html);
    absorb(page, new Date().toISOString());
    count ??= page.count;
    const before = skus.size;
    page.skus.forEach((s) => skus.add(s));
    const pages = Math.ceil((count ?? 0) / RESULTS_PER_PAGE);
    if (!allPages || skus.size === before || cp >= pages) break;
  }
  return { skus, count };
}

/**
 * Search pages only include prices for the cards Best Buy renders on the server.
 * A search for a few SKUs at once ("st=6617500 6672676 ...") returns exactly those
 * products, all priced, so look up the rest that way.
 */
async function fillMissingPrices(skus) {
  const incomplete = (s) => !priced.has(s) || priced.get(s).regularPrice == null;
  let missing = skus.filter(incomplete);
  for (const size of [SKU_BATCH, 2]) {
    for (let i = 0; i < missing.length; i += size) {
      const batch = missing.slice(i, i + size);
      // A single-SKU search goes to the product page instead, so pad with a known SKU.
      if (batch.length === 1) batch.push([...priced.keys()][0] ?? skus.find((s) => s !== batch[0]));
      try {
        absorb(parseSearchPage(await getHtml(searchUrl({ st: batch.join(' ') }))), new Date().toISOString());
      } catch (err) {
        warnings.push(`SKU lookup ${batch.join(',')}: ${err.message}`);
      }
    }
    missing = missing.filter(incomplete);
    if (!missing.length) break;
  }
  return missing;
}

function toSite(p, kind) {
  return {
    sku: p.sku,
    kind,
    name: p.name,
    modelNumber: p.modelNumber,
    url: p.url,
    image: p.image,
    screenSize: kind === 'tv' ? screenSize(p.name) : null,
    regularPrice: p.regularPrice ?? p.salePrice,
    salePrice: p.salePrice,
    onSale: Boolean(p.onSale),
    dollarSavings: p.dollarSavings ?? 0,
    percentSavings: p.percentSavings,
    memberPrice: p.memberPrice ?? null,
    memberDealTagged: memberTagged.has(p.sku),
    offers: p.offers,
    freeGiftOffers: p.freeGiftOffers,
    dealEnds: p.dealEnds,
    // Best Buy's add-to-cart button state, e.g. ADD_TO_CART, CHECK_STORES ("Find a Store"), SOLD_OUT.
    availability: p.buttonState ?? null,
    rating: p.rating,
    reviewCount: p.reviewCount,
    bundles: [],
    checkedAt: p.checkedAt,
  };
}

const round = (n) => Math.round(n * 100) / 100;
const tidyOffer = (s) => s.replace(/\b(test|dotcom)\b/gi, '').replace(/\bGWP\b/g, '').replace(/\s+/g, ' ').trim();

async function main() {
  console.log(`Fetching ${cfg.brand} listings from bestbuy.com…`);
  const listed = new Set();
  for (const q of cfg.listings) {
    const { skus, count } = await fetchListing(q);
    skus.forEach((s) => listed.add(s));
    console.log(`  ${q.label}: ${skus.size} results (Best Buy reports ${count ?? '?'})`);
  }
  for (const q of cfg.memberListings) {
    const { skus } = await fetchListing(q);
    skus.forEach((s) => {
      memberTagged.add(s);
      listed.add(s);
    });
  }
  for (const q of cfg.packageListings) await fetchListing(q);
  // Only rely on the seller filter if it clearly worked: it returned results, and
  // fewer than the unfiltered search (which includes marketplace listings).
  const soldByBestBuy = new Set();
  let sellerFilterWorked = true;
  for (const q of cfg.soldByListings) {
    const unfiltered = (await fetchListing({ ...q, qp: undefined }, { allPages: false })).count;
    const { skus, count } = await fetchListing(q);
    skus.forEach((s) => soldByBestBuy.add(s));
    const ok = count != null && count > 0 && skus.size > 0 && (unfiltered == null || count <= unfiltered);
    console.log(`  ${q.label}: ${skus.size} results (Best Buy reports ${count ?? '?'} of ${unfiltered ?? '?'})`);
    if (!ok) sellerFilterWorked = false;
  }
  if (!sellerFilterWorked) warnings.push('"Sold by Best Buy" filter returned nothing usable; only listings marked as marketplace were skipped');
  // Best Buy's product types among the listed SKUs, to check what counts as audio.
  const types = new Map();
  for (const s of listed) for (const t of known.get(s) ?? ['(unknown)']) types.set(t, (types.get(t) ?? 0) + 1);
  console.log(`  Product types: ${[...types].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ')}`);
  console.log(`  ${listed.size} SKUs listed, ${[...listed].filter((s) => priced.has(s)).length} priced so far, ${combos.size} packages`);

  // Only chase prices for SKUs that look like TVs or sound bars.
  const wanted = [...listed].filter((s) => kindOf({ whatItIs: known.get(s) ?? [], name: priced.get(s)?.name }) !== null || !known.get(s)?.length);
  const stillMissing = await fillMissingPrices(wanted);
  console.log(`  after SKU lookups: ${wanted.length - stillMissing.length}/${wanted.length} priced`);

  const tvs = [];
  const soundbars = [];
  const marketplaceSkipped = [];
  for (const sku of listed) {
    const p = priced.get(sku);
    // Refurbished listings aren't the new product's price, so leave them out.
    if (!p || !cfg.isBrand(p) || /\brefurbished\b/i.test(p.name ?? '')) continue;
    const kind = kindOf(p);
    if (!kind) continue;
    const marketplace = p.seller === '3P' || (p.seller == null && sellerFilterWorked && !soldByBestBuy.has(sku));
    if (marketplace) {
      marketplaceSkipped.push(sku);
      continue;
    }
    (kind === 'tv' ? tvs : soundbars).push(toSite(p, kind));
  }
  const incomplete = stillMissing.filter((s) => kindOf({ whatItIs: known.get(s) ?? [] }));
  const noPrice = incomplete.filter((s) => !priced.has(s));
  const noRegular = incomplete.filter((s) => priced.has(s));
  if (noPrice.length) warnings.push(`No price found for ${noPrice.length} listed SKUs: ${noPrice.join(', ')}`);
  if (noRegular.length) warnings.push(`Regular price unknown (shown as not on sale) for: ${noRegular.join(', ')}`);

  // Package deals that include one of this brand's audio products.
  const soundbarSkus = new Set(soundbars.map((s) => s.sku));
  const bundles = [];
  for (const c of combos.values()) {
    if (!c.skus.some((s) => soundbarSkus.has(s)) && !c.driverKind.some((k) => cfg.audioTypes.test(k))) continue;
    let page = null;
    try {
      if (c.url) page = parseComboPage(await getHtml(c.url));
    } catch (err) {
      warnings.push(`Package ${c.id}: ${err.message}`);
    }
    // Only trust the package page if it prices exactly this package's items.
    if (page && [...page.items.map((i) => i.sku)].sort().join() !== [...c.skus].sort().join()) {
      warnings.push(`Package ${c.id}: package page items didn't match; package price not shown`);
      page = null;
    }
    const checkedAt = new Date().toISOString();
    const items = c.skus.map((sku) => {
      const fromPage = page?.items.find((i) => i.sku === sku);
      const p = priced.get(sku);
      return {
        sku,
        name: p?.name ?? null,
        url: p?.url ?? null,
        regularPrice: fromPage?.regularPrice ?? p?.regularPrice ?? null,
        // What the item costs on its own today, and what it costs inside the package.
        salePrice: p?.salePrice ?? fromPage?.salePrice ?? null,
        packageItemPrice: fromPage?.salePrice ?? null,
        memberPrice: p?.memberPrice?.price ?? null,
        offers: (fromPage?.offers ?? []).map(tidyOffer).filter(Boolean),
      };
    });
    const allPriced = items.every((i) => typeof i.salePrice === 'number');
    const separateTotal = allPriced ? round(items.reduce((s, i) => s + i.salePrice, 0)) : null;
    const regularTotal = items.every((i) => typeof i.regularPrice === 'number')
      ? round(items.reduce((s, i) => s + i.regularPrice, 0))
      : null;
    const packagePrice = page?.packagePrice ?? null;
    const memberTotal = items.some((i) => i.memberPrice != null) && allPriced
      ? round(items.reduce((s, i) => s + (i.memberPrice ?? i.salePrice), 0))
      : null;
    bundles.push({
      id: c.id,
      name: page?.title ?? c.title,
      url: c.url,
      image: priced.get(c.driverSku ?? c.skus[0])?.image ?? null,
      packagePrice,
      separateTotal,
      regularTotal,
      bundleSavings: packagePrice != null && separateTotal != null ? round(separateTotal - packagePrice) : null,
      savingsVsRegular: packagePrice != null && regularTotal != null ? round(regularTotal - packagePrice) : null,
      memberTotal,
      items,
      checkedAt,
    });
    for (const s of soundbars) if (c.skus.includes(s.sku)) s.bundles.push(c.id);
  }

  // Sanity check: never replace good data with an empty or broken run.
  if (tvs.length < 10) {
    console.error(`Only ${tvs.length} TVs found; not writing data. Warnings:\n  ${warnings.join('\n  ')}`);
    process.exit(1);
  }

  const byPrice = (a, b) => (a.salePrice ?? Infinity) - (b.salePrice ?? Infinity);
  tvs.sort((a, b) => (b.screenSize ?? 0) - (a.screenSize ?? 0) || byPrice(a, b));
  soundbars.sort(byPrice);
  bundles.sort((a, b) => (a.packagePrice ?? a.separateTotal ?? Infinity) - (b.packagePrice ?? b.separateTotal ?? Infinity));

  await mkdir(DATA_DIR, { recursive: true });
  const historyPath = join(DATA_DIR, 'history.json');
  let history = {};
  try {
    history = JSON.parse(await readFile(historyPath, 'utf8'));
  } catch {}
  const checkedAt = new Date().toISOString();
  history = updateHistory(history, [...tvs, ...soundbars], checkedAt);
  for (const p of [...tvs, ...soundbars]) {
    const h = history[p.sku] ?? [];
    const prices = h.map((e) => e.p).filter((n) => typeof n === 'number');
    p.lowestSeen = prices.length ? Math.min(...prices) : null;
    // Last different price, so a member-price-only change doesn't count as a price change.
    const earlier = h.slice(0, -1).reverse().find((e) => e.p !== p.salePrice);
    p.previousPrice = earlier ? earlier.p : null;
    p.atLowestTracked = prices.some((x) => x > p.salePrice) && p.salePrice <= p.lowestSeen;
  }

  const output = {
    brand: cfg.brand,
    checkedAt,
    source: 'bestbuy.com',
    counts: { tvs: tvs.length, soundbars: soundbars.length, bundles: bundles.length },
    marketplaceSkipped, // SKUs of marketplace (third-party seller) listings left out
    tvs,
    soundbars,
    bundles,
    warnings: warnings.slice(0, 30),
  };
  await writeFile(join(DATA_DIR, 'prices.json'), JSON.stringify(output, null, 1) + '\n');
  await writeFile(historyPath, JSON.stringify(history) + '\n');
  console.log(
    `Wrote ${tvs.length} TVs, ${soundbars.length} sound bars, ${bundles.length} sound bar packages ` +
      `(${[...tvs, ...soundbars].filter((p) => p.memberPrice).length} with member prices; ${marketplaceSkipped.length} marketplace listings skipped).`,
  );
  if (warnings.length) console.log(`Warnings:\n  ${warnings.join('\n  ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
