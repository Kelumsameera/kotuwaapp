const mongoose = require('mongoose');
const { translatedText } = require('./schemaParts');

const POS_SALE_STATUSES = ['held', 'completed', 'voided'];

// One line on a POS bill. Prices are copied at the moment of sale (cents).
const posItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true },
    name: translatedText({ maxlength: 150 }),
    options: { size: String, color: String },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    // Discount on this whole line (not per unit), in cents.
    itemDiscount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// A bill from the shop's POS. "held" bills are parked (no stock taken, no number yet);
// "completed" bills took stock and were paid; "voided" bills were cancelled by the owner (stock returned).
// POS sales pay no commission and need no delivery.
const posSaleSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    billNumber: { type: String },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: POS_SALE_STATUSES, required: true },

    items: { type: [posItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    itemDiscountTotal: { type: Number, default: 0 },
    billDiscount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0 },

    payment: {
      method: { type: String, enum: ['cash', 'card'] },
      cashReceived: Number,
      change: Number,
      cardReference: { type: String, trim: true, maxlength: 60 },
    },

    heldLabel: { type: String, trim: true, maxlength: 60 },
    completedAt: Date,
    voidedAt: Date,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidReason: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true, optimisticConcurrency: true }
);

// Bill numbers are unique within a shop (held bills have none yet).
posSaleSchema.index({ shop: 1, billNumber: 1 }, { unique: true, partialFilterExpression: { billNumber: { $type: 'string' } } });
posSaleSchema.index({ shop: 1, status: 1, completedAt: -1 });
posSaleSchema.index({ shop: 1, cashier: 1, completedAt: -1 });

module.exports = mongoose.model('PosSale', posSaleSchema);
module.exports.POS_SALE_STATUSES = POS_SALE_STATUSES;
