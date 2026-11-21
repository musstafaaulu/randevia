// Deterministic background colour for an initials avatar: same name always
// gets the same colour, picked from a small curated palette so it stays
// legible with white text instead of a random, possibly clashing hue.
const PALETTE = [
  '#0f766e',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#d97706',
  '#059669',
  '#0891b2',
  '#4f46e5',
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
