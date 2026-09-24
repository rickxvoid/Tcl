// Polite HTTP client for bestbuy.com: browser-like headers, one request at a
// time with a pause between them, and a couple of retries for transient errors.

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const PAUSE_MS = Number(process.env.BESTBUY_PAUSE_MS ?? 2500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;

export async function getHtml(url, { retries = 2, timeoutMs = 30000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const wait = last + PAUSE_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return await res.text();
      if (attempt >= retries || (res.status < 500 && res.status !== 429)) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt >= retries) throw new Error(`${err.message} (${url})`);
    }
    await sleep(5000 * (attempt + 1));
  }
}

const SEARCH = 'https://www.bestbuy.com/site/searchpage.jsp';

/** Build a bestbuy.com search/category URL. `qp` is a facet like "brand_facet=Brand~TCL". */
export function searchUrl({ st, id, qp, browsedCategory, cp }) {
  const params = new URLSearchParams();
  if (browsedCategory) params.set('browsedCategory', browsedCategory);
  if (cp && cp > 1) params.set('cp', String(cp));
  if (id) params.set('id', id);
  if (qp) params.set('qp', qp);
  params.set('st', st);
  return `${SEARCH}?${params}`;
}
