// Price history: { [sku]: [{ t: ISO time, p: price, m: member price | null }] }
// An entry is added only when the price or member price changes.

const MAX_ENTRIES = 200;

export function updateHistory(history, products, checkedAt) {
  const next = { ...history };
  for (const prod of products) {
    if (typeof prod.salePrice !== 'number') continue;
    const entries = [...(next[prod.sku] ?? [])];
    const member = prod.memberPrice?.price ?? null;
    const last = entries[entries.length - 1];
    if (!last || last.p !== prod.salePrice || (last.m ?? null) !== member) {
      entries.push({ t: checkedAt, p: prod.salePrice, m: member });
    }
    next[prod.sku] = entries.slice(-MAX_ENTRIES);
  }
  return next;
}
