const ShippingRate = require('../models/ShippingRate');
const { runInTransaction } = require('../utils/transaction');
const { logAudit } = require('./auditService');

// Used only if the admin has not set any rates yet: Rs 400 for the first kg, Rs 100 per extra kg.
const FALLBACK_RATE = { baseFee: 40000, extraPerKg: 10000 };

// Picks the most specific rate for a shop and district. Order of preference:
// 1. the shop's rate for that district   2. the shop's default rate
// 3. the admin's rate for that district  4. the admin's default rate   5. the fallback
async function findRate(shopId, district) {
  const rates = await ShippingRate.find({ shop: { $in: [shopId, null] }, district: { $in: [district, null] } }).lean();

  const pick = (wantShop, wantDistrict) =>
    rates.find(
      (rate) =>
        String(rate.shop) === String(wantShop) && (rate.district || null) === wantDistrict
    );

  return (
    pick(shopId, district) || pick(shopId, null) || pick(null, district) || pick(null, null) || FALLBACK_RATE
  );
}

// Fee for a parcel: baseFee covers the first kg, then extraPerKg for every started kg after that.
function feeForWeight(rate, weightGrams) {
  const kilograms = Math.max(1, Math.ceil(weightGrams / 1000));
  return rate.baseFee + rate.extraPerKg * (kilograms - 1);
}

// Delivery fee for one shop's part of an order. Free when the shop's items reach the
// free-shipping amount (the shop's own amount, or else the platform's).
async function shippingFeeFor({ shop, district, weightGrams, itemsSubtotal }, settings) {
  const threshold = shop.freeShippingThreshold ?? settings.freeShippingThreshold;
  if (threshold !== null && threshold !== undefined && itemsSubtotal >= threshold) return 0;

  const rate = await findRate(shop._id, district);
  return feeForWeight(rate, weightGrams);
}

// Lists rates: the admin's (shopId = null) or one shop's.
function listRates(shopId) {
  return ShippingRate.find({ shop: shopId || null }).sort({ district: 1 }).lean();
}

// Replaces all rates of the admin (shopId = null) or of one shop with a new list.
async function replaceRates(req, shopId, rates) {
  const owner = shopId || null;
  const before = await listRates(owner);

  await runInTransaction(async (session) => {
    await ShippingRate.deleteMany({ shop: owner }, { session });
    if (rates.length > 0) {
      await ShippingRate.insertMany(
        rates.map((rate) => ({ ...rate, district: rate.district || null, shop: owner })),
        { session }
      );
    }
  });

  if (!shopId) {
    await logAudit(req, {
      action: 'shipping.rates_change',
      targetModel: 'ShippingRate',
      before: before.map(({ district, baseFee, extraPerKg }) => ({ district, baseFee, extraPerKg })),
      after: rates,
    });
  }
  return listRates(owner);
}

module.exports = { FALLBACK_RATE, findRate, feeForWeight, shippingFeeFor, listRates, replaceRates };
