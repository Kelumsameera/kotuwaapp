const cartService = require('../services/cartService');
const wishlistService = require('../services/wishlistService');
const { serializePublicProduct } = require('../utils/serialize');

// GET /api/cart
async function getCart(req, res) {
  res.json({ cart: await cartService.getCartView(req.user._id) });
}

// POST /api/cart/items
async function addItem(req, res) {
  res.json({ cart: await cartService.addItem(req.user._id, req.body) });
}

// PATCH /api/cart/items/:variantId
async function setQuantity(req, res) {
  res.json({ cart: await cartService.setQuantity(req.user._id, req.params.variantId, req.body.quantity) });
}

// DELETE /api/cart/items/:variantId
async function removeItem(req, res) {
  res.json({ cart: await cartService.removeItem(req.user._id, req.params.variantId) });
}

// POST /api/cart/merge — after login, moves the guest's browser cart into the account.
async function mergeGuestCart(req, res) {
  res.json({ cart: await cartService.mergeGuestItems(req.user._id, req.body.items) });
}

// GET /api/wishlist
async function getWishlist(req, res) {
  const products = await wishlistService.listWishlist(req.user);
  res.json({ products: products.map((product) => serializePublicProduct(product, { withDescription: false })) });
}

// PUT /api/wishlist/:productId
async function addToWishlist(req, res) {
  await wishlistService.addToWishlist(req.user, req.params.productId);
  res.status(204).end();
}

// DELETE /api/wishlist/:productId
async function removeFromWishlist(req, res) {
  await wishlistService.removeFromWishlist(req.user, req.params.productId);
  res.status(204).end();
}

module.exports = { getCart, addItem, setQuantity, removeItem, mergeGuestCart, getWishlist, addToWishlist, removeFromWishlist };
