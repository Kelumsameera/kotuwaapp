const checkoutService = require('../services/checkoutService');
const orderQueryService = require('../services/orderQueryService');
const { serializeCheckout, serializeOrderForCustomer } = require('../utils/serializeOrder');
const { getPlatformSettings } = require('../models/PlatformSettings');

// POST /api/checkout/preview — totals and delivery fees for the chosen address. Saves nothing.
async function previewCheckout(req, res) {
  const checkout = await checkoutService.buildCheckout(req.user, req.body.addressId);
  res.json({ checkout: serializeCheckout(checkout) });
}

// POST /api/checkout/place-order
async function placeOrder(req, res) {
  const { order, isNew } = await checkoutService.placeOrder(req.user, req.body);
  res.status(isNew ? 201 : 200).json({ orderNumber: order.orderNumber });
}

// GET /api/orders
async function listMyOrders(req, res) {
  const { orders, total, page, limit } = await orderQueryService.listCustomerOrders(req.user._id, req.query);
  const { returnPeriodDays } = await getPlatformSettings();
  res.json({ orders: orders.map((order) => serializeOrderForCustomer(order, returnPeriodDays)), total, page, limit });
}

// GET /api/orders/:orderNumber
async function getMyOrder(req, res) {
  const order = await orderQueryService.getCustomerOrder(req.user._id, req.params.orderNumber);
  const { returnPeriodDays } = await getPlatformSettings();
  res.json({ order: serializeOrderForCustomer(order, returnPeriodDays) });
}

module.exports = { previewCheckout, placeOrder, listMyOrders, getMyOrder };
