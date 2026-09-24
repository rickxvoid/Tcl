const $ = (s) => document.querySelector(s);
const state = {
  data: null,
  tab: 'tvs',
  q: '',
  sort: 'default',
  onSale: false,
  maxStep: null, // index into PRICE_STEPS; the last step means "any price"
  f: { size: new Set(), os: new Set(), panel: new Set(), year: new Set() },
};

// Max-price slider stops. Prices run from about $100 to $25,000, so the stops
// are closer together at the low end where most TVs are.
const PRICE_STEPS = [200, 300, 400, 500, 600, 700, 800, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, Infinity];

// TV attributes read from Best Buy's product names.
const tvOs = (name) =>
  /google tv/i.test(name) ? 'Google TV' : /\broku\b/i.test(name) ? 'Roku TV' : /fire tv/i.test(name) ? 'Fire TV' : 'Not listed';
const tvPanel = (name) =>
  /RGB[- ]Mini/i.test(name) ? 'RGB Mini LED'
    : /SQD[- ]Mini/i.test(name) ? 'SQD-Mini LED'
      : /QD[- ]Mini/i.test(name) ? 'QD-Mini LED'
        : /Mini[- ]LED/i.test(name) ? 'Mini LED'
          : /QLED/i.test(name) ? 'QLED'
            : 'LED';
const tvYear = (name) => (/\((20\d\d)\)/.exec(name) ?? [])[1] ?? 'Not listed';
const FILTER_GROUPS = {
  size: { el: '#f-size', of: (p) => (p.screenSize ? String(p.screenSize) : null), label: (v) => `${v}"`, order: (a, b) => a - b },
  os: { el: '#f-os', of: (p) => tvOs(p.name), label: (v) => v, order: ['Google TV', 'Roku TV', 'Fire TV', 'Not listed'] },
  panel: {
    el: '#f-panel',
    of: (p) => tvPanel(p.name),
    label: (v) => v,
    order: ['LED', 'QLED', 'Mini LED', 'QD-Mini LED', 'SQD-Mini LED', 'RGB Mini LED'],
  },
  year: { el: '#f-year', of: (p) => tvYear(p.name), label: (v) => v, order: (a, b) => b.localeCompare(a) },
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) =>
  typeof n === 'number' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—';
const when = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const safeUrl = (u) => (/^https:\/\/([a-z0-9-]+\.)*bestbuy\.com\//i.test(u ?? '') ? u : null);

function memberBlock(p) {
  const m = p.memberPrice;
  if (!m) return '';
  const range = m.highPrice ? `–${money(m.highPrice)}` : '';
  return `<div class="member">
      <span>${esc(m.tier)} price</span>
      <strong>${money(m.price)}${range}</strong>
      <small>Save ${money(m.savings)} more with a paid membership</small>
    </div>`;
}

function offerList(title, offers) {
  if (!offers?.length) return '';
  return `<p class="offers-title">${esc(title)}</p><ul class="offers">${offers
    .map((o) => {
      const text = typeof o === 'string' ? o : o.text;
      const url = safeUrl(o.url);
      const label = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text);
      return `<li>${label}${o.endDate ? ` <span class="meta">(ends ${esc(day(o.endDate))})</span>` : ''}</li>`;
    })
    .join('')}</ul>`;
}

const day = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function priceBlock(price, regular) {
  const sale = typeof regular === 'number' && typeof price === 'number' && regular > price;
  return `<div class="prices">
    <span class="price ${sale ? 'sale' : ''}">${money(price)}</span>
    ${sale ? `<span class="was">${money(regular)}</span><span class="save">Save ${money(regular - price)}</span>` : ''}
  </div>`;
}

function tags(p) {
  const t = [];
  if (p.onSale) t.push('<span class="tag sale">On sale</span>');
  if (p.memberPrice) t.push('<span class="tag member-tag">Member deal</span>');
  if (p.bundles?.length) t.push(`<span class="tag">${plural(p.bundles.length, 'package deal')}</span>`);
  if (p.freeGiftOffers) t.push(`<span class="tag">Free gift with purchase</span>`);
  if (p.atLowestTracked) t.push('<span class="tag good">Lowest price tracked</span>');
  if (typeof p.previousPrice === 'number' && p.previousPrice !== p.salePrice) {
    const diff = p.salePrice - p.previousPrice;
    t.push(`<span class="tag ${diff < 0 ? 'good' : ''}">${diff < 0 ? '▼' : '▲'} ${money(Math.abs(diff))} since last change</span>`);
  }
  const availability = {
    CHECK_STORES: 'Not available online · check stores',
    SOLD_OUT: 'Sold out',
    COMING_SOON: 'Coming soon',
    NOT_AVAILABLE: 'Not available',
  };
  if (availability[p.availability])
    t.push(`<span class="tag">${esc(availability[p.availability])}</span>`);
  if (p.dealEnds) t.push(`<span class="tag sale">Deal ends ${esc(day(p.dealEnds))}</span>`);
  return t.length ? `<div class="tags">${t.join('')}</div>` : '';
}

function head(p, metaBits) {
  const url = safeUrl(p.url);
  const img = p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : '';
  const title = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name);
  return `<div class="card-head">${img}<div><h3>${title}</h3><div class="meta">${metaBits
    .filter(Boolean)
    .map(esc)
    .join(' · ')}</div></div></div>`;
}

