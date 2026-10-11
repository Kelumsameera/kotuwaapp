const mongoose = require('mongoose');

// A delivery price. Admin rates have shop = null; a seller's own rates have their shop id.
// district = null means "every other district". Money in cents.
// Fee = baseFee for the first kg + extraPerKg for each extra (started) kg.
const shippingRateSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
    district: { type: String, default: null },
    baseFee: { type: Number, required: true, min: 0 },
    extraPerKg: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

shippingRateSchema.index({ shop: 1, district: 1 }, { unique: true });

module.exports = mongoose.model('ShippingRate', shippingRateSchema);
