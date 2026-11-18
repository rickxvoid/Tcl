// Temporary: does bestbuy.com answer the tracker's normal requests again?
// Same headers the tracker always used; one attempt per URL.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const urls = [
  'https://www.bestbuy.com/site/searchpage.jsp?id=pcat17071&st=tcl+tv',
  'https://www.bestbuy.com/site/searchpage.jsp?st=6684149+6617496',
];
for (const url of urls) {
  const start = Date.now();
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(30000),
    });
    const t = await r.text();
    console.log(`CHECK ${url} -> HTTP ${r.status}, ${t.length} bytes, product data: ${t.includes('ApolloSSRDataTransport')}, ${Date.now() - start} ms`);
  } catch (e) {
    console.log(`CHECK ${url} -> ${e.message}, ${Date.now() - start} ms`);
  }
}
