const express = require('express');
const orderController = require('../controllers/orderController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { rolesWith } = require('../constants/permissions');
const { checkoutLimiter } = require('../middleware/rateLimiters');
const v = require('../validators/orderValidators');

// ── Checkout: customers only ─────────────────────────────────────────
const checkoutRouter = express.Router();
checkoutRouter.use(authenticate, authorizeRoles(...rolesWith('orders:place')));
checkoutRouter.post('/preview', validate({ body: v.checkoutPreviewBody }), asyncHandler(orderController.previewCheckout));
checkoutRouter.post(
  '/place-order',
  checkoutLimiter,
  validate({ body: v.placeOrderBody }),
  asyncHandler(orderController.placeOrder)
);

// ── My orders: customers see only their own ─────────────────────────
const ordersRouter = express.Router();
ordersRouter.use(authenticate, authorizeRoles(...rolesWith('orders:viewOwn')));
ordersRouter.get('/', validate({ query: v.listOrdersQuery }), asyncHandler(orderController.listMyOrders));
ordersRouter.get('/:orderNumber', validate({ params: v.orderNumberParams }), asyncHandler(orderController.getMyOrder));

module.exports = { checkoutRouter, ordersRouter };
