const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { hashPassword, sendVerificationEmail } = require('./authService');
const { revokeAllUserTokens } = require('./tokenService');
const { logAudit } = require('./auditService');
const { badRequest, conflict, notFound } = require('../utils/AppError');

const MAX_CASHIERS = 20;

// Seller: the cashier accounts of their own shop.
function listCashiers(shop) {
  return User.find({ shop: shop._id, role: ROLES.SELLER_CASHIER }).sort({ createdAt: 1 });
}

// Finds one of THIS shop's cashiers. Any other user (another shop's cashier, a customer…) is 404.
async function findMyCashier(shop, userId) {
  const cashier = await User.findOne({ _id: userId, shop: shop._id, role: ROLES.SELLER_CASHIER });
  if (!cashier) throw notFound('STAFF_NOT_FOUND', 'Staff member not found.');
  return cashier;
}

// Seller: creates a cashier who can only use this shop's POS.
// The seller sets the first password. The cashier must still verify the email address
// (the seller can't vouch for an address they may not own), so a verification email is sent.
async function createCashier(req, shop, { name, email, phone, password }) {
  if ((await User.countDocuments({ shop: shop._id, role: ROLES.SELLER_CASHIER })) >= MAX_CASHIERS) {
    throw badRequest('STAFF_LIMIT', `A shop can have up to ${MAX_CASHIERS} cashiers.`);
  }
  if (await User.exists({ email })) throw conflict('EMAIL_TAKEN', 'An account with this email already exists.');

  const cashier = await User.create({
    name,
    email,
    phone,
    role: ROLES.SELLER_CASHIER,
    shop: shop._id,
    passwordHash: await hashPassword(password),
  });
  await sendVerificationEmail(cashier);

  await logAudit(req, { action: 'staff.create', targetModel: 'User', targetId: cashier._id, after: { email, shop: shop._id } });
  return cashier;
}

// Seller: turns a cashier's account on or off. Turning off logs them out everywhere at once.
async function setCashierActive(req, shop, userId, isActive) {
  const cashier = await findMyCashier(shop, userId);
  cashier.isActive = isActive;
  await cashier.save();
  if (!isActive) await revokeAllUserTokens(cashier._id);

  await logAudit(req, { action: isActive ? 'staff.enable' : 'staff.disable', targetModel: 'User', targetId: cashier._id });
  return cashier;
}

// Seller: sets a new password for a cashier (e.g. they forgot it). Logs them out everywhere.
async function resetCashierPassword(req, shop, userId, password) {
  const cashier = await findMyCashier(shop, userId);
  cashier.passwordHash = await hashPassword(password);
  cashier.passwordChangedAt = new Date();
  cashier.tokenVersion = (cashier.tokenVersion || 0) + 1;
  cashier.failedLoginCount = 0;
  cashier.lockUntil = undefined;
  await cashier.save();
  await revokeAllUserTokens(cashier._id);

  await logAudit(req, { action: 'staff.reset_password', targetModel: 'User', targetId: cashier._id });
  return cashier;
}

module.exports = { MAX_CASHIERS, listCashiers, createCashier, setCashierActive, resetCashierPassword };
