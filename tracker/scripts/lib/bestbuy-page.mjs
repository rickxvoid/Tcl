// Parse product data out of bestbuy.com pages.
//
// Search and category pages are server-rendered and embed their Apollo GraphQL
// cache in <script> tags like:
//   (window[Symbol.for("ApolloSSRDataTransport")] ??= []).push({"rehydrate":{...}})
// Every result on the page appears there by SKU, but only the cards Best Buy
// renders on the server come with name and price. The rest are filled in by the
// browser later (which Best Buy's bot protection blocks), so those SKUs are
// returned in `unpricedSkus` and looked up again with a SKU search.
//
// Package ("combo") pages are older server-rendered pages that carry their
// pricing in <script type="application/json" id="pricing-price-...-json">.

const SCRIPT_RE = /<script[^>]*>([\s\S]*?)<\/script>/g;

/** Extract and parse every Apollo SSR payload in the page. */
export function apolloPayloads(html) {
  const out = [];
  for (const [, body] of html.matchAll(SCRIPT_RE)) {
    if (!body.includes('ApolloSSRDataTransport')) continue;
    const start = body.indexOf('.push(');
    const end = body.lastIndexOf(')');
    if (start < 0 || end <= start) continue;
    // The payload is JSON except that absent values are written as bare `undefined`.
    const json = body.slice(start + 6, end).replace(/([:[,])undefined(?=[,}\]])/g, '$1null');
    try {
      out.push(JSON.parse(json));
    } catch {
      // Skip a payload we can't read rather than failing the whole page.
    }
  }
  return out;
}

function walk(value, visit) {
  if (Array.isArray(value)) for (const v of value) walk(v, visit);
  else if (value && typeof value === 'object') {
    visit(value);
    for (const v of Object.values(value)) walk(v, visit);
  }
}

const isOpenBox = (obj) => typeof obj.openBoxCondition === 'number' && obj.openBoxCondition > 0;

function mergeInto(target, obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const prev = target[k];
    // Nested objects (price, name, url) arrive in pieces; merge them too.
    target[k] = v && typeof v === 'object' && !Array.isArray(v) && prev && typeof prev === 'object' && !Array.isArray(prev)
      ? { ...prev, ...v }
      : v;
  }
}

/**
 * Merge every partial Product object in the page into one record per SKU.
 * Open-box listings share the SKU of the new item, so they are skipped to keep
 * their prices from mixing into the new item's price.
 */
export function collectProducts(payloads) {
  const bySku = new Map();
  for (const payload of payloads) {
    walk(payload, (obj) => {
      if (obj.__typename !== 'Product' || !obj.skuId || isOpenBox(obj)) return;
      if (obj.price && isOpenBox(obj.price)) return;
      const merged = bySku.get(obj.skuId) ?? {};
      mergeInto(merged, obj);
      bySku.set(obj.skuId, merged);
    });
  }
  return bySku;
}

/** SKUs of the search results (products, not packages), in page order. */
export function resultSkus(payloads) {
  const skus = [];
  for (const payload of payloads) {
    walk(payload, (obj) => {
      if (obj.__typename === 'SearchProduct' && obj.product?.skuId) skus.push(obj.product.skuId);
    });
  }
  return [...new Set(skus)];
}

/** Package deals ("combos") listed in the search results. */
export function resultCombos(payloads) {
  const byId = new Map();
  for (const payload of payloads) {
    walk(payload, (obj) => {
      if (obj.__typename !== 'Combo' || !obj.id) return;
      const merged = byId.get(obj.id) ?? {};
      mergeInto(merged, obj);
      byId.set(obj.id, merged);
    });
  }
  return [...byId.values()].map((c) => ({
    id: c.id,
    title: c.title ?? null,
    url: c.pdpUrl ?? null,
    skus: (c.skuList ? String(c.skuList).split(',') : (c.comboProducts ?? []).map((p) => p.product?.skuId))
      .filter(Boolean)
      .map(String),
    driverSku: c.driverSku?.skuId ?? null,
    driverKind: c.driverSku?.whatItIs ?? [],
  }));
}

