// Scryfall's public API serves card art directly and allows normal
// browser <img> loading (no API key, no auth). This only failed inside
// the Claude.ai artifact sandbox because of its content-security-policy —
// it works normally in a real page.
export function scryfallImageUrl(name, size = 'small') {
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=${size}`;
}
