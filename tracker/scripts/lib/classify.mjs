// Decide whether a Best Buy product is a TV or home audio (sound bars and, for
// some brands, home theater systems, subwoofers and rear speakers).

const ACCESSORY = /\b(mount|remote|stand|cable|bracket|subwoofer only|replacement)\b/i;

/**
 * Returns 'tv' | 'soundbar' | null. `whatItIs` is Best Buy's own product type;
 * `audioTypes` says which types count as audio (kind 'soundbar').
 */
export function kindOf({ name = '', whatItIs = [] }, audioTypes = /sound ?bar/i) {
  const types = whatItIs.join(' ');
  if (/television/i.test(types)) return 'tv';
  if (types && audioTypes.test(types)) return 'soundbar';
  if (types) return null;
  if (ACCESSORY.test(name)) return null;
  if (audioTypes.test(name)) return 'soundbar';
  if (/\bclass\b.*\bTV\b|\bsmart TV\b|\b(google|roku|fire) TV\b/i.test(name)) return 'tv';
  return null;
}

/** Screen size in inches, from the product name. */
export function screenSize(name = '') {
  const m = /(\d{2,3})(?:"|”|''|-inch| inch)/i.exec(name);
  return m ? Number(m[1]) : null;
}
