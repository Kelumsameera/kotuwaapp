const crypto = require('crypto');

// Creates a long random string, safe to put in a URL (for email verify / password reset links).
function createRandomToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('hex');
}

// Hashes a token with sha256 so the database never holds the real token.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { createRandomToken, hashToken };
