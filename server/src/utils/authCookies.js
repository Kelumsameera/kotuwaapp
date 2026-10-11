const env = require('../config/env');
const { ACCESS_TOKEN_MS, REFRESH_TOKEN_MS } = require('../services/tokenService');

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

// The refresh cookie is only sent to /api/auth, so it is never exposed to other routes.
const REFRESH_COOKIE_PATH = '/api/auth';

// Shared cookie settings: not readable by JavaScript, only sent to our own site.
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
  };
}

// Puts both tokens into httpOnly cookies on the response.
function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOptions(), path: '/', maxAge: ACCESS_TOKEN_MS });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_MS,
  });
}

// Removes both auth cookies (logout).
function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions(), path: REFRESH_COOKIE_PATH });
}

module.exports = { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies, clearAuthCookies };
