const mongoose = require('mongoose');
const Product = require('../models/Product');
const PosSale = require('../models/PosSale');
const { nextCounterValue } = require('../models/Counter');
const { ROLES } = require('../constants/roles');
const stockService = require('./stockService');
const { logAudit } = require('./auditService');
const { runInTransaction } = require('../utils/transaction');
const { colomboDateStamp } = require('../utils/colomboTime');
const { AppError, badRequest, conflict, forbidden, notFound } = require('../utils/AppError');

// ─────────────────────────────────────────────────────────────────────────────
// The shop's POS. Prices always come from the database (the screen only sends ids,
// quantities and discounts). Stock is taken through stockService, the same as online
// orders, so the two can never get out of sync. POS sales pay no commission.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RESULTS = 20;

// Escapes text for a safe regular-expression search.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Products the POS can sell: this shop's, not archived (drafts and hidden ones too,
// since they may be on the shop shelf even if not online).
function posProductFilter(shop) {
  return { shop: shop._id, archivedAt: null };
}

// One variant as the POS shows it. Never includes the cost price.
function toPosItem(product, variant) {
  return {
    productId: String(product._id),
    variantId: String(variant._id),
    name: product.name,
    sku: variant.sku,
    barcode: variant.barcode || '',
    options: { size: variant.options?.size || '', color: variant.options?.color || '' },
    price: variant.price,
    stock: variant.stock,
  };
}

// Barcode scanner / typed code: finds the ONE variant with this exact barcode or SKU.
async function lookupByCode(shop, code) {
  const product = await Product.findOne({
    ...posProductFilter(shop),
    $or: [{ 'variants.barcode': code }, { 'variants.sku': code }],
  }).lean();
  const variant = product?.variants.find((candidate) => candidate.barcode === code || candidate.sku === code);
  if (!variant) throw notFound('CODE_NOT_FOUND', 'No product with that barcode or SKU.');
  return toPosItem(product, variant);
}

// Typed search: name in any language, or the start of a SKU/barcode. One result per variant.
async function searchProducts(shop, text) {
  const pattern = new RegExp(escapeRegex(text), 'i');
  const startsWith = new RegExp(`^${escapeRegex(text)}`, 'i');
  const products = await Product.find({
    ...posProductFilter(shop),
    $or: [{ 'name.en': pattern }, { 'name.si': pattern }, { 'name.ta': pattern }, { 'variants.sku': startsWith }, { 'variants.barcode': startsWith }],
  })
    .limit(MAX_RESULTS)
    .lean();

  return products.flatMap((product) => product.variants.map((variant) => toPosItem(product, variant))).slice(0, MAX_RESULTS);
}

