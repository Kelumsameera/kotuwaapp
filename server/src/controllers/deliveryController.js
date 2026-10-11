const deliveryService = require('../services/deliveryService');
const deliveryQueryService = require('../services/deliveryQueryService');
const imageStorage = require('../services/imageStorage');
const { listCourierNames } = require('../services/couriers');
const { getPlatformSettings } = require('../models/PlatformSettings');
const {
  serializeSubOrderForSeller,
  serializeDeliveryForRider,
  serializeSubOrderForCustomer,
  serializePublicTracking,
} = require('../utils/serializeOrder');

// Splits a status request into the new status, the note, and the extra details.
function statusRequest(req) {
  const { status, note, ...details } = req.body;
  return { toStatus: status, note, details, subOrderNumber: req.params.subOrderNumber };
}

// ── Seller ───────────────────────────────────────────────────────────

// PATCH /api/seller/orders/:subOrderNumber/status
async function sellerChangeStatus(req, res) {
  const subOrder = await deliveryService.changeStatus({ actor: req.user, shop: req.shop, ...statusRequest(req) });
  res.json({ order: serializeSubOrderForSeller(subOrder) });
}

// POST /api/seller/orders/:subOrderNumber/cash-collected
async function sellerMarkCashCollected(req, res) {
  const subOrder = await deliveryService.markCashCollected({ actor: req.user, shop: req.shop, subOrderNumber: req.params.subOrderNumber });
  res.json({ order: serializeSubOrderForSeller(subOrder) });
}

// GET /api/seller/cod-summary — this shop's cash not yet collected.
async function sellerCodSummary(req, res) {
  const summary = await deliveryQueryService.codPendingSummary(req.shop._id);
  res.json({ inTransit: summary.inTransit, deliveredNotCollected: summary.deliveredNotCollected, total: summary.total });
}

// GET /api/couriers — names for the courier dropdown (public).
async function listCouriers(req, res) {
  res.json({ couriers: listCourierNames() });
}

// ── Rider ────────────────────────────────────────────────────────────

// GET /api/rider/deliveries
async function riderList(req, res) {
  const { subOrders, total, page, limit } = await deliveryQueryService.listRiderDeliveries(req.user._id, req.query);
  res.json({ deliveries: subOrders.map(serializeDeliveryForRider), total, page, limit });
}

// GET /api/rider/deliveries/:subOrderNumber
async function riderGet(req, res) {
  const subOrder = await deliveryQueryService.getRiderDelivery(req.user._id, req.params.subOrderNumber);
  res.json({ delivery: serializeDeliveryForRider(subOrder) });
}

// PATCH /api/rider/deliveries/:subOrderNumber/status
async function riderChangeStatus(req, res) {
  await deliveryService.changeStatus({ actor: req.user, ...statusRequest(req) });
  const subOrder = await deliveryQueryService.getRiderDelivery(req.user._id, req.params.subOrderNumber);
  res.json({ delivery: serializeDeliveryForRider(subOrder) });
}

// POST /api/rider/deliveries/:subOrderNumber/photo (multipart "image") — proof photo upload.
async function riderUploadPhoto(req, res) {
  const subOrder = await deliveryQueryService.getRiderDelivery(req.user._id, req.params.subOrderNumber);
  const photo = await imageStorage.uploadProofImage(subOrder._id, req.file.buffer);
  res.status(201).json({ photo });
}

// POST /api/rider/deliveries/:subOrderNumber/cash-collected
async function riderMarkCashCollected(req, res) {
  await deliveryService.markCashCollected({ actor: req.user, subOrderNumber: req.params.subOrderNumber });
  const subOrder = await deliveryQueryService.getRiderDelivery(req.user._id, req.params.subOrderNumber);
  res.json({ delivery: serializeDeliveryForRider(subOrder) });
}

// ── Customer ─────────────────────────────────────────────────────────

// PATCH /api/orders/sub-orders/:subOrderNumber/status — cancel or request a return.
async function customerChangeStatus(req, res) {
  const subOrder = await deliveryService.changeStatus({ actor: req.user, ...statusRequest(req) });
  const settings = await getPlatformSettings();
  await subOrder.populate('shop', 'name slug logo');
  res.json({ subOrder: serializeSubOrderForCustomer(subOrder, settings.returnPeriodDays) });
}

// ── Admin ────────────────────────────────────────────────────────────

// GET /api/admin/deliveries
async function adminList(req, res) {
  const { subOrders, total, page, limit } = await deliveryQueryService.listAllDeliveries({
    ...req.query,
    delayed: req.query.delayed === 'true',
  });
  res.json({ deliveries: subOrders.map((subOrder) => serializeSubOrderForSeller(subOrder, 'super_admin')), total, page, limit });
}

// GET /api/admin/deliveries/:subOrderNumber
async function adminGet(req, res) {
  const subOrder = await deliveryQueryService.getDeliveryForAdmin(req.params.subOrderNumber);
  res.json({ delivery: serializeSubOrderForSeller(subOrder, 'super_admin') });
}

// PATCH /api/admin/deliveries/:subOrderNumber/status
async function adminChangeStatus(req, res) {
  await deliveryService.changeStatus({ actor: req.user, ...statusRequest(req) });
  const subOrder = await deliveryQueryService.getDeliveryForAdmin(req.params.subOrderNumber);
  res.json({ delivery: serializeSubOrderForSeller(subOrder, 'super_admin') });
}

// PATCH /api/admin/deliveries/:subOrderNumber/rider
async function adminAssignRider(req, res) {
  await deliveryService.assignRider(req, req.params.subOrderNumber, req.body.riderId);
  const subOrder = await deliveryQueryService.getDeliveryForAdmin(req.params.subOrderNumber);
  res.json({ delivery: serializeSubOrderForSeller(subOrder, 'super_admin') });
}

// POST /api/admin/deliveries/:subOrderNumber/cash-collected
async function adminMarkCashCollected(req, res) {
  await deliveryService.markCashCollected({ actor: req.user, subOrderNumber: req.params.subOrderNumber });
  const subOrder = await deliveryQueryService.getDeliveryForAdmin(req.params.subOrderNumber);
  res.json({ delivery: serializeSubOrderForSeller(subOrder, 'super_admin') });
}

// GET /api/admin/deliveries-report
async function adminReport(req, res) {
  const [report, cod] = await Promise.all([
    deliveryQueryService.deliveryReport(req.query),
    deliveryQueryService.codPendingSummary(null),
  ]);
  res.json({ report, cod });
}

// ── Public ───────────────────────────────────────────────────────────

// GET /api/track?orderNumber=..&phone=.. — no login needed.
async function publicTrack(req, res) {
  const order = await deliveryQueryService.findForPublicTracking(req.query.orderNumber, req.query.phone);
  res.set('Cache-Control', 'no-store');
  res.json({ tracking: serializePublicTracking(order) });
}

module.exports = {
  sellerChangeStatus,
  sellerMarkCashCollected,
  sellerCodSummary,
  listCouriers,
  riderList,
  riderGet,
  riderChangeStatus,
  riderUploadPhoto,
  riderMarkCashCollected,
  customerChangeStatus,
  adminList,
  adminGet,
  adminChangeStatus,
  adminAssignRider,
  adminMarkCashCollected,
  adminReport,
  publicTrack,
};
