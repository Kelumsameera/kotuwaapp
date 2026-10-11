const mongoose = require('mongoose');
const SubOrder = require('../models/SubOrder');
const { ORDER_STATUS } = require('../constants/orderStatus');
const { earningsSummary } = require('./earningsService');
const { codPendingSummary } = require('./deliveryQueryService');
const { listLowStock } = require('./lowStockService');

const S = ORDER_STATUS;
const DAY_MS = 24 * 60 * 60 * 1000;

// Statuses where the seller has to do something next.
const NEEDS_ACTION = [S.PLACED, S.CONFIRMED, S.PACKED, S.DELIVERY_FAILED, S.RETURN_REQUESTED];

// Online sales of the last `days` days (cancelled and returned orders don't count).
async function onlineSales(shopId, days) {
  const [row] = await SubOrder.aggregate([
    {
      $match: {
        shop: new mongoose.Types.ObjectId(String(shopId)),
        createdAt: { $gte: new Date(Date.now() - days * DAY_MS) },
        status: { $nin: [S.CANCELLED, S.RETURNED] },
      },
    },
    { $group: { _id: null, amount: { $sum: '$itemsSubtotal' }, orders: { $sum: 1 } } },
  ]);
  return { amount: row?.amount || 0, orders: row?.orders || 0 };
}

// How many of the shop's orders wait in each "needs action" status.
async function ordersNeedingAction(shopId) {
  const rows = await SubOrder.aggregate([
    { $match: { shop: new mongoose.Types.ObjectId(String(shopId)), status: { $in: NEEDS_ACTION } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(NEEDS_ACTION.map((status) => [status, 0]));
  for (const row of rows) counts[row._id] = row.count;
  return counts;
}

// Everything on the seller dashboard in one call.
async function buildDashboard(shop) {
  const [today, last30Days, toDo, earnings, cod, lowStock] = await Promise.all([
    onlineSales(shop._id, 1),
    onlineSales(shop._id, 30),
    ordersNeedingAction(shop._id),
    earningsSummary(shop._id),
    codPendingSummary(shop._id),
    listLowStock(shop),
  ]);

  return {
    sales: { today, last30Days },
    toDo,
    earnings,
    cod: { total: cod.total, inTransit: cod.inTransit, deliveredNotCollected: cod.deliveredNotCollected },
    lowStock: { count: lowStock.length, items: lowStock.slice(0, 10), threshold: shop.lowStockThreshold },
  };
}

module.exports = { buildDashboard };
