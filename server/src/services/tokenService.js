const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const { hashToken } = require('../utils/crypto');
const { unauthorized } = require('../utils/AppError');

const ACCESS_TOKEN_MS = env.ACCESS_TOKEN_MINUTES * 60 * 1000;
const REFRESH_TOKEN_MS = env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

// Two browser tabs may refresh at the same moment; within this window that is not treated as theft.
const ROTATION_GRACE_MS = 30 * 1000;

// Creates a short-lived access token (15 minutes by default).
function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, ver: user.tokenVersion || 0 }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_MINUTES * 60,
  });
}

// Checks an access token and returns its payload. Throws if it is invalid or expired.
function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

// Creates a refresh token, saves its hash in MongoDB and returns the real token.
async function issueRefreshToken(user, { family, ip, userAgent } = {}) {
  const tokenFamily = family || crypto.randomUUID();
  const token = jwt.sign(
    { sub: String(user._id), family: tokenFamily, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 }
  );

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(token),
    family: tokenFamily,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS),
    createdByIp: ip,
    userAgent: userAgent ? userAgent.slice(0, 300) : undefined,
  });

  return token;
}

// Creates both tokens for a fresh login.
async function issueTokenPair(user, meta) {
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user, meta);
  return { accessToken, refreshToken };
}

// Revokes every token in a family (used when a stolen token is detected).
async function revokeTokenFamily(family) {
  await RefreshToken.updateMany({ family, revokedAt: null }, { revokedAt: new Date() });
}

// Revokes all refresh tokens of a user (logout everywhere, password change, account disabled).
async function revokeAllUserTokens(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}

// Revokes a single refresh token (normal logout).
async function revokeRefreshToken(token) {
  if (!token) return;
  await RefreshToken.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { revokedAt: new Date() });
}

// Returns true if this token was rotated (not revoked by logout) in the last few seconds.
async function wasJustRotated(tokenHash) {
  const record = await RefreshToken.findOne({ tokenHash, replacedByHash: { $exists: true } });
  return Boolean(record && record.revokedAt > new Date(Date.now() - ROTATION_GRACE_MS));
}

// Swaps an old refresh token for a new pair. The old one is revoked (rotation).
// If an already-revoked token is used again, the whole family is revoked (theft detection).
async function rotateRefreshToken(oldToken, meta) {
  if (!oldToken) throw unauthorized('NO_REFRESH_TOKEN', 'Please log in.');

  let payload;
  try {
    payload = jwt.verify(oldToken, env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw unauthorized('INVALID_REFRESH_TOKEN', 'Your session has ended. Please log in again.');
  }

  const oldHash = hashToken(oldToken);

  // Atomically mark the old token as used, so two parallel refreshes cannot both succeed.
  const record = await RefreshToken.findOneAndUpdate(
    { tokenHash: oldHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { revokedAt: new Date() },
    { new: true }
  );

  if (!record) {
    if (await wasJustRotated(oldHash)) {
      // Another browser tab refreshed a moment ago and the browser already has its new cookies.
      // Nothing new is issued here, so this gives an attacker nothing.
      throw unauthorized('REFRESH_RACE', 'Session was just refreshed. Retry the request.');
    }
    await revokeTokenFamily(payload.family);
    throw unauthorized('REFRESH_TOKEN_REUSED', 'Your session has ended. Please log in again.');
  }

  const user = await User.findById(record.user);
  if (!user || !user.isActive) {
    await revokeTokenFamily(record.family);
    throw unauthorized('ACCOUNT_DISABLED', 'Your account is not active.');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user, { family: record.family, ...meta });

  record.replacedByHash = hashToken(refreshToken);
  await record.save();

  return { user, accessToken, refreshToken };
}

module.exports = {
  ACCESS_TOKEN_MS,
  REFRESH_TOKEN_MS,
  signAccessToken,
  verifyAccessToken,
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
