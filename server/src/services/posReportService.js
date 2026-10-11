const mongoose = require('mongoose');
const PosSale = require('../models/PosSale');
const User = require('../models/User');
const { finishedBetween } = require('./posService');
const { colomboDayRange } = require('../utils/colomboTime');

// Totals of a set of sales: completed ones count as sales; voided ones are counted separately.
const TOTALS_GROUP = {
  completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
  total: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$total', 0] } },
  discounts: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, { $add: ['$itemDiscountTotal', '$billDiscount'] }, 0] } },
  cash: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $eq: ['$payment.method', 'cash'] }] }, '$total', 0] } },
  card: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $eq: ['$payment.method', 'card'] }] }, '$total', 0] } },
  voidedCount: { $sum: { $cond: [{ $eq: ['$status', 'voided'] }, 1, 0] } },
  voidedTotal: { $sum: { $cond: [{ $eq: ['$status', 'voided'] }, '$total', 0] } },
};

const EMPTY_TOTALS = { completedCount: 0, total: 0, discounts: 0, cash: 0, card: 0, voidedCount: 0, voidedTotal: 0 };

// Copies just the totals from a database row (or gives zeros when there were no sales).
function cleanTotals(row) {
  const totals = {};
  for (const key of Object.keys(EMPTY_TOTALS)) totals[key] = row ? row[key] : 0;
  return totals;
}

// Totals per cashier between two instants, with cashier names.
async function totalsByCashier(shopId, start, end) {
  const rows = await PosSale.aggregate([
    { $match: finishedBetween(shopId, start, end) },
    { $group: { _id: '$cashier', ...TOTALS_GROUP } },
    { $sort: { total: -1 } },
  ]);
  const users = await User.find({ _id: { $in: rows.map((row) => row._id) } }, { name: 1, role: 1 }).lean();
  return rows.map((row) => {
    const user = users.find((candidate) => String(candidate._id) === String(row._id));
    return { cashierId: String(row._id), name: user?.name || '?', role: user?.role || '', ...cleanTotals(row) };
  });
}

// Owner: one day's report — totals, cash vs card, best sellers, sales per hour and per cashier.
async function dailyReport(shop, dateText) {
  const { start, end } = colomboDayRange(dateText);
  const match = finishedBetween(shop._id, start, end);

  const [totalsRows, topItems, byHour, cashiers] = await Promise.all([
    PosSale.aggregate([{ $match: match }, { $group: { _id: null, ...TOTALS_GROUP } }]),
    PosSale.aggregate([
      { $match: { ...match, status: 'completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.variantId',
          name: { $first: '$items.name' },
          sku: { $first: '$items.sku' },
          quantity: { $sum: '$items.quantity' },
          amount: { $sum: '$items.lineTotal' },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 10 },
    ]),
    PosSale.aggregate([
      { $match: { ...match, status: 'completed' } },
      // Hour of the day in Sri Lanka time.
      { $group: { _id: { $hour: { date: '$completedAt', timezone: '+05:30' } }, total: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    totalsByCashier(shop._id, start, end),
  ]);

  return {
    date: dateText,
    totals: cleanTotals(totalsRows[0]),
    topItems: topItems.map((item) => ({ variantId: String(item._id), name: item.name, sku: item.sku, quantity: item.quantity, amount: item.amount })),
    byHour: byHour.map((row) => ({ hour: row._id, total: row.total, count: row.count })),
    cashiers,
  };
}

// Owner: per-cashier totals between two dates (inclusive), for paying staff or checking tills.
async function cashierReport(shop, fromDate, toDate) {
  const { start } = colomboDayRange(fromDate);
  const { end } = colomboDayRange(toDate);
  return { from: fromDate, to: toDate, cashiers: await totalsByCashier(shop._id, start, end) };
}

// Cashier (or owner): their OWN totals for one day, to count the cash drawer at the end of a shift.
async function myDay(user, shop, dateText) {
  const { start, end } = colomboDayRange(dateText);
  const [row] = await PosSale.aggregate([
    { $match: finishedBetween(shop._id, start, end, { cashier: new mongoose.Types.ObjectId(String(user._id)) }) },
    { $group: { _id: null, ...TOTALS_GROUP } },
  ]);
  return { date: dateText, totals: cleanTotals(row) };
}

// Owner: one page of completed/voided sales of a day (optionally one cashier), newest first.
async function listSales(shop, { date, cashier, page, limit }) {
  const { start, end } = colomboDayRange(date);
  const filter = finishedBetween(shop._id, start, end, cashier ? { cashier: new mongoose.Types.ObjectId(cashier) } : {});
  const [sales, total] = await Promise.all([
    PosSale.find(filter).populate('cashier', 'name').sort({ completedAt: -1 }).skip((page - 1) * limit).limit(limit),
    PosSale.countDocuments(filter),
  ]);
  return { sales, total, page, limit };
}

module.exports = { dailyReport, cashierReport, myDay, listSales };
