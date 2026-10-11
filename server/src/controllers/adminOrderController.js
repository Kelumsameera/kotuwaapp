const orderQueryService = require('../services/orderQueryService');
const settingsService = require('../services/settingsService');
const shippingService = require('../services/shippingService');
const { serializeOrderForAdmin } = require('../utils/serializeOrder');

// GET /api/admin/orders
async function listOrders(req, res) {
  const { orders, total, page, limit } = await orderQueryService.listAllOrders(req.query);
  res.json({ orders: orders.map(serializeOrderForAdmin), total, page, limit });
}

// GET /api/admin/settings
async function getSettings(req, res) {
  const settings = await settingsService.getPlatformSettings();
  res.json({ settings: settingsService.serializeSettings(settings) });
}

// PATCH /api/admin/settings
async function updateSettings(req, res) {
  const settings = await settingsService.updatePlatformSettings(req, req.body);
  res.json({ settings: settingsService.serializeSettings(settings) });
}

// GET /api/admin/shipping-rates — the platform default rates.
async function listShippingRates(req, res) {
  res.json({ rates: await shippingService.listRates(null), fallback: shippingService.FALLBACK_RATE });
}

// PUT /api/admin/shipping-rates — replaces the platform default rates.
async function replaceShippingRates(req, res) {
  res.json({ rates: await shippingService.replaceRates(req, null, req.body.rates) });
}

module.exports = { listOrders, getSettings, updateSettings, listShippingRates, replaceShippingRates };
