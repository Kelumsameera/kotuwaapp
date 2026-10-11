const authService = require('../services/authService');
const tokenService = require('../services/tokenService');
const { serializeUser } = require('../utils/serialize');
const { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } = require('../utils/authCookies');

// Collects the IP and browser info saved next to each refresh token.
function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

// POST /api/auth/register
async function register(req, res) {
  await authService.registerUser(req.body);
  res.status(201).json({ message: 'Account created. Please check your email to verify your address.' });
}

// POST /api/auth/verify-email
async function verifyEmail(req, res) {
  await authService.verifyEmail(req.body.token);
  res.json({ message: 'Email verified. You can now log in.' });
}

// POST /api/auth/resend-verification
async function resendVerification(req, res) {
  await authService.resendVerification(req.body.email);
  res.json({ message: 'If that account exists and is not verified, a new email has been sent.' });
}

// POST /api/auth/login
async function login(req, res) {
  const { user, accessToken, refreshToken } = await authService.loginUser(req.body, requestMeta(req));
  setAuthCookies(res, { accessToken, refreshToken });
  res.json({ user: serializeUser(user) });
}

// POST /api/auth/refresh
async function refresh(req, res) {
  try {
    const { user, accessToken, refreshToken } = await tokenService.rotateRefreshToken(
      req.cookies[REFRESH_COOKIE],
      requestMeta(req)
    );
    setAuthCookies(res, { accessToken, refreshToken });
    res.json({ user: serializeUser(user) });
  } catch (error) {
    // A failed refresh means the session is over, so remove the dead cookies too.
    // Except in a tab race: then the browser already holds new, valid cookies.
    if (error.code !== 'REFRESH_RACE') clearAuthCookies(res);
    throw error;
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  await tokenService.revokeRefreshToken(req.cookies[REFRESH_COOKIE]);
  clearAuthCookies(res);
  res.json({ message: 'Logged out.' });
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.body.email);
  res.json({ message: 'If that account exists, a reset link has been sent.' });
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  await authService.resetPassword(req.body.token, req.body.password);
  clearAuthCookies(res);
  res.json({ message: 'Password changed. Please log in with your new password.' });
}

// POST /api/auth/change-password (logged in)
async function changePassword(req, res) {
  const tokens = await authService.changePassword(req.user._id, req.body, requestMeta(req));
  setAuthCookies(res, tokens);
  res.json({ message: 'Password changed. Other devices have been logged out.' });
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};
