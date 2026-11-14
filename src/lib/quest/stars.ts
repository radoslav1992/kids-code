// Code Quest stars, kept in this browser only.
const KEY = 'kids-code-quest-stars-v1';

export function readStars(): Record<string, number> {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const stars: Record<string, number> = {};
    for (const [slug, value] of Object.entries(data).slice(0, 200)) {
      if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3) stars[slug] = value;
    }
    return stars;
  } catch {
    return {};
  }
}

/** Remember the best result for a level. Returns the best star count so far. */
export function saveStars(slug: string, earned: number): number {
  const stars = readStars();
  const best = Math.max(stars[slug] || 0, earned);
  stars[slug] = best;
  try { localStorage.setItem(KEY, JSON.stringify(stars)); } catch {}
  window.dispatchEvent(new Event('quest-stars'));
  return best;
}

export function clearStars() {
  try { localStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new Event('quest-stars'));
}
