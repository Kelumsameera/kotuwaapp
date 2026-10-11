const Shop = require('../models/Shop');
const { ROLES } = require('../constants/roles');
const { notFound, forbidden } = require('../utils/AppError');

// Finds the shop of the logged-in seller (or the shop a cashier works for) and puts it on req.shop.
// The shop always comes from the user's own account, never from the request,
// so nobody can act on another seller's shop by changing an id.
async function loadMyShop(req, res, next) {
  try {
    let shop = null;
    if (req.user.role === ROLES.SELLER) {
      shop = await Shop.findOne({ owner: req.user._id });
    } else if (req.user.role === ROLES.SELLER_CASHIER && req.user.shop) {
      shop = await Shop.findById(req.user.shop);
    }

    if (!shop) throw notFound('SHOP_NOT_FOUND', 'You have not opened a shop yet.');

    req.shop = shop;
    next();
  } catch (error) {
    next(error);
  }
}

// Lets the request continue only when the shop is in one of the given statuses.
// e.g. requireShopStatus('approved') for anything that sells.
function requireShopStatus(...allowedStatuses) {
  return function checkShopStatus(req, res, next) {
    if (!allowedStatuses.includes(req.shop.status)) {
      const code = req.shop.status === 'suspended' ? 'SHOP_SUSPENDED' : 'SHOP_NOT_APPROVED';
      return next(forbidden(code, `This needs an approved shop. Your shop is ${req.shop.status}.`));
    }
    next();
  };
}

module.exports = { loadMyShop, requireShopStatus };