// Works out a bill from what the screen sent: [{ productId, variantId, quantity, itemDiscount }] + billDiscount.
// Prices come from the database. Throws if a product is unknown or a discount is too big.
async function buildBill(shop, items, billDiscount = 0) {
  const variantIds = items.map((item) => item.variantId);
  if (new Set(variantIds).size !== variantIds.length) throw badRequest('DUPLICATE_LINE', 'Each product can appear only once on a bill.');

  const products = await Product.find({ ...posProductFilter(shop), _id: { $in: items.map((item) => item.productId) } });
  const lines = items.map((item) => {
    const product = products.find((candidate) => String(candidate._id) === item.productId);
    const variant = product?.variants.id(item.variantId);
    if (!variant) throw notFound('PRODUCT_NOT_FOUND', 'A product on this bill no longer exists.');

    const gross = variant.price * item.quantity;
    const itemDiscount = item.itemDiscount || 0;
    if (itemDiscount > gross) throw badRequest('DISCOUNT_TOO_BIG', 'A discount is bigger than its line.');

    return {
      product: product._id,
      variantId: variant._id,
      sku: variant.sku,
      name: product.name,
      options: { size: variant.options?.size, color: variant.options?.color },
      unitPrice: variant.price,
      quantity: item.quantity,
      itemDiscount,
      lineTotal: gross - itemDiscount,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const itemDiscountTotal = lines.reduce((sum, line) => sum + line.itemDiscount, 0);
  const afterItemDiscounts = subtotal - itemDiscountTotal;
  if (billDiscount > afterItemDiscounts) throw badRequest('DISCOUNT_TOO_BIG', 'The bill discount is bigger than the bill.');

  return { lines, subtotal, itemDiscountTotal, billDiscount, total: afterItemDiscounts - billDiscount };
}

// Cashiers may only give up to the shop's limit in total discounts; the owner has no limit.
function checkDiscountLimit(user, shop, bill) {
  if (user.role !== ROLES.SELLER_CASHIER) return;
  const limitPercent = shop.cashierMaxDiscountPercent ?? 10;
  const totalDiscount = bill.itemDiscountTotal + bill.billDiscount;
  if (totalDiscount * 100 > bill.subtotal * limitPercent) {
    throw forbidden('DISCOUNT_LIMIT', `Cashiers can give at most ${limitPercent}% discount. Ask the owner.`);
  }
}

// Works out the payment: cash must cover the total (change is given back); card needs no cash.
function buildPayment(payment, total) {
  if (payment.method === 'cash') {
    const cashReceived = payment.cashReceived ?? total;
    if (cashReceived < total) throw badRequest('NOT_ENOUGH_CASH', 'The cash received is less than the total.');
    return { method: 'cash', cashReceived, change: cashReceived - total };
  }
  return { method: 'card', cardReference: payment.cardReference };
}

// Makes the next bill number for this shop, e.g. 261011-0007 (restarts at 1 each day).
async function nextBillNumber(shop, session) {
  const stamp = colomboDateStamp();
  const sequence = await nextCounterValue(`pos-${shop._id}-${stamp}`, session);
  return `${stamp}-${String(sequence).padStart(4, '0')}`;
}

// Completes a sale: takes stock and saves the paid bill, all at once (or nothing at all).
// expectedTotal = the total on the cashier's screen; if prices changed meanwhile, the sale is refused.
async function completeSale(user, shop, { items, billDiscount, payment, expectedTotal, heldSaleId }) {
  const bill = await buildBill(shop, items, billDiscount);
  if (expectedTotal !== bill.total) {
    throw new AppError(409, 'TOTAL_CHANGED', 'A price changed. Please check the new total.', { total: bill.total });
  }
  checkDiscountLimit(user, shop, bill);
  const paymentDetails = buildPayment(payment, bill.total);

  try {
    return await runInTransaction(async (session) => {
      // Resuming a held bill turns that same record into the completed sale.
      let sale;
      if (heldSaleId) {
        sale = await PosSale.findOne({ _id: heldSaleId, shop: shop._id, status: 'held' }).session(session);
        if (!sale) throw notFound('HELD_BILL_NOT_FOUND', 'That held bill is no longer available.');
      } else {
        sale = new PosSale({ shop: shop._id });
      }

      await stockService.takeStock(
        bill.lines.map((line) => ({ productId: line.product, variantId: line.variantId, quantity: line.quantity, shopId: shop._id })),
        { session, reason: 'pos_sale', refModel: 'PosSale', refId: sale._id, by: user._id }
      );

      Object.assign(sale, {
        billNumber: await nextBillNumber(shop, session),
        cashier: user._id,
        status: 'completed',
        items: bill.lines,
        subtotal: bill.subtotal,
        itemDiscountTotal: bill.itemDiscountTotal,
        billDiscount: bill.billDiscount,
        total: bill.total,
        payment: paymentDetails,
        completedAt: new Date(),
      });
      await sale.save({ session });
      return sale;
    });
  } catch (error) {
    // Two terminals completing the same held bill at once: only one wins.
    if (error.name === 'VersionError') throw conflict('HELD_BILL_NOT_FOUND', 'That held bill was just completed elsewhere.');
    throw error;
  }
}

// Parks a bill to finish later (e.g. the customer went to fetch something). No stock is taken.
async function holdBill(user, shop, { items, billDiscount, label }) {
  const bill = await buildBill(shop, items, billDiscount);
  return PosSale.create({
    shop: shop._id,
    cashier: user._id,
    status: 'held',
    heldLabel: label,
    items: bill.lines,
    subtotal: bill.subtotal,
    itemDiscountTotal: bill.itemDiscountTotal,
    billDiscount: bill.billDiscount,
    total: bill.total,
  });
}

// All held bills of this shop (any cashier of the shop can resume them), oldest first.
function listHeldBills(shop) {
  return PosSale.find({ shop: shop._id, status: 'held' }).populate('cashier', 'name').sort({ createdAt: 1 });
}

// Deletes a held bill (customer left, or it was loaded back into the screen).
async function deleteHeldBill(shop, saleId) {
  const result = await PosSale.deleteOne({ _id: saleId, shop: shop._id, status: 'held' });
  if (result.deletedCount === 0) throw notFound('HELD_BILL_NOT_FOUND', 'That held bill is no longer available.');
}

// One completed or voided sale (for reprinting). Cashiers can only open their own sales.
async function getSale(user, shop, saleId) {
  const filter = { _id: saleId, shop: shop._id, status: { $in: ['completed', 'voided'] } };
  if (user.role === ROLES.SELLER_CASHIER) filter.cashier = user._id;
  const sale = await PosSale.findOne(filter).populate('cashier', 'name');
  if (!sale) throw notFound('SALE_NOT_FOUND', 'Sale not found.');
  return sale;
}

// Owner: cancels a completed sale (wrong items, refund at the counter). Stock goes back.
async function voidSale(req, shop, saleId, reason) {
  const sale = await runInTransaction(async (session) => {
    const found = await PosSale.findOne({ _id: saleId, shop: shop._id }).session(session);
    if (!found) throw notFound('SALE_NOT_FOUND', 'Sale not found.');
    if (found.status !== 'completed') throw conflict('SALE_NOT_COMPLETED', 'Only completed sales can be voided.');

    await stockService.returnStock(
      found.items.map((line) => ({ productId: line.product, variantId: line.variantId, quantity: line.quantity, shopId: shop._id })),
      { session, reason: 'pos_void', refModel: 'PosSale', refId: found._id, by: req.user._id }
    );
    found.status = 'voided';
    found.voidedAt = new Date();
    found.voidedBy = req.user._id;
    found.voidReason = reason;
    await found.save({ session });
    return found;
  });

  await logAudit(req, {
    action: 'pos.void',
    targetModel: 'PosSale',
    targetId: sale._id,
    before: { status: 'completed', total: sale.total },
    after: { status: 'voided', reason },
  });
  return sale;
}

// Shared match for "this shop's sales finished between start and end".
function finishedBetween(shopId, start, end, extra = {}) {
  return {
    shop: new mongoose.Types.ObjectId(String(shopId)),
    status: { $in: ['completed', 'voided'] },
    completedAt: { $gte: start, $lt: end },
    ...extra,
  };
}

module.exports = {
  lookupByCode,
  searchProducts,
  buildBill,
  completeSale,
  holdBill,
  listHeldBills,
  deleteHeldBill,
  getSale,
  voidSale,
  finishedBetween,
};
