const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { hashPassword } = require('./authService');
const { revokeAllUserTokens } = require('./tokenService');
const { logAudit } = require('./auditService');
const { badRequest, notFound, conflict } = require('../utils/AppError');

// Escapes text so it can be used safely inside a regular expression search.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns one page of users, optionally filtered by role or a name/email search.
async function listUsers({ role, search, page, limit }) {
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);

  return { users, total, page, limit };
}

// Loads the user an admin wants to change, and blocks changes that are never allowed.
async function loadChangeableUser(adminUser, targetId) {
  if (String(adminUser._id) === targetId) {
    throw badRequest('CANNOT_CHANGE_SELF', 'You cannot change your own account here.');
  }

  const target = await User.findById(targetId);
  if (!target) throw notFound('USER_NOT_FOUND', 'User not found.');

  if (target.role === ROLES.SUPER_ADMIN) {
    throw badRequest('CANNOT_CHANGE_ADMIN', 'Super admin accounts cannot be changed here.');
  }
  if (target.role === ROLES.SELLER_CASHIER) {
    throw badRequest('CASHIER_MANAGED_BY_SELLER', 'Cashier accounts are managed by their shop.');
  }

  return target;
}

// Changes a user's role (never to super_admin) and writes an audit log entry.
async function changeUserRole(req, targetId, newRole) {
  const target = await loadChangeableUser(req.user, targetId);
  const oldRole = target.role;

  target.role = newRole;
  // Old access tokens carry the old role; this forces a quick refresh with the new one.
  target.tokenVersion = (target.tokenVersion || 0) + 1;
  await target.save();

  await logAudit(req, {
    action: 'user.role_change',
    targetModel: 'User',
    targetId: target._id,
    before: { role: oldRole },
    after: { role: newRole },
  });

  return target;
}

// Enables or disables a user. Disabling also logs them out everywhere.
async function changeUserStatus(req, targetId, isActive) {
  const target = await loadChangeableUser(req.user, targetId);
  const wasActive = target.isActive;

  target.isActive = isActive;
  await target.save();

  if (!isActive) await revokeAllUserTokens(target._id);

  await logAudit(req, {
    action: isActive ? 'user.enable' : 'user.disable',
    targetModel: 'User',
    targetId: target._id,
    before: { isActive: wasActive },
    after: { isActive },
  });

  return target;
}

// Creates a rider account. Riders can't sign up themselves; the admin vouches for them.
async function createRider(req, { name, email, phone, password }) {
  if (await User.exists({ email })) {
    throw conflict('EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const rider = await User.create({
    name,
    email,
    phone,
    role: ROLES.RIDER,
    isEmailVerified: true,
    passwordHash: await hashPassword(password),
  });

  await logAudit(req, {
    action: 'user.create_rider',
    targetModel: 'User',
    targetId: rider._id,
    after: { role: ROLES.RIDER, email },
  });

  return rider;
}

module.exports = { listUsers, changeUserRole, changeUserStatus, createRider };
