// bestbuy.com searches for TCL TVs and sound bars.

const MEMBER_FACET = 'currentoffers_facet=Current Deals~Plus & Total Member Deals';
const PACKAGE_FACET = 'currentoffers_facet=Current Deals~Package Deals';
const BBY_FACET = 'bbyonly_facet=Sold & shipped by~Best Buy';
const BRAND_FACET = 'brand_facet=Brand~TCL';

export default {
  brand: 'TCL',
  isBrand: (p) => /^tcl$/i.test(p.brand ?? '') || /^TCL\b/.test(p.name ?? ''),
  // Best Buy product types (whatItIs) counted as audio for this site.
  audioTypes: /sound ?bar/i,
  dataDir: '../prices/data',
  // Listing pages that together cover every TCL TV and sound bar.
  listings: [
    { label: 'TCL TVs (category)', browsedCategory: 'abcat0101000', id: 'pcat17071', qp: BRAND_FACET, st: 'categoryid$abcat0101000' },
    { label: 'TCL TVs (search)', id: 'pcat17071', st: 'tcl tv' },
    { label: 'TCL sound bars (category)', browsedCategory: 'abcat0205007', id: 'pcat17071', qp: BRAND_FACET, st: 'categoryid$abcat0205007' },
    { label: 'TCL sound bars (search)', st: 'tcl sound bar' },
    { label: 'TCL soundbars (search)', st: 'tcl soundbar' },
  ],
  // Best Buy's own "Plus & Total Member Deals" filter.
  memberListings: [
    { id: 'pcat17071', st: 'tcl tv', qp: MEMBER_FACET },
    { st: 'tcl sound bar', qp: MEMBER_FACET },
  ],
  // Best Buy's "Package Deals" filter.
  packageListings: [
    { st: 'tcl sound bar', qp: PACKAGE_FACET },
    { id: 'pcat17071', st: 'tcl tv', qp: PACKAGE_FACET },
  ],
  // "Sold & shipped by: Best Buy", to tell Best Buy's listings from marketplace ones.
  soldByListings: [
    { label: 'TCL TVs sold by Best Buy', id: 'pcat17071', st: 'tcl tv', qp: BBY_FACET },
    { label: 'TCL sound bars sold by Best Buy', st: 'tcl sound bar', qp: BBY_FACET },
  ],
};
