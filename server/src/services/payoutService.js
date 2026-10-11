const Payout = require('../models/Payout');
const Earning = require('../models/Earning');
const Shop = require('../models/Shop');
const User = require('../models/User');
const { logAudit } = require('./auditService');
const { notify } = require('./notifications/notify');
const { runInTransaction } = require('../utils/transaction');
const { badRequest, conflict, notFound } = require('../utils/AppError');

// The smallest payout a seller can ask for: Rs 1,000.
const MIN_PAYOUT_CENTS = 100000;

// True when every bank field is filled in.
function hasBankDetails(shop) {
  const bank = shop.bankDetails || {};
  return Boolean(bank.bankName && bank.accountName && bank.accountNumber);
}

// Seller: asks to be paid ALL their available earnings that are not already in a payout.
// One transaction: the payout is created and the earnings are linked to it, or nothing happens.
async function requestPayout(req, shop) {
  if (!hasBankDetails(shop)) throw badRequest('BANK_DETAILS_REQUIRED', 'Add your bank details first.');

  let payout;
  try {
    payout = await runInTransaction(async (session) => {
      if (await Payout.exists({ shop: shop._id, isOpen: true }).session(session)) {
        throw conflict('PAYOUT_OPEN', 'You already have a payout request in progress.');
      }

      const earnings = await Earning.find({ shop: shop._id, status: 'available', payout: null }).session(session);
      const amount = earnings.reduce((sum, earning) => sum + earning.net, 0);
      if (amount < MIN_PAYOUT_CENTS) {
        throw badRequest('PAYOUT_TOO_SMALL', 'You need at least Rs 1,000 available to request a payout.');
      }

      const [created] = await Payout.create(
        [
          {
            shop: shop._id,
            amount,
            bankDetails: shop.bankDetails,
            earnings: earnings.map((earning) => earning._id),
            requestedBy: req.user._id,
          },
        ],
        { session }
      );
      await Earning.updateMany({ _id: { $in: created.earnings } }, { payout: created._id }, { session });
      return created;
    });
  } catch (error) {
    // Two requests at the same moment: the unique "one open payout" index stops the second.
    if (error.code === 11000) throw conflict('PAYOUT_OPEN', 'You already have a payout request in progress.');
    throw error;
  }

  await logAudit(req, { action: 'payout.request', targetModel: 'Payout', targetId: payout._id, after: { amount: payout.amount } });
  return payout;
}

// Seller: their own payout history.
async function listShopPayouts(shopId, { page, limit }) {
  const filter = { shop: shopId };
  const [payouts, total] = await Promise.all([
    Payout.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Payout.countDocuments(filter),
  ]);
  return { payouts, total, page, limit };
}

// Admin: all payouts, optionally by status, oldest open ones first.
async function listAllPayouts({ status, page, limit }) {
  const filter = status ? { status } : {};
  const [payouts, total] = await Promise.all([
    Payout.find(filter).populate('shop', 'name slug').sort({ isOpen: -1, createdAt: 1 }).skip((page - 1) * limit).limit(limit),
    Payout.countDocuments(filter),
  ]);
  return { payouts, total, page, limit };
}

// What each admin action needs: the statuses it may start from, and the status it leads to.
const REVIEW_ACTIONS = {
  approve: { from: ['requested'], to: 'approved' },
  reject: { from: ['requested', 'approved'], to: 'rejected' },
  mark_paid: { from: ['approved'], to: 'paid' },
};

// Admin: approves, rejects or marks a payout as paid (with the bank transfer reference).
// Rejecting frees the earnings so the seller can request again; paying marks them paid.
async function reviewPayout(req, payoutId, { action, note, reference }) {
  const rule = REVIEW_ACTIONS[action];
  if (action === 'reject' && !note) throw badRequest('REASON_REQUIRED', 'Please give a reason.');
  if (action === 'mark_paid' && !reference) throw badRequest('REFERENCE_REQUIRED', 'Enter the bank transfer reference.');

  const payout = await runInTransaction(async (session) => {
    const found = await Payout.findById(payoutId).session(session);
    if (!found) throw notFound('PAYOUT_NOT_FOUND', 'Payout not found.');
    if (!rule.from.includes(found.status)) throw conflict('INVALID_PAYOUT_STATUS', `A ${found.status} payout cannot be changed this way.`);

    found.status = rule.to;
    found.reviewedBy = req.user._id;
    found.reviewedAt = new Date();
    if (note) found.note = note;

    if (rule.to === 'rejected') {
      found.isOpen = false;
      await Earning.updateMany({ payout: found._id, status: 'available' }, { $unset: { payout: 1 } }, { session });
    }
    if (rule.to === 'paid') {
      found.isOpen = false;
      found.reference = reference;
      found.paidAt = new Date();
      await Earning.updateMany({ payout: found._id, status: 'available' }, { status: 'paid' }, { session });
    }

    await found.save({ session });
    return found;
  });

  await logAudit(req, {
    action: `payout.${action}`,
    targetModel: 'Payout',
    targetId: payout._id,
    after: { status: payout.status, amount: payout.amount, reference: payout.reference },
  });

  const shop = await Shop.findById(payout.shop);
  const owner = shop && (await User.findById(shop.owner));
  if (owner) await notify(owner, 'payoutStatusChanged', { payout, reason: payout.status === 'rejected' ? note : undefined });

  return payout;
}

module.exports = { MIN_PAYOUT_CENTS, hasBankDetails, requestPayout, listShopPayouts, listAllPayouts, reviewPayout };
