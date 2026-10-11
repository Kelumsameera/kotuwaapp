const { filterXSS } = require('xss');

// Password fields are never shown anywhere, so they are left exactly as typed.
const SKIPPED_FIELDS = ['password', 'currentPassword', 'newPassword'];

// Cleans one value: strings lose any HTML/script tags, objects and arrays are cleaned deeply.
function cleanValue(value, fieldName) {
  if (SKIPPED_FIELDS.includes(fieldName)) return value;
  if (typeof value === 'string') return filterXSS(value, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] });
  if (Array.isArray(value)) return value.map((item) => cleanValue(item, fieldName));

  if (value && typeof value === 'object') {
    const cleaned = {};
    for (const [key, inner] of Object.entries(value)) cleaned[key] = cleanValue(inner, key);
    return cleaned;
  }

  return value;
}

// Removes HTML from all text in the request body (XSS protection).
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = cleanValue(req.body);
  }
  next();
}

module.exports = sanitizeInput;
