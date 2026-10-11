const mongoose = require('mongoose');
const SubOrder = require('../models/SubOrder');
const Order = require('../models/Order');
const User = require('../models/User');
const { ORDER_STATUS, OPEN_STATUSES } = require('../constants/orderStatus');
const { ROLES } = require('../constants/roles');
const { notFound } = require('../utils/AppError');

const S = ORDER_STATUS;
const HOUR_MS = 60 * 60 * 1000;

// When an order counts as "delayed" in the admin's delivery board.
const NOT_SHIPPED_DELAY_HOURS = 48; // placed/confirmed/packed for more than 2 days
const IN_TRANSIT_DELAY_HOURS = 72; // shipped/out for delivery/failed with no update for 3 days

const RIDER_ACTIVE = [S.CONFIRMED, S.PACKED, S.SHIPPED, S.OUT_FOR_DELIVERY, S.DELIVERY_FAILED];
const RIDER_DONE = [S.DELIVERED, S.RETURNED, S.CANCELLED, S.RETURN_REQUESTED];

// Rider: their assigned deliveries. scope "active" = still to deliver, "done" = finished.
async function listRiderDeliveries(riderId, { scope, page, limit }) {
  const filter = { 'delivery.rider': riderId, status: { $in: scope === 'done' ? RIDER_DONE : RIDER_ACTIVE } };
  const [subOrders, total] = await Promise.all([
    SubOrder.find(filter)
      .populate('shop', 'name phone address')
      .sort({ updatedAt: scope === 'done' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    SubOrder.countDocuments(filter),
  ]);
  return { subOrders, total, page, limit };
}

// Rider: one assigned delivery (404 if it is not theirs).
async function getRiderDelivery(riderId, subOrderNumber) {
  const subOrder = await SubOrder.findOne({ subOrderNumber, 'delivery.rider': riderId }).populate('shop', 'name phone address');
  if (!subOrder) throw notFound('ORDER_NOT_FOUND', 'Order not found.');
  return subOrder;
}

// The database filter for "delayed" sub-orders.
function delayedFilter(now = Date.now()) {
  return {
    $or: [
      { status: { $in: [S.PLACED, S.CONFIRMED, S.PACKED] }, createdAt: { $lt: new Date(now - NOT_SHIPPED_DELAY_HOURS * HOUR_MS) } },
      { status: { $in: [S.SHIPPED, S.OUT_FOR_DELIVERY, S.DELIVERY_FAILED] }, updatedAt: { $lt: new Date(now - IN_TRANSIT_DELAY_HOURS * HOUR_MS) } },
    ],
  };
}

// Admin: all deliveries, filtered by status, rider, or "delayed only".
async function listAllDeliveries({ status, rider, delayed, page, limit }) {
  const filter = delayed ? delayedFilter() : {};
  if (status) filter.status = status;
  if (rider) filter['delivery.rider'] = rider;

  const [subOrders, total] = await Promise.all([
    SubOrder.find(filter)
      .populate('shop', 'name slug')
      .populate('delivery.rider', 'name phone')
      .sort({ updatedAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    SubOrder.countDocuments(filter),
  ]);
  return { subOrders, total, page, limit };
}

// Admin: one sub-order with shop and rider details.
async function getDeliveryForAdmin(subOrderNumber) {
  const subOrder = await SubOrder.findOne({ subOrderNumber }).populate('shop', 'name slug phone address').populate('delivery.rider', 'name phone');
  if (!subOrder) throw notFound('ORDER_NOT_FOUND', 'Order not found.');
  return subOrder;
}

// Cash on Delivery money not yet collected, for one shop (shopId) or every shop.
// "inTransit" = parcels still on the way; "deliveredNotCollected" = delivered but cash not yet received.
async function codPendingSummary(shopId) {
  const match = { 'delivery.codAmount': { $gt: 0 }, 'delivery.codCollected': false, status: { $in: [...OPEN_STATUSES, S.DELIVERED] } };
  if (shopId) match.shop = new mongoose.Types.ObjectId(String(shopId));

  const rows = await SubOrder.aggregate([
    { $match: match },
    {
      $group: {
        _id: { shop: '$shop', delivered: { $eq: ['$status', S.DELIVERED] } },
        amount: { $sum: '$delivery.codAmount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const summary = { inTransit: { amount: 0, count: 0 }, deliveredNotCollected: { amount: 0, count: 0 }, total: 0, byShop: {} };
  for (const row of rows) {
    const bucket = row._id.delivered ? summary.deliveredNotCollected : summary.inTransit;
    bucket.amount += row.amount;
    bucket.count += row.count;
    summary.total += row.amount;
    const shopKey = String(row._id.shop);
    summary.byShop[shopKey] = (summary.byShop[shopKey] || 0) + row.amount;
  }
  return summary;
}

// Admin: delivery performance over the last `days` days (by order date).
async function deliveryReport({ days }) {
  const since = new Date(Date.now() - days * 24 * HOUR_MS);
  const subOrders = await SubOrder.find(
    { createdAt: { $gte: since } },
    { status: 1, createdAt: 1, 'delivery.deliveredAt': 1, 'delivery.attempts': 1, 'delivery.rider': 1, 'delivery.proof.at': 1 }
  ).lean();

  const byStatus = {};
  let deliveredCount = 0;
  let totalHoursToDeliver = 0;
  let firstAttemptSuccess = 0;
  let deliveredWithProof = 0;
  const riders = {};

  for (const subOrder of subOrders) {
    byStatus[subOrder.status] = (byStatus[subOrder.status] || 0) + 1;
    const riderId = subOrder.delivery?.rider ? String(subOrder.delivery.rider) : null;
    if (riderId) {
      riders[riderId] = riders[riderId] || { assigned: 0, delivered: 0, failedAttempts: 0 };
      riders[riderId].assigned += 1;
      riders[riderId].failedAttempts += subOrder.delivery.attempts || 0;
    }

    if (subOrder.delivery?.deliveredAt) {
      deliveredCount += 1;
      totalHoursToDeliver += (new Date(subOrder.delivery.deliveredAt) - new Date(subOrder.createdAt)) / HOUR_MS;
      if (!subOrder.delivery.attempts) firstAttemptSuccess += 1;
      if (subOrder.delivery.proof?.at) deliveredWithProof += 1;
      if (riderId) riders[riderId].delivered += 1;
    }
  }

  const riderUsers = await User.find({ _id: { $in: Object.keys(riders) }, role: ROLES.RIDER }, { name: 1 }).lean();
  const percent = (part) => (deliveredCount ? Math.round((part / deliveredCount) * 100) : 0);

  return {
    days,
    totalOrders: subOrders.length,
    byStatus,
    deliveredCount,
    averageHoursToDeliver: deliveredCount ? Math.round(totalHoursToDeliver / deliveredCount) : 0,
    firstAttemptSuccessPercent: percent(firstAttemptSuccess),
    proofPercent: percent(deliveredWithProof),
    delayedNow: await SubOrder.countDocuments(delayedFilter()),
    riders: riderUsers.map((rider) => ({ id: String(rider._id), name: rider.name, ...riders[String(rider._id)] })),
  };
}

// Keeps only the last 9 digits of a phone number, so 0771234567 and +94 77 123 4567 match.
function phoneKey(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-9);
}

// Public tracking: an order number plus the delivery phone number shows the timeline.
// Both must match; otherwise the same "not found" is given, whichever part was wrong.
async function findForPublicTracking(orderNumber, phone) {
  const order = await Order.findOne({ orderNumber }).populate({ path: 'subOrders', populate: { path: 'shop', select: 'name slug' } });
  const phoneMatches = order && phoneKey(phone).length === 9 && phoneKey(order.shippingAddress.phone) === phoneKey(phone);
  if (!phoneMatches) throw notFound('TRACKING_NOT_FOUND', 'No order matches that order number and phone number.');
  return order;
}

module.exports = {
  listRiderDeliveries,
  getRiderDelivery,
  listAllDeliveries,
  getDeliveryForAdmin,
  codPendingSummary,
  deliveryReport,
  findForPublicTracking,
  delayedFilter,
};
