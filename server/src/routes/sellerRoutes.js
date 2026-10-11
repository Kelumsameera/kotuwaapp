const express = require('express');
const shopController = require('../controllers/sellerShopController');
const productController = require('../controllers/sellerProductController');
const sellerOrderController = require('../controllers/sellerOrderController');
const deliveryController = require('../controllers/deliveryController');
const sellerCenterController = require('../controllers/sellerCenterController');
const centerRules = require('../validators/sellerCenterValidators');
const deliveryRules = require('../validators/deliveryValidators');
const orderRules = require('../validators/orderValidators');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const validate = require('../middleware/validate');
const uploadImage = require('../middleware/uploadImage');
const { loadMyShop, requireShopStatus } = require('../middleware/loadMyShop');
const { uploadLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('../utils/asyncHandler');
const { rolesWith } = require('../constants/permissions');
const shopRules = require('../validators/shopValidators');
const productRules = require('../validators/productValidators');

const router = express.Router();

// Shorthands so each route below reads clearly.
const canManageShop = authorizeRoles(...rolesWith('shop:manage'));
const canManageProducts = authorizeRoles(...rolesWith('products:manage'));
// Anything except a suspended shop may prepare products; selling needs "approved".
const notSuspended = requireShopStatus('pending', 'approved', 'rejected');
const approvedOnly = requireShopStatus('approved');

router.use(authenticate);

// ── Shop ─────────────────────────────────────────────────────────────
router.post('/shop', canManageShop, validate({ body: shopRules.createShopBody }), asyncHandler(shopController.createShop));
router.get('/shop', canManageShop, loadMyShop, asyncHandler(shopController.getMyShop));
router.patch(
  '/shop',
  canManageShop,
  loadMyShop,
  validate({ body: shopRules.updateShopBody }),
  asyncHandler(shopController.updateMyShop)
);

// ── Image uploads (logo, banner, product photos) ──────────────────────
router.post(
  '/uploads/images',
  canManageProducts,
  uploadLimiter,
  loadMyShop,
  notSuspended,
  uploadImage,
  asyncHandler(shopController.uploadImage)
);

// ── Products ─────────────────────────────────────────────────────────
const productId = { params: productRules.productIdParams };

router.get(
  '/products',
  canManageProducts,
  loadMyShop,
  validate({ query: productRules.listProductsQuery }),
  asyncHandler(productController.listProducts)
);
router.post(
  '/products',
  canManageProducts,
  loadMyShop,
  notSuspended,
  validate({ body: productRules.createProductBody }),
  asyncHandler(productController.createProduct)
);
router.get('/products/:id', canManageProducts, loadMyShop, validate(productId), asyncHandler(productController.getProduct));
router.patch(
  '/products/:id',
  canManageProducts,
  loadMyShop,
  notSuspended,
  validate({ ...productId, body: productRules.updateProductBody }),
  asyncHandler(productController.updateProduct)
);
router.delete('/products/:id', canManageProducts, loadMyShop, validate(productId), asyncHandler(productController.archiveProduct));
router.post(
  '/products/:id/submit',
  canManageProducts,
  loadMyShop,
  approvedOnly,
  validate(productId),
  asyncHandler(productController.submitProduct)
);
router.patch(
  '/products/:id/visibility',
  canManageProducts,
  loadMyShop,
  notSuspended,
  validate({ ...productId, body: productRules.visibilityBody }),
  asyncHandler(productController.setVisibility)
);
router.post(
  '/products/:id/variants/:variantId/stock',
  canManageProducts,
  loadMyShop,
  notSuspended,
  validate({ params: productRules.variantParams, body: productRules.adjustStockBody }),
  asyncHandler(productController.adjustStock)
);
router.get(
  '/products/:id/stock-history',
  canManageProducts,
  loadMyShop,
  validate(productId),
  asyncHandler(productController.stockHistory)
);

// ── Orders: only this shop's sub-orders ────────────────────────────
const canManageOrders = authorizeRoles(...rolesWith('orders:manageOwn'));
router.get(
  '/orders',
  canManageOrders,
  loadMyShop,
  validate({ query: orderRules.sellerOrdersQuery }),
  asyncHandler(sellerOrderController.listOrders)
);
router.get(
  '/orders/:subOrderNumber',
  canManageOrders,
  loadMyShop,
  validate({ params: orderRules.subOrderNumberParams }),
  asyncHandler(sellerOrderController.getOrder)
);

router.patch(
  '/orders/:subOrderNumber/status',
  canManageOrders,
  loadMyShop,
  validate({ params: deliveryRules.subOrderParams, body: deliveryRules.staffStatusBody }),
  asyncHandler(deliveryController.sellerChangeStatus)
);
router.post(
  '/orders/:subOrderNumber/cash-collected',
  canManageOrders,
  loadMyShop,
  validate({ params: deliveryRules.subOrderParams }),
  asyncHandler(deliveryController.sellerMarkCashCollected)
);
router.get('/cod-summary', canManageOrders, loadMyShop, asyncHandler(deliveryController.sellerCodSummary));

// ── Own delivery rates (override the platform defaults) ─────────────
const canManageShipping = authorizeRoles(...rolesWith('shipping:manage'));
router.get('/shipping-rates', canManageShipping, loadMyShop, asyncHandler(sellerOrderController.listShippingRates));
router.put(
  '/shipping-rates',
  canManageShipping,
  loadMyShop,
  notSuspended,
  validate({ body: orderRules.shippingRatesBody }),
  asyncHandler(sellerOrderController.replaceShippingRates)
);

// ── Dashboard and low stock ──────────────────────────────────────────
const canSeeEarnings = authorizeRoles(...rolesWith('earnings:view'));
router.get('/dashboard', canSeeEarnings, loadMyShop, asyncHandler(sellerCenterController.dashboard));
router.get('/low-stock', canManageProducts, loadMyShop, asyncHandler(sellerCenterController.lowStock));

// ── Earnings and payouts (never cashiers) ────────────────────────────
const canRequestPayouts = authorizeRoles(...rolesWith('payouts:request'));
router.get('/earnings', canSeeEarnings, loadMyShop, validate({ query: centerRules.earningsQuery }), asyncHandler(sellerCenterController.earnings));
router.get('/payouts', canSeeEarnings, loadMyShop, validate({ query: centerRules.payoutsQuery }), asyncHandler(sellerCenterController.payouts));
router.post('/payouts', canRequestPayouts, loadMyShop, approvedOnly, asyncHandler(sellerCenterController.requestPayout));

// ── Staff (cashier accounts) ─────────────────────────────────────────
const canManageStaff = authorizeRoles(...rolesWith('staff:manage'));
const staffId = { params: centerRules.staffIdParams };
router.get('/staff', canManageStaff, loadMyShop, asyncHandler(sellerCenterController.listStaff));
router.post('/staff', canManageStaff, loadMyShop, notSuspended, validate({ body: centerRules.createCashierBody }), asyncHandler(sellerCenterController.createStaff));
router.patch(
  '/staff/:id/status',
  canManageStaff,
  loadMyShop,
  validate({ ...staffId, body: centerRules.staffStatusBody }),
  asyncHandler(sellerCenterController.setStaffStatus)
);
router.post(
  '/staff/:id/password',
  canManageStaff,
  loadMyShop,
  validate({ ...staffId, body: centerRules.staffPasswordBody }),
  asyncHandler(sellerCenterController.resetStaffPassword)
);

module.exports = router;
