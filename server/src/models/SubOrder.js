const mongoose = require('mongoose');
const { ALL_ORDER_STATUSES, ORDER_STATUS } = require('../constants/orderStatus');
const { shippingAddressSchema } = require('./Order');
const { translatedText, imageSchema } = require('./schemaParts');

// One bought item, copied at checkout so later product edits don't change the order.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true },
    name: translatedText({ maxlength: 150 }),
    options: { size: String, color: String },
    image: imageSchema,
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
    weightGrams: { type: Number, default: 0 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    // Commission is fixed at checkout using the category's rate at that moment.
    commissionPercent: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
  },
  { _id: false }
);

// One entry in the timeline the customer sees: what happened, when, and who did it.
const trackingEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ALL_ORDER_STATUSES, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byRole: { type: String },
  },
  { _id: false }
);

// One seller's part of an order. Money is in cents.
const subOrderSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    subOrderNumber: { type: String, required: true, unique: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shippingAddress: { type: shippingAddressSchema, required: true },

    items: { type: [orderItemSchema], required: true },
    itemsSubtotal: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    total: { type: Number, required: true },
    commissionTotal: { type: Number, required: true },
    // What the seller earns: items minus commission, plus the delivery fee they collect.
    sellerNet: { type: Number, required: true },

    status: { type: String, enum: ALL_ORDER_STATUSES, default: ORDER_STATUS.PLACED, index: true },
    trackingHistory: { type: [trackingEventSchema], default: [] },

    // Filled in as the order is shipped and delivered (phase 5).
    delivery: {
      method: { type: String, enum: ['self', 'courier'] },
      courierName: String,
      trackingNumber: String,
      trackingUrl: String,
      provider: String,
      rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      attempts: { type: Number, default: 0 },
      failReasons: [String],
      codAmount: { type: Number, default: 0 },
      codCollected: { type: Boolean, default: false },
      codCollectedAt: Date,
      codCollectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      deliveredAt: Date,
    },
  },
  { timestamps: true }
);

subOrderSchema.index({ shop: 1, createdAt: -1 });

module.exports = mongoose.model('SubOrder', subOrderSchema);
