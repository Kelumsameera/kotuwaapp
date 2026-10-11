const orderQueryService = require('../services/orderQueryService');
const shippingService = require('../services/shippingService');
const { serializeSubOrderForSeller } = require('../utils/serializeOrder');

// GET /api/seller/orders — only this shop's sub-orders.
async function listOrders(req, res) {
  const { subOrders, total, page, limit } = await orderQueryService.listShopSubOrders(req.shop._id, req.query);
  res.json({ orders: subOrders.map(serializeSubOrderForSeller), total, page, limit });
}

// GET /api/seller/orders/:subOrderNumber
async function getOrder(req, res) {
  const subOrder = await orderQueryService.getShopSubOrder(req.shop._id, req.params.subOrderNumber);
  res.json({ order: serializeSubOrderForSeller(subOrder) });
}

// GET /api/seller/shipping-rates
async function listShippingRates(req, res) {
  res.json({ rates: await shippingService.listRates(req.shop._id) });
}

// PUT /api/seller/shipping-rates — replaces the shop's own rates.
async function replaceShippingRates(req, res) {
  res.json({ rates: await shippingService.replaceRates(req, req.shop._id, req.body.rates) });
}

module.exports = { listOrders, getOrder, listShippingRates, replaceShippingRates };
