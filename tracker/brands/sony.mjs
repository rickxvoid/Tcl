// bestbuy.com searches for Sony TVs and home theater audio (sound bars, home
// theater systems, and the subwoofers and rear speakers that pair with them).

const MEMBER_FACET = 'currentoffers_facet=Current Deals~Plus & Total Member Deals';
const PACKAGE_FACET = 'currentoffers_facet=Current Deals~Package Deals';
const BBY_FACET = 'bbyonly_facet=Sold & shipped by~Best Buy';
const BRAND_FACET = 'brand_facet=Brand~Sony';

export default {
  brand: 'Sony',
  isBrand: (p) => /^sony$/i.test(p.brand ?? '') || /^Sony\b/.test(p.name ?? ''),
  audioTypes: /sound ?bar|home theater|home theatre|subwoofer|surround|rear speaker|speaker system/i,
  dataDir: '../sony/data',
  listings: [
    { label: 'Sony TVs (category)', browsedCategory: 'abcat0101000', id: 'pcat17071', qp: BRAND_FACET, st: 'categoryid$abcat0101000' },
    { label: 'Sony TVs (search)', id: 'pcat17071', st: 'sony tv' },
    { label: 'Sony sound bars (category)', browsedCategory: 'abcat0205007', id: 'pcat17071', qp: BRAND_FACET, st: 'categoryid$abcat0205007' },
    { label: 'Sony sound bars (search)', st: 'sony sound bar' },
    { label: 'Sony BRAVIA Theater (search)', st: 'sony bravia theater' },
    { label: 'Sony home theater systems (search)', st: 'sony home theater system' },
    { label: 'Sony subwoofers (search)', st: 'sony subwoofer' },
    { label: 'Sony rear speakers (search)', st: 'sony rear speakers' },
  ],
  memberListings: [
    { id: 'pcat17071', st: 'sony tv', qp: MEMBER_FACET },
    { st: 'sony sound bar', qp: MEMBER_FACET },
    { st: 'sony home theater', qp: MEMBER_FACET },
  ],
  packageListings: [
    { st: 'sony sound bar', qp: PACKAGE_FACET },
    { st: 'sony home theater', qp: PACKAGE_FACET },
    { id: 'pcat17071', st: 'sony tv', qp: PACKAGE_FACET },
  ],
  soldByListings: [
    { label: 'Sony TVs sold by Best Buy', id: 'pcat17071', st: 'sony tv', qp: BBY_FACET },
    { label: 'Sony sound bars sold by Best Buy', st: 'sony sound bar', qp: BBY_FACET },
    { label: 'Sony home theater sold by Best Buy', st: 'sony home theater', qp: BBY_FACET },
  ],
};
