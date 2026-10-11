const User = require('../models/User');
const { verifyAccessToken } = require('../services/tokenService');
const { ACCESS_COOKIE } = require('../utils/authCookies');
const { unauthorized } = require('../utils/AppError');

// Checks the access-token cookie and loads the logged-in user into req.user.
// The user is re-read from the database, so a disabled account or changed role takes effect at once.
async function authenticate(req, res, next) {
  try {
    const token = req.cookies[ACCESS_COOKIE];
    if (!token) throw unauthorized('NOT_LOGGED_IN', 'Please log in.');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
      throw unauthorized(code, 'Your session has expired. Please log in again.');
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw unauthorized('ACCOUNT_DISABLED', 'Your account is not active.');

    // Tokens issued before a password or role change carry an old version number.
    // The browser then refreshes once and gets a token with the current role.
    if (payload.ver !== (user.tokenVersion || 0)) {
      throw unauthorized('TOKEN_REVOKED', 'Your session changed. Please sign in again.');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authenticate;
