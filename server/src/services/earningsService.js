const mongoose = require('mongoose');
const Earning = require('../models/Earning');
const Payout = require('../models/Payout');
const SubOrder = require('../models/SubOrder');
const { ORDER_STATUS } = require('../constants/orderStatus');

const DAY_MS = 24 * 60 * 60 * 1000;

// Creates the seller's earning when a sub-order is delivered. It stays "pending"
// until the return period is over (runs inside the status-change transaction).
async function createEarningForDelivery(subOrder, returnPeriodDays, session) {
  await Earning.create(
    [
      {
        shop: subOrder.shop,
        subOrder: subOrder._id,
        subOrderNumber: subOrder.subOrderNumber,
        gross: subOrder.total,
        commission: subOrder.commissionTotal,
        net: subOrder.sellerNet,
        status: 'pending',
        releaseAt: new Date(subOrder.delivery.deliveredAt.getTime() + returnPeriodDays * DAY_MS),
      },
    ],
    { session }
  );
}

// Cancels the earning of a returned sub-order. If it was already part of an open payout
// request, the payout amount goes down by the same amount.
// (Paid-out earnings can't be returned: they are only paid after the return period.)
async function reverseEarning(subOrderId, session) {
  const earning = await Earning.findOne({ subOrder: subOrderId, status: { $in: ['pending', 'available'] } }).session(session);
  if (!earning) return;

  if (earning.payout) {
    await Payout.updateOne(
      { _id: earning.payout, isOpen: true },
      { $inc: { amount: -earning.net }, $pull: { earnings: earning._id } },
      { session }
    );
  }
  earning.status = 'reversed';
  earning.payout = undefined;
  await earning.save({ session });
}

// Moves earnings whose return period has passed from "pending" to "available".
// Earnings of orders with an open return request wait until the request is settled.
// Run regularly by the job scheduler. Returns how many were released.
async function releaseDueEarnings(now = new Date()) {
  const due = await Earning.find({ status: 'pending', releaseAt: { $lte: now } });
  let releasedCount = 0;

  for (const earning of due) {
    const subOrder = await SubOrder.findById(earning.subOrder, { status: 1 });
    if (subOrder?.status !== ORDER_STATUS.DELIVERED) continue;

    const result = await Earning.updateOne({ _id: earning._id, status: 'pending' }, { status: 'available', availableAt: now });
    releasedCount += result.modifiedCount;
  }
  return releasedCount;
}

// Totals of a shop's earnings by status (cents). 'inPayout' = available but already requested.
async function earningsSummary(shopId) {
  const rows = await Earning.aggregate([
    { $match: { shop: new mongoose.Types.ObjectId(String(shopId)) } },
    { $group: { _id: { status: '$status', inPayout: { $gt: ['$payout', null] } }, amount: { $sum: '$net' }, count: { $sum: 1 } } },
  ]);

  const summary = { pending: 0, available: 0, inPayout: 0, paid: 0, reversed: 0 };
  for (const row of rows) {
    if (row._id.status === 'available' && row._id.inPayout) summary.inPayout += row.amount;
    else summary[row._id.status] += row.amount;
  }
  return summary;
}

// One page of a shop's earnings, newest first, optionally by status.
async function listEarnings(shopId, { status, page, limit }) {
  const filter = { shop: shopId };
  if (status) filter.status = status;
  const [earnings, total] = await Promise.all([
    Earning.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Earning.countDocuments(filter),
  ]);
  return { earnings, total, page, limit };
}

module.exports = { createEarningForDelivery, reverseEarning, releaseDueEarnings, earningsSummary, listEarnings };
