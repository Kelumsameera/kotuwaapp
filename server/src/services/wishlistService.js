const User = require('../models/User');
const { findListedProductsByIds } = require('./catalogService');
const { badRequest, notFound } = require('../utils/AppError');

const MAX_WISHLIST = 200;

// The customer's saved products that are still listed in the store.
async function listWishlist(user) {
  return findListedProductsByIds(user.wishlist);
}

// Saves a listed product to the wishlist (adding twice does nothing).
async function addToWishlist(user, productId) {
  const [product] = await findListedProductsByIds([productId]);
  if (!product) throw notFound('PRODUCT_NOT_AVAILABLE', 'This product is no longer available.');
  if (user.wishlist.length >= MAX_WISHLIST) throw badRequest('WISHLIST_FULL', 'Your wishlist is full.');

  await User.updateOne({ _id: user._id }, { $addToSet: { wishlist: product._id } });
}

// Removes a product from the wishlist.
async function removeFromWishlist(user, productId) {
  await User.updateOne({ _id: user._id }, { $pull: { wishlist: productId } });
}

module.exports = { listWishlist, addToWishlist, removeFromWishlist };
