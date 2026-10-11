const Product = require('../models/Product');
const Shop = require('../models/Shop');
const User = require('../models/User');
const { notify } = require('./notifications/notify');

// Every variant of a shop's (not archived) products whose stock is at or below the shop's alert level.
// Returns [{ productId, variantId, name, sku, options, stock, alertSent }], lowest stock first.
async function listLowStock(shop) {
  const products = await Product.find(
    { shop: shop._id, archivedAt: null, 'variants.stock': { $lte: shop.lowStockThreshold } },
    { name: 1, variants: 1 }
  ).lean();

  const lowItems = [];
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.stock > shop.lowStockThreshold) continue;
      lowItems.push({
        productId: String(product._id),
        variantId: String(variant._id),
        name: product.name,
        sku: variant.sku,
        options: variant.options || {},
        stock: variant.stock,
        alertSent: Boolean(variant.lowStockAlertSentAt),
      });
    }
  }
  return lowItems.sort((a, b) => a.stock - b.stock);
}

// Marks variants as "seller already told", so the same alert isn't emailed again.
// Bumps the product version (__v) so a seller edit saved at the same time can't undo it.
async function markAlertsSent(items, now) {
  for (const item of items) {
    await Product.updateOne(
      { _id: item.productId, 'variants._id': item.variantId },
      { $set: { 'variants.$.lowStockAlertSentAt': now }, $inc: { __v: 1 } }
    );
  }
}

// Job: emails each seller ONE list of items that newly went low since the last email.
// An item is emailed again only after it is restocked and runs low again. Returns emails sent.
async function sendLowStockDigests(now = new Date()) {
  const shopIds = await Product.distinct('shop', { archivedAt: null, 'variants.lowStockAlertSentAt': null });
  const shops = await Shop.find({ _id: { $in: shopIds }, status: { $in: ['approved', 'pending'] } });
  let emailsSent = 0;

  for (const shop of shops) {
    const newItems = (await listLowStock(shop)).filter((item) => !item.alertSent);
    if (newItems.length === 0) continue;

    const owner = await User.findById(shop.owner);
    if (owner) {
      await notify(owner, 'lowStockDigest', { shopName: shop.name, items: newItems });
      emailsSent += 1;
    }
    await markAlertsSent(newItems, now);
  }
  return emailsSent;
}

module.exports = { listLowStock, sendLowStockDigests };
