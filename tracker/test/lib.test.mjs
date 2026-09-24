import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apolloPayloads, parseSearchPage, parseComboPage, memberPricing, normalizeProduct } from '../scripts/lib/bestbuy-page.mjs';
import { kindOf, isTcl, screenSize } from '../scripts/lib/classify.mjs';
import { updateHistory } from '../scripts/lib/history.mjs';
import { searchUrl } from '../scripts/lib/http.mjs';

// Pages shaped like bestbuy.com's server-rendered HTML. Illustrative prices only.
const apollo = (obj) =>
  `<script>(window[Symbol.for("ApolloSSRDataTransport")] ??= []).push(${JSON.stringify(obj).replace(/"__UNDEF__"/g, 'undefined')})</script>`;

const tvProduct = {
  __typename: 'Product',
  skuId: '1001',
  brand: 'TCL',
  whatItIs: ['Television'],
  seller: { __typename: 'Seller', classification: '1P', id: 'bby' },
  name: { __typename: 'ProductName', short: 'TCL - 65" Class QM6K Series 4K UHD HDR QD Mini LED Smart TV with Google TV (2025)' },
  manufacturer: { modelNumber: '65QM6K' },
  url: { skuSpecificUrl: 'https://www.bestbuy.com/product/x/J1/sku/1001' },
  badges: [{ displayName: 'Free Installation', detailsHref: 'https://www.bestbuy.com/site/promo/x', endDate: '2026-09-28T04:45Z' }],
  price: {
    __typename: 'ItemPrice',
    displayableCustomerPrice: 999.99,
    displayableRegularPrice: 999.99,
    totalSavings: 0,
    totalPaidMemberSavings: 0,
    whatIfPrice: {
      planPaidMember2: { price: 699.99, savings: 300 },
      planPaidMember3: { price: 699.99, savings: 300 },
    },
    giftSkus: [{ skuId: '9' }],
  },
};

const searchPage = [
  apollo({
    rehydrate: {
      ':a:': {
        data: {
          search: {
            documents: [
              { __typename: 'SearchProduct', product: { __typename: 'Product', skuId: '1001' } },
              { __typename: 'SearchProduct', product: { __typename: 'Product', skuId: '1002' } },
            ],
          },
          other: '__UNDEF__',
        },
      },
    },
  }),
  apollo({ rehydrate: { ':b:': { data: { productBySkuId: tvProduct } } } }),
  // An open-box listing with the same SKU must not leak its price into the new item.
  apollo({
    rehydrate: {
      ':c:': {
        data: {
          productBySkuId: { __typename: 'Product', skuId: '1001', openBoxCondition: 2, price: { customerPrice: 650, openBoxCondition: 2 } },
        },
      },
    },
  }),
  '<script>"numFound":2</script>',
].join('\n');

test('parses products, member prices and badges from a search page', () => {
  assert.equal(apolloPayloads(searchPage).length, 3);
  const page = parseSearchPage(searchPage);
  assert.equal(page.count, 2);
  assert.deepEqual(page.skus, ['1001', '1002']);
  assert.deepEqual(page.unpricedSkus, ['1002']);
  const p = page.products.get('1001');
  assert.equal(p.salePrice, 999.99);
  assert.equal(p.regularPrice, 999.99);
  assert.equal(p.onSale, false);
  assert.equal(p.seller, '1P');
  assert.deepEqual(p.memberPrice, { price: 699.99, highPrice: null, savings: 300, tier: 'My Best Buy Plus & Total' });
  assert.equal(p.offers[0].text, 'Free Installation');
  assert.equal(p.freeGiftOffers, 1);
});

test('a price fragment without a regular price leaves it unknown', () => {
  const p = normalizeProduct({ skuId: '5', price: { currentPrice: 599.99 } });
  assert.equal(p.salePrice, 599.99);
  assert.equal(p.regularPrice, null);
  assert.equal(p.onSale, null);
  assert.equal(normalizeProduct({ skuId: '6', price: {} }), null);
});

test('member pricing', () => {
  assert.equal(memberPricing({ whatIfPrice: null, totalPaidMemberSavings: 0 }, 500), null);
  // A "member" price that isn't lower than the regular price is not a deal.
  assert.equal(memberPricing({ whatIfPrice: { a: { price: 500 } } }, 500), null);
  const tiers = memberPricing({ whatIfPrice: { a: { price: 450 }, b: { price: 430 } } }, 500);
  assert.equal(tiers.price, 430);
  assert.equal(tiers.highPrice, 450);
});

test('parses a package page', () => {
  const data = {
    app: {
      data: {
        showPackagePrice: true,
        customerPrice: 1299.98,
        bundlePriceSkus: [
          { skuId: '2001', regularPrice: 299.99, customerPrice: 299.99 },
          { skuId: '1001', regularPrice: 999.99, customerPrice: 999.99, offerQualifiers: [{ offerName: 'Fubo GWP' }] },
        ],
      },
    },
  };
  const html = `<h1>Package - TCL &quot;Sound Bar&quot; and TV</h1><script type="application/json" id="pricing-price-51103827-json">${JSON.stringify(data)}</script>`;
  const c = parseComboPage(html);
  assert.equal(c.title, 'Package - TCL "Sound Bar" and TV');
  assert.equal(c.packagePrice, 1299.98);
  assert.equal(c.items.length, 2);
  assert.deepEqual(c.items[1].offers, ['Fubo GWP']);
  assert.equal(parseComboPage('<html></html>'), null);
});

test('classify', () => {
  assert.equal(kindOf({ whatItIs: ['Television'] }), 'tv');
  assert.equal(kindOf({ whatItIs: ['Soundbar'] }), 'soundbar');
  assert.equal(kindOf({ name: 'TCL - Q Class Premium 3.1 Channel Sound Bar - Black' }), 'soundbar');
  assert.equal(kindOf({ name: 'TCL - Full-Motion TV Wall Mount' }), null);
  assert.ok(isTcl({ brand: 'TCL' }));
  assert.ok(!isTcl({ brand: 'Hisense', name: 'Hisense - 65" TV' }));
  assert.equal(screenSize('TCL - 65" Class QM6K'), 65);
});

test('search URLs', () => {
  const u = new URL(searchUrl({ st: 'tcl tv', id: 'pcat17071', qp: 'brand_facet=Brand~TCL', cp: 2 }));
  assert.equal(u.searchParams.get('st'), 'tcl tv');
  assert.equal(u.searchParams.get('qp'), 'brand_facet=Brand~TCL');
  assert.equal(u.searchParams.get('cp'), '2');
  assert.equal(new URL(searchUrl({ st: 'x', cp: 1 })).searchParams.get('cp'), null);
});

test('history records only changes', () => {
  let h = updateHistory({}, [{ sku: '1', salePrice: 500 }], 't1');
  h = updateHistory(h, [{ sku: '1', salePrice: 500 }], 't2');
  h = updateHistory(h, [{ sku: '1', salePrice: 450, memberPrice: { price: 430 } }], 't3');
  assert.deepEqual(h['1'], [{ t: 't1', p: 500, m: null }, { t: 't3', p: 450, m: 430 }]);
});
