const { forbidden, unauthorized } = require('../utils/AppError');

// Lets the request continue only if the logged-in user has one of the given roles.
// Use after authenticate, e.g. authorizeRoles(...rolesWith('users:manage')).
function authorizeRoles(...allowedRoles) {
  if (allowedRoles.length === 0) {
    throw new Error('authorizeRoles needs at least one role');
  }

  return function checkRole(req, res, next) {
    if (!req.user) return next(unauthorized());
    if (!allowedRoles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

module.exports = authorizeRoles;
