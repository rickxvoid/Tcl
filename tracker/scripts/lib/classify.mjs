// Decide whether a Best Buy product is a TV or home audio (sound bars and, for
// some brands, home theater systems, subwoofers and rear speakers).

const ACCESSORY = /\b(mount|remote|stand|cable|bracket|subwoofer only|replacement)\b/i;

/**
 * Returns 'tv' | 'soundbar' | null. `whatItIs` is Best Buy's own product type;
 * `audioTypes` says which types count as audio (kind 'soundbar'), and
 * `audioNames` which product names do when the type is too generic.
 */
export function kindOf({ name = '', whatItIs = [] }, audioTypes = /sound ?bar/i, audioNames = null) {
  const types = whatItIs.join(' ');
  // Best Buy files some TVs under other types, e.g. Sony's "RGB TV".
  if (/television|\bRGB TV\b/i.test(types) && !/portable/i.test(types)) return 'tv';
  if (types && audioTypes.test(types)) return 'soundbar';
  // Generic types like "Speaker" count only when the name says it's home theater
  // gear (e.g. rear speakers), not a party or bookshelf speaker.
  if (types && audioNames?.test(name)) return 'soundbar';
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
