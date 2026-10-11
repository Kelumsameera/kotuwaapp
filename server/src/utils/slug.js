const crypto = require('crypto');

// Turns "Nimal's Shop!" into "nimals-shop". Non-English names give an empty base.
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Makes a URL-friendly id like "red-kandyan-saree-4f9a2c" that is very unlikely to clash.
function uniqueSlug(text, fallback = 'item') {
  const base = slugify(text) || fallback;
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

module.exports = { slugify, uniqueSlug };
