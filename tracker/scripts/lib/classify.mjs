// Decide whether a Best Buy product is a TCL TV or a TCL sound bar.

const ACCESSORY = /\b(mount|remote|stand|cable|bracket|subwoofer only|replacement)\b/i;

/** Returns 'tv' | 'soundbar' | null. `whatItIs` is Best Buy's own product type. */
export function kindOf({ name = '', whatItIs = [] }) {
  const types = whatItIs.join(' ');
  if (/sound ?bar/i.test(types)) return 'soundbar';
  if (/television/i.test(types)) return 'tv';
  if (ACCESSORY.test(name)) return null;
  if (/sound ?bar/i.test(name)) return 'soundbar';
  if (/\bclass\b.*\bTV\b|\bsmart TV\b|\b(google|roku|fire) TV\b/i.test(name)) return 'tv';
  return null;
}

export const isTcl = (p) => /^tcl$/i.test(p.brand ?? '') || /^TCL\b/.test(p.name ?? '');

/** Screen size in inches, from the product name. */
export function screenSize(name = '') {
  const m = /(\d{2,3})(?:"|”|''|-inch| inch)/i.exec(name);
  return m ? Number(m[1]) : null;
}
