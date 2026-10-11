const staffService = require('../services/staffService');
const payoutService = require('../services/payoutService');
const earningsService = require('../services/earningsService');
const lowStockService = require('../services/lowStockService');
const { buildDashboard } = require('../services/sellerDashboardService');
const { serializeUser } = require('../utils/serialize');

// Turns a payout into JSON. The bank account number is shortened to its last 4 digits.
function serializePayout(payout) {
  const accountNumber = payout.bankDetails?.accountNumber || '';
  return {
    id: String(payout._id),
    shop: payout.shop?.name ? { id: String(payout.shop._id), name: payout.shop.name } : String(payout.shop),
    amount: payout.amount,
    status: payout.status,
    bank: {
      bankName: payout.bankDetails?.bankName || '',
      branch: payout.bankDetails?.branch || '',
      accountName: payout.bankDetails?.accountName || '',
      accountNumber,
    },
    earningsCount: payout.earnings?.length || 0,
    note: payout.note || '',
    reference: payout.reference || '',
    createdAt: payout.createdAt,
    reviewedAt: payout.reviewedAt || null,
    paidAt: payout.paidAt || null,
  };
}

// The seller sees only the last 4 digits of the account in their history.
function serializePayoutForSeller(payout) {
  const result = serializePayout(payout);
  result.bank.accountNumber = result.bank.accountNumber ? `•••• ${result.bank.accountNumber.slice(-4)}` : '';
  return result;
}

// One earning as JSON.
function serializeEarning(earning) {
  return {
    id: String(earning._id),
    subOrderNumber: earning.subOrderNumber,
    gross: earning.gross,
    commission: earning.commission,
    net: earning.net,
    status: earning.status,
    inPayout: Boolean(earning.payout),
    releaseAt: earning.releaseAt,
    createdAt: earning.createdAt,
  };
}

// GET /api/seller/dashboard
async function dashboard(req, res) {
  res.json({ dashboard: await buildDashboard(req.shop) });
}

// GET /api/seller/low-stock
async function lowStock(req, res) {
  res.json({ items: await lowStockService.listLowStock(req.shop), threshold: req.shop.lowStockThreshold });
}

// GET /api/seller/earnings — totals plus one page of earnings.
async function earnings(req, res) {
  const [summary, list] = await Promise.all([
    earningsService.earningsSummary(req.shop._id),
    earningsService.listEarnings(req.shop._id, req.query),
  ]);
  res.json({
    summary,
    minPayout: payoutService.MIN_PAYOUT_CENTS,
    hasBankDetails: payoutService.hasBankDetails(req.shop),
    earnings: list.earnings.map(serializeEarning),
    total: list.total,
    page: list.page,
    limit: list.limit,
  });
}

// GET /api/seller/payouts
async function payouts(req, res) {
  const { payouts: list, total, page, limit } = await payoutService.listShopPayouts(req.shop._id, req.query);
  res.json({ payouts: list.map(serializePayoutForSeller), total, page, limit });
}

// POST /api/seller/payouts
async function requestPayout(req, res) {
  const payout = await payoutService.requestPayout(req, req.shop);
  res.status(201).json({ payout: serializePayoutForSeller(payout) });
}

// GET /api/seller/staff
async function listStaff(req, res) {
  const cashiers = await staffService.listCashiers(req.shop);
  res.json({ staff: cashiers.map(serializeUser), max: staffService.MAX_CASHIERS });
}

// POST /api/seller/staff
async function createStaff(req, res) {
  const cashier = await staffService.createCashier(req, req.shop, req.body);
  res.status(201).json({ user: serializeUser(cashier) });
}

// PATCH /api/seller/staff/:id/status
async function setStaffStatus(req, res) {
  const cashier = await staffService.setCashierActive(req, req.shop, req.params.id, req.body.isActive);
  res.json({ user: serializeUser(cashier) });
}

// POST /api/seller/staff/:id/password
async function resetStaffPassword(req, res) {
  await staffService.resetCashierPassword(req, req.shop, req.params.id, req.body.password);
  res.json({ message: 'Password changed. The cashier has been logged out everywhere.' });
}

// GET /api/admin/payouts
async function adminListPayouts(req, res) {
  const { payouts: list, total, page, limit } = await payoutService.listAllPayouts(req.query);
  res.json({ payouts: list.map(serializePayout), total, page, limit });
}

// PATCH /api/admin/payouts/:id
async function adminReviewPayout(req, res) {
  const payout = await payoutService.reviewPayout(req, req.params.id, req.body);
  await payout.populate('shop', 'name');
  res.json({ payout: serializePayout(payout) });
}

module.exports = {
  dashboard,
  lowStock,
  earnings,
  payouts,
  requestPayout,
  listStaff,
  createStaff,
  setStaffStatus,
  resetStaffPassword,
  adminListPayouts,
  adminReviewPayout,
};
