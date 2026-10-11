const { ROLES } = require('./roles');

// The single source of truth for "which role may do what".
// Routes never list roles by hand; they ask rolesWith('some:action').
const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    'profile:manage',
    'users:view',
    'users:manage',
    'sellers:approve',
    'products:approve',
    'categories:manage',
    'orders:viewAll',
    'deliveries:manage',
    'payouts:approve',
    'disputes:manage',
    'settings:manage',
    'stats:view',
    'audit:view',
  ],
  [ROLES.SELLER]: [
    'profile:manage',
    'shop:manage',
    'products:manage',
    'products:lookup',
    'products:viewCost',
    'orders:manageOwn',
    'pos:use',
    'pos:reports',
    'earnings:view',
    'payouts:request',
    'staff:manage',
    'shipping:manage',
  ],
  [ROLES.SELLER_CASHIER]: [
    'profile:manage',
    'products:lookup',
    'pos:use',
  ],
  [ROLES.RIDER]: [
    'profile:manage',
    'deliveries:viewAssigned',
    'deliveries:update',
  ],
  [ROLES.CUSTOMER]: [
    'profile:manage',
    'cart:use',
    'wishlist:use',
    'orders:place',
    'orders:viewOwn',
    'reviews:create',
    'disputes:open',
  ],
};

// Returns true when the given role is allowed to do the action.
function roleCan(role, action) {
  const actions = PERMISSIONS[role] || [];
  return actions.includes(action);
}

// Returns every role that is allowed to do the action, e.g. rolesWith('pos:use').
function rolesWith(action) {
  const roles = Object.keys(PERMISSIONS).filter((role) => roleCan(role, action));

  if (roles.length === 0) {
    // Catches typos in action names while developing.
    throw new Error(`No role has the permission "${action}"`);
  }

  return roles;
}

module.exports = { PERMISSIONS, roleCan, rolesWith };
