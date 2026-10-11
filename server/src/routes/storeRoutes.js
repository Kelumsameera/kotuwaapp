const express = require('express');
const catalogController = require('../controllers/catalogController');
const cartController = require('../controllers/cartController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { rolesWith } = require('../constants/permissions');
const v = require('../validators/storeValidators');

// ── Public catalog: anyone can browse, no login ─────────────────────
const catalogRouter = express.Router();
catalogRouter.get('/products', validate({ query: v.listProductsQuery }), asyncHandler(catalogController.listProducts));
catalogRouter.get('/products/:slug', validate({ params: v.slugParams }), asyncHandler(catalogController.getProduct));
catalogRouter.get('/shops/:slug', validate({ params: v.slugParams }), asyncHandler(catalogController.getShop));
catalogRouter.post('/cart-preview', validate({ body: v.guestItemsBody }), asyncHandler(catalogController.previewCart));

// ── Cart: logged-in customers (guests keep their cart in the browser) ─
const cartRouter = express.Router();
cartRouter.use(authenticate, authorizeRoles(...rolesWith('cart:use')));
cartRouter.get('/', asyncHandler(cartController.getCart));
cartRouter.post('/items', validate({ body: v.addToCartBody }), asyncHandler(cartController.addItem));
cartRouter.patch(
  '/items/:variantId',
  validate({ params: v.variantIdParams, body: v.setQuantityBody }),
  asyncHandler(cartController.setQuantity)
);
cartRouter.delete('/items/:variantId', validate({ params: v.variantIdParams }), asyncHandler(cartController.removeItem));
cartRouter.post('/merge', validate({ body: v.guestItemsBody }), asyncHandler(cartController.mergeGuestCart));

// ── Wishlist: logged-in customers ─────────────────────────────────────
const wishlistRouter = express.Router();
wishlistRouter.use(authenticate, authorizeRoles(...rolesWith('wishlist:use')));
wishlistRouter.get('/', asyncHandler(cartController.getWishlist));
wishlistRouter.put('/:productId', validate({ params: v.productIdParams }), asyncHandler(cartController.addToWishlist));
wishlistRouter.delete('/:productId', validate({ params: v.productIdParams }), asyncHandler(cartController.removeFromWishlist));

module.exports = { catalogRouter, cartRouter, wishlistRouter };