/** Total result count for the search, if present. */
export function resultCount(html) {
  const m = /"numFound":(\d+)/.exec(html);
  return m ? Number(m[1]) : null;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = (n) => Math.round(n * 100) / 100;

/**
 * Member (My Best Buy Plus/Total) price. Best Buy includes a "what if you were a
 * member" price for each paid-membership tier even for signed-out visitors.
 */
export function memberPricing(price, current) {
  const tiers = Object.values(price.whatIfPrice ?? {})
    .filter((t) => t && typeof t === 'object' && num(t.price) != null)
    .map((t) => t.price);
  const paidSavings = num(price.totalPaidMemberSavings) ?? 0;
  if (paidSavings > 0) tiers.push(round(current - paidSavings));
  const below = tiers.filter((p) => p > 0 && p < current);
  if (!below.length) return null;
  const low = Math.min(...below);
  const high = Math.max(...below);
  return {
    price: low,
    highPrice: high !== low ? high : null,
    savings: round(current - low),
    tier: high !== low ? 'My Best Buy Plus/Total (varies by tier)' : 'My Best Buy Plus & Total',
  };
}

/** Promotional badges (e.g. "Free Installation") with their dates. */
function offersFrom(p) {
  return (Array.isArray(p.badges) ? p.badges : [])
    .filter((b) => b?.displayName)
    .map((b) => ({
      text: b.displayName,
      url: b.detailsHref ?? null,
      startDate: b.startDate ?? null,
      endDate: b.endDate ?? null,
    }));
}

/**
 * Normalize one merged Product into the fields the site uses.
 * Returns null when the page didn't include a price for this SKU.
 */
export function normalizeProduct(p) {
  const price = p.price ?? {};
  const current = num(price.displayableCustomerPrice) ?? num(price.customerPrice) ?? num(price.currentPrice);
  if (current == null) return null;
  // Some fragments carry only the current price; leave the regular price unknown
  // (null) then, rather than guessing it equals the current price.
  const regular = num(price.displayableRegularPrice) ?? num(price.regularPrice);
  return {
    sku: String(p.skuId),
    name: p.name?.short ?? null,
    modelNumber: p.manufacturer?.modelNumber ?? null,
    brand: p.brand ?? null,
    seller: p.seller?.classification ?? null, // "1P" = sold by Best Buy, "3P" = marketplace
    whatItIs: p.whatItIs ?? [],
    url: p.url?.skuSpecificUrl ?? p.url?.pdp ?? null,
    image: p.primaryImage?.piscesHref ?? p.primaryImage?.href ?? null,
    rating: num(p.reviewInfo?.averageRating),
    reviewCount: num(p.reviewInfo?.reviewCount),
    salePrice: current,
    regularPrice: regular,
    dollarSavings: num(price.totalSavings) ?? (regular != null ? Math.max(0, round(regular - current)) : null),
    percentSavings: num(price.totalSavingsPercent),
    onSale: regular != null ? current < regular : null,
    memberPrice: memberPricing(price, current),
    offers: offersFrom(p),
    freeGiftOffers: (price.giftSkus ?? []).length,
    dealEnds: price.dealExpirationTimeStamp ?? null,
    buttonState: p.fulfillmentOptions?.buttonStates?.[0]?.buttonState ?? null,
  };
}

/** Parse a search/category page. */
export function parseSearchPage(html) {
  const payloads = apolloPayloads(html);
  const all = collectProducts(payloads);
  const skus = resultSkus(payloads);
  const products = new Map();
  for (const [sku, p] of all) {
    const n = normalizeProduct(p);
    if (n) products.set(sku, n);
  }
  return {
    count: resultCount(html),
    skus,
    products,
    combos: resultCombos(payloads),
    unpricedSkus: skus.filter((s) => !products.has(s)),
    // Every SKU the page knows about, so callers can tell which SKUs are TVs/sound bars
    // even when unpriced.
    kinds: new Map([...all].map(([sku, p]) => [sku, p.whatItIs ?? []])),
  };
}

/** Parse a package ("combo") page: package price plus each item's price and offers. */
export function parseComboPage(html) {
  const re = /<script type="application\/json" id="pricing-price-\d+-json">([\s\S]*?)<\/script>/g;
  for (const [, body] of html.matchAll(re)) {
    let data;
    try {
      data = JSON.parse(body)?.app?.data;
    } catch {
      continue;
    }
    if (!data?.showPackagePrice || num(data.customerPrice) == null) continue;
    const items = (data.bundlePriceSkus ?? []).map((b) => ({
      sku: String(b.skuId),
      regularPrice: num(b.regularPrice),
      salePrice: num(b.customerPrice) ?? num(b.currentPrice),
      offers: [...new Set((b.offerQualifiers ?? []).map((o) => o.offerName).filter(Boolean))],
    }));
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    return {
      title: h1 ? decodeEntities(h1[1].replace(/<[^>]+>/g, '').trim()) : null,
      packagePrice: data.customerPrice,
      items,
    };
  }
  return null;
}

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
