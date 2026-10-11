// All user roles in one place.
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SELLER: 'seller',
  SELLER_CASHIER: 'seller_cashier',
  RIDER: 'rider',
  CUSTOMER: 'customer',
};

const ALL_ROLES = Object.values(ROLES);

// The only roles a person may pick when signing up. super_admin is created by the seed script.
const SELF_REGISTER_ROLES = [ROLES.CUSTOMER, ROLES.SELLER];

// Roles an admin may give to another user. super_admin can never be given through the API.
const ADMIN_ASSIGNABLE_ROLES = [ROLES.CUSTOMER, ROLES.SELLER, ROLES.RIDER];

const LANGUAGES = ['en', 'si', 'ta'];

module.exports = { ROLES, ALL_ROLES, SELF_REGISTER_ROLES, ADMIN_ASSIGNABLE_ROLES, LANGUAGES };
