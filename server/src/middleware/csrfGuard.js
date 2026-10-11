const env = require('../config/env');
const { forbidden } = require('../utils/AppError');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const CSRF_HEADER = 'x-requested-with';
const CSRF_HEADER_VALUE = 'kotuwa';

// Blocks cross-site form attacks on any request that changes data.
// Cookies are sameSite=strict, and our frontend always sends a custom header that
// another website cannot add without passing our CORS check.
function csrfGuard(req, res, next) {
  if (SAFE_METHODS.includes(req.method)) return next();

  if (req.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
    return next(forbidden('CSRF_CHECK_FAILED', 'Request blocked for security reasons.'));
  }

  const origin = req.get('origin');
  if (origin && origin !== env.CLIENT_URL) {
    return next(forbidden('CSRF_CHECK_FAILED', 'Request blocked for security reasons.'));
  }

  next();
}

module.exports = { csrfGuard, CSRF_HEADER, CSRF_HEADER_VALUE };
