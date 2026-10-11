const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { runInTransaction } = require('../utils/transaction');
const { AppError, notFound } = require('../utils/AppError');

// ─────────────────────────────────────────────────────────────────────────────
// The ONLY place in the app that changes stock.
// Online orders, POS sales, cancellations, returns and manual adjustments all
// come through here, so stock can never get out of sync between them.
//
// Every change also bumps the product's version (__v). Product edits are saved
// with a version check, so an edit form can never write an old stock number back.
// ─────────────────────────────────────────────────────────────────────────────

// Reads the new stock of one variant from an updated product.
function stockOfVariant(product, variantId) {
  return product.variants.find((variant) => String(variant._id) === String(variantId)).stock;
}

// Saves one row in the stock history.
function recordMovement({ product, variantId, change, stockAfter, reason, note, refModel, refId, by }, session) {
  return StockMovement.create(
    [{ shop: product.shop, product: product._id, variantId, change, stockAfter, reason, note, refModel, refId, by }],
    { session }
  );
}

// Lowers one variant's stock, but only if enough is left. Returns the updated product or null.
// The check and the change happen in ONE database operation, so two buyers can never
// both get the last item.
function decreaseIfAvailable({ productId, variantId, quantity, shopId }, session) {
  const filter = {
    _id: productId,
    archivedAt: null,
    variants: { $elemMatch: { _id: variantId, stock: { $gte: quantity } } },
  };
  if (shopId) filter.shop = shopId;

  return Product.findOneAndUpdate(
    filter,
    { $inc: { 'variants.$.stock': -quantity, __v: 1 } },
    { new: true, session }
  );
}

// Raises one variant's stock. Returns the updated product or null if not found.
function increase({ productId, variantId, quantity, shopId }, session) {
  const filter = { _id: productId, 'variants._id': variantId };
  if (shopId) filter.shop = shopId;

  return Product.findOneAndUpdate(filter, { $inc: { 'variants.$.stock': quantity, __v: 1 } }, { new: true, session });
}

// Takes stock for a list of items (an order or a POS bill). Must run inside a transaction:
// if any item is short, an error is thrown and the whole transaction is rolled back.
// items: [{ productId, variantId, quantity, shopId? }]
async function takeStock(items, { session, reason, refModel, refId, by }) {
  const results = [];

  for (const item of items) {
    const product = await decreaseIfAvailable(item, session);
    if (!product) {
      throw new AppError(409, 'OUT_OF_STOCK', 'Some items are no longer available in that quantity.', [
        { productId: String(item.productId), variantId: String(item.variantId) },
      ]);
    }

    const stockAfter = stockOfVariant(product, item.variantId);
    await recordMovement(
      { product, variantId: item.variantId, change: -item.quantity, stockAfter, reason, refModel, refId, by },
      session
    );
    results.push({ ...item, stockAfter, product });
  }

  return results;
}

// Puts stock back (cancelled order, returned order, voided POS bill). Runs inside a transaction.
async function returnStock(items, { session, reason, refModel, refId, by }) {
  for (const item of items) {
    const product = await increase(item, session);
    // A variant deleted since the sale has nowhere to return stock to; skip it.
    if (!product) continue;

    const stockAfter = stockOfVariant(product, item.variantId);
    await recordMovement(
      { product, variantId: item.variantId, change: item.quantity, stockAfter, reason, refModel, refId, by },
      session
    );
  }
}

// Records the starting stock of a new variant (the stock itself is saved with the product).
async function recordInitialStock(product, variant, by, session) {
  if (!variant.stock) return;
  await recordMovement(
    { product, variantId: variant._id, change: variant.stock, stockAfter: variant.stock, reason: 'initial', by },
    session
  );
}

// A seller adds or removes stock by hand (new delivery, damaged goods, stock count).
// Returns the new stock number and whether it is now low.
async function adjustStockManually({ shop, productId, variantId, change, note, by }) {
  return runInTransaction(async (session) => {
    const item = { productId, variantId, quantity: Math.abs(change), shopId: shop._id };
    const product = change > 0 ? await increase(item, session) : await decreaseIfAvailable(item, session);

    if (!product) {
      const exists = await Product.exists({ _id: productId, shop: shop._id, archivedAt: null, 'variants._id': variantId });
      if (!exists) throw notFound('PRODUCT_NOT_FOUND', 'Product not found.');
      throw new AppError(409, 'NOT_ENOUGH_STOCK', 'Stock cannot go below zero.');
    }

    const stockAfter = stockOfVariant(product, variantId);
    await recordMovement({ product, variantId, change, stockAfter, reason: 'manual_adjust', note, by }, session);

    return { stock: stockAfter, isLow: stockAfter <= shop.lowStockThreshold };
  });
}

// Lists the latest stock changes of one product (for the seller's history view).
function listMovements(shopId, productId, limit = 50) {
  return StockMovement.find({ shop: shopId, product: productId }).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = { takeStock, returnStock, recordInitialStock, adjustStockManually, listMovements };
