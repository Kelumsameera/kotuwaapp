const mongoose = require('mongoose');

const STOCK_REASONS = [
  'initial',
  'manual_adjust',
  'online_order',
  'order_cancelled',
  'order_returned',
  'pos_sale',
  'pos_void',
];

// One row for every stock change: the full history of who changed what, and why.
const stockMovementSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    change: { type: Number, required: true },
    stockAfter: { type: Number, required: true },
    reason: { type: String, enum: STOCK_REASONS, required: true },
    note: { type: String, trim: true, maxlength: 200 },
    // The order, sub-order or POS bill that caused the change.
    refModel: { type: String },
    refId: { type: mongoose.Schema.Types.ObjectId },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('StockMovement', stockMovementSchema);
module.exports.STOCK_REASONS = STOCK_REASONS;
