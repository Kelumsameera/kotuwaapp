const express = require('express');
const adminUserController = require('../controllers/adminUserController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { rolesWith } = require('../constants/permissions');
const catalogController = require('../controllers/adminCatalogController');
const categoryController = require('../controllers/categoryController');
const adminOrderController = require('../controllers/adminOrderController');
const orderRules = require('../validators/orderValidators');
const v = require('../validators/adminValidators');
const shopRules = require('../validators/shopValidators');
const productRules = require('../validators/productValidators');
const categoryRules = require('../validators/categoryValidators');

const router = express.Router();

// Every admin route needs a logged-in user first.
router.use(authenticate);

router.get(
  '/users',
  authorizeRoles(...rolesWith('users:view')),
  validate({ query: v.listUsersQuery }),
  asyncHandler(adminUserController.listUsers)
);

router.patch(
  '/users/:id/role',
  authorizeRoles(...rolesWith('users:manage')),
  validate({ params: v.userIdParams, body: v.changeRoleBody }),
  asyncHandler(adminUserController.changeRole)
);

router.patch(
  '/users/:id/status',
  authorizeRoles(...rolesWith('users:manage')),
  validate({ params: v.userIdParams, body: v.changeStatusBody }),
  asyncHandler(adminUserController.changeStatus)
);

router.post(
  '/riders',
  authorizeRoles(...rolesWith('users:manage')),
  validate({ body: v.createRiderBody }),
  asyncHandler(adminUserController.createRider)
);

// ── Shops ────────────────────────────────────────────────────────────
router.get(
  '/shops',
  authorizeRoles(...rolesWith('sellers:approve')),
  validate({ query: shopRules.listShopsQuery }),
  asyncHandler(catalogController.listShops)
);
router.patch(
  '/shops/:id/status',
  authorizeRoles(...rolesWith('sellers:approve')),
  validate({ params: shopRules.shopIdParams, body: shopRules.changeShopStatusBody }),
  asyncHandler(catalogController.changeShopStatus)
);

// ── Products ─────────────────────────────────────────────────────────
router.get(
  '/products',
  authorizeRoles(...rolesWith('products:approve')),
  validate({ query: productRules.listProductsQuery }),
  asyncHandler(catalogController.listProducts)
);
router.patch(
  '/products/:id/review',
  authorizeRoles(...rolesWith('products:approve')),
  validate({ params: productRules.productIdParams, body: productRules.reviewProductBody }),
  asyncHandler(catalogController.reviewProduct)
);

// ── Categories ───────────────────────────────────────────────────────
const canManageCategories = authorizeRoles(...rolesWith('categories:manage'));
router.get('/categories', canManageCategories, asyncHandler(categoryController.listAll));
router.post(
  '/categories',
  canManageCategories,
  validate({ body: categoryRules.createCategoryBody }),
  asyncHandler(categoryController.create)
);
router.patch(
  '/categories/:id',
  canManageCategories,
  validate({ params: categoryRules.categoryIdParams, body: categoryRules.updateCategoryBody }),
  asyncHandler(categoryController.update)
);
router.delete(
  '/categories/:id',
  canManageCategories,
  validate({ params: categoryRules.categoryIdParams }),
  asyncHandler(categoryController.remove)
);

// ── Orders, settings and default delivery rates ──────────────────────
router.get(
  '/orders',
  authorizeRoles(...rolesWith('orders:viewAll')),
  validate({ query: orderRules.adminOrdersQuery }),
  asyncHandler(adminOrderController.listOrders)
);
const canManageSettings = authorizeRoles(...rolesWith('settings:manage'));
router.get('/settings', canManageSettings, asyncHandler(adminOrderController.getSettings));
router.patch('/settings', canManageSettings, validate({ body: orderRules.settingsBody }), asyncHandler(adminOrderController.updateSettings));
router.get('/shipping-rates', canManageSettings, asyncHandler(adminOrderController.listShippingRates));
router.put(
  '/shipping-rates',
  canManageSettings,
  validate({ body: orderRules.shippingRatesBody }),
  asyncHandler(adminOrderController.replaceShippingRates)
);

module.exports = router;