function productCard(p) {
  const meta = [
    p.modelNumber && `Model ${p.modelNumber}`,
    `SKU ${p.sku}`,
    p.rating && `★ ${p.rating} (${p.reviewCount ?? 0})`,
  ];
  return `<article class="card">
    ${head(p, meta)}
    ${priceBlock(p.salePrice, p.regularPrice)}
    ${memberBlock(p)}
    ${tags(p)}
    ${offerList('Offers', p.offers)}
    <div class="checked-at">Checked ${esc(when(p.checkedAt))}</div>
  </article>`;
}

function bundleCard(b) {
  const items = b.items
    .map((m) => {
      const url = safeUrl(m.url);
      const name = esc(m.name ?? `SKU ${m.sku}`);
      const member = m.memberPrice != null ? ` <span class="meta">(members ${money(m.memberPrice)})</span>` : '';
      const gifts = m.offers?.length ? `<div class="meta">Offers: ${m.offers.map(esc).join('; ')}</div>` : '';
      const inPackage = m.packageItemPrice != null && m.packageItemPrice !== m.salePrice
        ? ` <span class="save">${money(m.packageItemPrice)} in this package</span>` : '';
      return `<li>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${name}</a>` : name} — ${money(m.salePrice)}${inPackage}${member}${gifts}</li>`;
    })
    .join('');
  const lines = [];
  if (b.packagePrice == null) lines.push('<span class="meta">Package price not available right now; see Best Buy.</span>');
  if (b.bundleSavings > 0) lines.push(`<span class="save">Save ${money(b.bundleSavings)} vs. buying separately today</span>`);
  else if (b.packagePrice != null && b.separateTotal != null) lines.push(`<span class="meta">Same as buying separately today (${money(b.separateTotal)})</span>`);
  if (b.memberTotal != null && b.memberTotal < (b.packagePrice ?? b.separateTotal))
    lines.push(`<span class="member-line">Plus/Total members: ${money(b.memberTotal)} when bought separately with member prices</span>`);
  return `<article class="card">
    ${head(b, ['Package deal'])}
    ${priceBlock(b.packagePrice ?? b.separateTotal, b.regularTotal)}
    ${lines.map((l) => `<div>${l}</div>`).join('')}
    <p class="offers-title">Includes</p><ul class="members">${items}</ul>
    <div class="checked-at">Checked ${esc(when(b.checkedAt))}</div>
  </article>`;
}

const hasMemberDeal = (p) => Boolean(p.memberPrice);

function itemsFor(tab) {
  const d = state.data;
  if (tab === 'tvs') return d.tvs;
  if (tab === 'soundbars') return d.soundbars;
  if (tab === 'members') return [...d.tvs, ...d.soundbars].filter(hasMemberDeal);
  if (tab === 'bundles') return d.bundles;
  return [];
}

const priceOf = (p) => p.salePrice ?? p.packagePrice ?? p.separateTotal ?? null;

// Model series, e.g. "QM7K" from model number 65QM7K, or from the product name
// ("TCL - 85\" Class QM8L Series ...") when Best Buy gives no model number.
function tvSeries(p) {
  const fromModel = /^\d{2,3}([A-Z].*)$/i.exec(p.modelNumber ?? '');
  if (fromModel) return fromModel[1].toUpperCase();
  const fromName = /\d+"\s+(?:Class\s+)?(.+?)[ -]Series/i.exec(p.name ?? '');
  return fromName ? fromName[1].toUpperCase() : 'Other';
}

/**
 * Default TV order: model series from the most expensive to the least (by each
 * series' highest price), and within a series from the largest screen down.
 * Returns [{ series, tvs }].
 */
function seriesGroups(tvs) {
  const groups = new Map();
  for (const p of tvs) {
    const key = tvSeries(p);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const top = (list) => Math.max(...list.map((p) => priceOf(p) ?? 0));
  return [...groups]
    .map(([series, list]) => ({
      series,
      tvs: list.sort((a, b) => (b.screenSize ?? 0) - (a.screenSize ?? 0) || (priceOf(b) ?? 0) - (priceOf(a) ?? 0)),
    }))
    .sort((a, b) => top(b.tvs) - top(a.tvs) || a.series.localeCompare(b.series));
}

const groupedByModel = () => state.tab === 'tvs' && state.sort === 'default';

function sorted(items) {
  const eff = (p) => p.memberPrice?.price ?? priceOf(p) ?? Infinity;
  const savings = (p) =>
    p.items ? Math.max(p.savingsVsRegular ?? 0, p.bundleSavings ?? 0) : Math.max(p.dollarSavings ?? 0, p.memberPrice?.savings ?? 0);
  const s = [...items];
  switch (state.sort) {
    case 'price-asc': return s.sort((a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity));
    case 'price-desc': return s.sort((a, b) => (priceOf(b) ?? -1) - (priceOf(a) ?? -1));
    case 'savings': return s.sort((a, b) => savings(b) - savings(a));
    case 'size-desc': return s.sort((a, b) => (b.screenSize ?? 0) - (a.screenSize ?? 0) || (priceOf(a) ?? 0) - (priceOf(b) ?? 0));
    case 'size-asc': return s.sort((a, b) => (a.screenSize ?? Infinity) - (b.screenSize ?? Infinity) || (priceOf(a) ?? 0) - (priceOf(b) ?? 0));
    case 'name': return s.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    default:
      if (state.tab === 'tvs') return seriesGroups(s).flatMap((g) => g.tvs);
      return state.tab === 'members' ? s.sort((a, b) => eff(a) - eff(b)) : s;
  }
}

const maxPrice = () => PRICE_STEPS[state.maxStep ?? PRICE_STEPS.length - 1];
const tvFiltersActive = () => Object.values(state.f).some((set) => set.size);
const filtersActive = () => tvFiltersActive() || maxPrice() !== Infinity;
const showsTvFilters = () => state.tab === 'tvs' || state.tab === 'members';

function passesFilters(p) {
  const price = priceOf(p);
  if (maxPrice() !== Infinity && !(price != null && price <= maxPrice())) return false;
  if (!showsTvFilters()) return true;
  // TV-only filters leave out sound bars once any of them is in use.
  if (p.kind !== 'tv') return !tvFiltersActive();
  return Object.entries(FILTER_GROUPS).every(([key, g]) => !state.f[key].size || state.f[key].has(g.of(p)));
}

/** Draw the chip groups, each option showing how many TVs on this tab have it. */
function renderFilters() {
  document.querySelectorAll('.tv-only').forEach((el) => (el.hidden = !showsTvFilters()));
  $('#maxprice-out').textContent = maxPrice() === Infinity ? 'Any price' : `Under ${money(maxPrice()).replace('.00', '')}`;
  if (!showsTvFilters()) return;
  const tvs = itemsFor(state.tab).filter((p) => p.kind === 'tv' && (maxPrice() === Infinity || priceOf(p) <= maxPrice()));
  for (const [key, g] of Object.entries(FILTER_GROUPS)) {
    // Count within the other groups' current choices, so each number is how many
    // TVs you'd see after adding that option.
    const others = Object.entries(FILTER_GROUPS).filter(([k]) => k !== key);
    const counts = new Map();
    for (const p of tvs) {
      if (!others.every(([k, o]) => !state.f[k].size || state.f[k].has(o.of(p)))) continue;
      const v = g.of(p);
      if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    for (const p of tvs) {
      const v = g.of(p);
      if (v != null && !counts.has(v)) counts.set(v, 0);
    }
    for (const v of state.f[key]) if (!counts.has(v)) counts.set(v, 0);
    const values = [...counts.keys()];
    if (Array.isArray(g.order)) values.sort((a, b) => (g.order.indexOf(a) + 1 || 99) - (g.order.indexOf(b) + 1 || 99));
    else values.sort(g.order);
    $(g.el).innerHTML = values
      .map((v) => {
        const on = state.f[key].has(v);
        return `<button type="button" class="chip" data-group="${key}" data-value="${esc(v)}" aria-pressed="${on}"${!on && !counts.get(v) ? ' disabled' : ''}>${esc(g.label(v))}<span class="n">${counts.get(v)}</span></button>`;
      })
      .join('');
  }
}

function clearFilters() {
  for (const set of Object.values(state.f)) set.clear();
  state.maxStep = PRICE_STEPS.length - 1;
  $('#maxprice').value = String(state.maxStep);
  render();
}

function render() {
  const d = state.data;
  const q = state.q.trim().toLowerCase();
  let items = itemsFor(state.tab).filter(
    (p) => !q || `${p.name} ${p.modelNumber ?? ''} ${p.sku ?? ''} ${(p.items ?? []).map((i) => i.name).join(' ')}`.toLowerCase().includes(q),
  );
  if (state.onSale) items = items.filter((p) => p.onSale || p.memberPrice || p.bundleSavings > 0 || p.savingsVsRegular > 0);
  const total = items.length;
  items = sorted(items.filter(passesFilters));
  renderFilters();
  const noun = { tvs: 'TV', soundbars: 'sound bar', members: 'member deal', bundles: 'package' }[state.tab];
  $('#result-count').textContent = items.length === total
    ? `Showing all ${plural(total, noun)}`
    : `Showing ${items.length} of ${plural(total, noun)}`;
  $('#clear-filters').hidden = !filtersActive();

  const notice = $('#member-notice');
  const tips = {
    members: 'Member prices are for My Best Buy Plus™ and Total™ members, as shown to anyone browsing bestbuy.com. Membership is required at checkout.',
    bundles: 'Package deals that include a TCL sound bar. The package price is what Best Buy charges for the package; offers are listed under each item as Best Buy shows them.',
  };
  notice.hidden = !tips[state.tab];
  notice.textContent = tips[state.tab] ?? '';

  const panel = $('#panel');
  if (!items.length) {
    const msg = {
      tvs: 'No TCL TVs match.',
      soundbars: 'No TCL sound bars match.',
      members: 'No member deals on TCL TVs or sound bars right now.',
      bundles: 'No package deals with TCL sound bars right now.',
    }[state.tab];
    panel.innerHTML = filtersActive()
      ? `<div class="empty">Nothing matches these filters. <button type="button" class="clear-btn" id="empty-clear">Clear filters</button></div>`
      : `<div class="empty">${esc(msg)}</div>`;
    $('#empty-clear')?.addEventListener('click', clearFilters);
    return;
  }
  if (groupedByModel()) {
    panel.innerHTML = `<div class="grid">${seriesGroups(items)
      .map(({ series, tvs }) => {
        const prices = tvs.map(priceOf).filter((n) => typeof n === 'number');
        const low = Math.min(...prices);
        const high = Math.max(...prices);
        const range = low === high ? money(low) : `${money(low)} – ${money(high)}`;
        const sizes = tvs.map((p) => (p.screenSize ? `${p.screenSize}"` : null)).filter(Boolean).join(' · ');
        return `<h2 class="series-head"><span class="series-name">${esc(series)}</span>
          <span class="series-meta">${esc(sizes)} · ${esc(range)}</span></h2>${tvs.map(productCard).join('')}`;
      })
      .join('')}</div>`;
  } else {
    panel.innerHTML = `<div class="grid">${items
      .map((p) => (p.items ? bundleCard(p) : productCard(p)))
      .join('')}</div>`;
  }
  // Drop product photos that fail to load instead of showing a broken image.
  panel.querySelectorAll('img').forEach((img) => img.addEventListener('error', () => img.remove(), { once: true }));
}

function selectTab(tab) {
  state.tab = tab;
  document.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  try { localStorage.setItem('tab', tab); } catch {}
  render();
}

async function init() {
  try {
    const res = await fetch('data/prices.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    state.data = await res.json();
  } catch {
    $('#checked').textContent = 'No price data yet. Run the "Update prices" workflow to fetch it.';
    $('#panel').innerHTML = '<div class="empty">Prices haven\'t been fetched yet.</div>';
    return;
  }
  const d = state.data;
  $('#checked').innerHTML = `Prices checked <strong>${esc(when(d.checkedAt))}</strong> · ${plural(d.counts.tvs, 'TV')} · ${plural(d.counts.soundbars, 'sound bar')}`;
  const counts = {
    tvs: d.tvs.length,
    soundbars: d.soundbars.length,
    members: [...d.tvs, ...d.soundbars].filter(hasMemberDeal).length,
    bundles: d.bundles.length,
  };
  document.querySelectorAll('[data-count]').forEach((el) => (el.textContent = `(${counts[el.dataset.count]})`));

  document.querySelectorAll('[role="tab"]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
  $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $('#onsale').addEventListener('change', (e) => { state.onSale = e.target.checked; render(); });
  const slider = $('#maxprice');
  slider.max = String(PRICE_STEPS.length - 1);
  state.maxStep = PRICE_STEPS.length - 1;
  slider.value = String(state.maxStep);
  slider.addEventListener('input', () => {
    state.maxStep = Number(slider.value);
    render();
    slider.setAttribute('aria-valuetext', $('#maxprice-out').textContent);
  });
  $('#filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const set = state.f[chip.dataset.group];
    set.has(chip.dataset.value) ? set.delete(chip.dataset.value) : set.add(chip.dataset.value);
    render();
  });
  $('#clear-filters').addEventListener('click', clearFilters);

  let saved = null;
  try { saved = localStorage.getItem('tab'); } catch {}
  selectTab(counts[saved] !== undefined ? saved : 'tvs');
}

init();
