const bcrypt = require('bcryptjs');
const env = require('../config/env');
const User = require('../models/User');
const tokenService = require('./tokenService');
const { notify } = require('./notifications/notify');
const { createRandomToken, hashToken } = require('../utils/crypto');
const { AppError, badRequest, unauthorized, forbidden, conflict } = require('../utils/AppError');

const BCRYPT_SALT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const EMAIL_VERIFY_HOURS = 24;
const PASSWORD_RESET_HOURS = 1;

// A real bcrypt hash used when the email does not exist, so a wrong email takes
// as long as a wrong password (attackers can't tell which emails are registered).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_SALT_ROUNDS);

// Hashes a plain password with bcrypt.
function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

// Builds a link to a page on the frontend, e.g. /verify-email?token=...
function frontendLink(path, token) {
  return `${env.CLIENT_URL}${path}?token=${token}`;
}

// Creates a new email verification token on the user and emails the link.
async function sendVerificationEmail(user) {
  const token = createRandomToken();
  user.emailVerifyTokenHash = hashToken(token);
  user.emailVerifyExpires = new Date(Date.now() + EMAIL_VERIFY_HOURS * 60 * 60 * 1000);
  await user.save();

  await notify(user, 'verifyEmail', { url: frontendLink('/verify-email', token) });
}

// Creates a new customer or seller account and sends the verification email.
async function registerUser({ name, email, password, role, phone, preferredLanguage }) {
  const existing = await User.exists({ email });
  if (existing) {
    throw conflict('EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const user = await User.create({
    name,
    email,
    phone,
    role,
    preferredLanguage,
    passwordHash: await hashPassword(password),
  });

  await sendVerificationEmail(user);
  return user;
}

// Marks the email as verified when the token from the email link is valid.
async function verifyEmail(token) {
  const user = await User.findOne({
    emailVerifyTokenHash: hashToken(token),
    emailVerifyExpires: { $gt: new Date() },
  });

  if (!user) {
    throw badRequest('INVALID_TOKEN', 'This verification link is invalid or has expired.');
  }

  user.isEmailVerified = true;
  user.emailVerifyTokenHash = undefined;
  user.emailVerifyExpires = undefined;
  await user.save();
  return user;
}

// Sends a new verification email. Says nothing about whether the email exists.
async function resendVerification(email) {
  const user = await User.findOne({ email, isEmailVerified: false, isActive: true });
  if (user) await sendVerificationEmail(user);
}

// Counts a failed login and locks the account after too many failures.
async function recordFailedLogin(user) {
  const updated = await User.findByIdAndUpdate(
    user._id,
    { $inc: { failedLoginCount: 1 } },
    { new: true, projection: '+failedLoginCount' }
  );

  if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
    await User.updateOne(
      { _id: user._id },
      { failedLoginCount: 0, lockUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) }
    );
  }
}

// Checks email + password and returns the user plus a new token pair.
async function loginUser({ email, password }, meta) {
  const user = await User.findOne({ email }).select('+passwordHash +failedLoginCount +lockUntil');

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  if (user.isLocked()) {
    throw new AppError(423, 'ACCOUNT_LOCKED', `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    await recordFailedLogin(user);
    throw unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  if (!user.isActive) {
    throw forbidden('ACCOUNT_DISABLED', 'Your account has been disabled.');
  }

  if (!user.isEmailVerified) {
    throw forbidden('EMAIL_NOT_VERIFIED', 'Please verify your email address first.');
  }

  if (user.failedLoginCount > 0 || user.lockUntil) {
    await User.updateOne({ _id: user._id }, { failedLoginCount: 0, $unset: { lockUntil: 1 } });
  }

  const tokens = await tokenService.issueTokenPair(user, meta);
  return { user, ...tokens };
}

// Starts the "forgot password" flow. Always succeeds so emails can't be probed.
async function requestPasswordReset(email) {
  const user = await User.findOne({ email, isActive: true });
  if (!user) return;

  const token = createRandomToken();
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_HOURS * 60 * 60 * 1000);
  await user.save();

  await notify(user, 'resetPassword', { url: frontendLink('/reset-password', token) });
}

// Saves a new password, logs the user out everywhere and tells them by email.
async function setNewPassword(user, newPassword) {
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.failedLoginCount = 0;
  user.lockUntil = undefined;
  await user.save();

  await tokenService.revokeAllUserTokens(user._id);
  await notify(user, 'passwordChanged');
}

// Finishes the "forgot password" flow using the token from the email link.
async function resetPassword(token, newPassword) {
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw badRequest('INVALID_TOKEN', 'This reset link is invalid or has expired.');
  }

  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  // Clicking the emailed link proves the user owns the email.
  user.isEmailVerified = true;
  await setNewPassword(user, newPassword);
}

// Changes the password of a logged-in user after checking the current one.
async function changePassword(userId, { currentPassword, newPassword }, meta) {
  const user = await User.findById(userId).select('+passwordHash');

  const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentMatches) {
    throw badRequest('WRONG_PASSWORD', 'Your current password is incorrect.');
  }

  await setNewPassword(user, newPassword);

  // Keep this device logged in with a brand-new token pair.
  return tokenService.issueTokenPair(user, meta);
}

module.exports = {
  hashPassword,
  sendVerificationEmail,
  registerUser,
  verifyEmail,
  resendVerification,
  loginUser,
  requestPasswordReset,
  resetPassword,
  changePassword,
};
