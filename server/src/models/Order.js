const mongoose = require('mongoose');
const { PAYMENT_METHODS, PAYMENT_STATUSES } = require('../constants/orderStatus');

// The delivery address as it was at checkout (a copy, so later address edits don't change old orders).
const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    district: { type: String, required: true },
    province: { type: String, required: true },
    postalCode: { type: String },
  },
  { _id: false }
);

// One checkout. It holds one sub-order per seller; each seller only ever sees their sub-order.
// All money is in cents.
const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shippingAddress: { type: shippingAddressSchema, required: true },
    note: { type: String, trim: true, maxlength: 300 },

    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },

    itemsTotal: { type: Number, required: true },
    shippingTotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },

    // The customer's language when ordering (emails use their current language setting).
    language: { type: String, default: 'en' },
    subOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubOrder' }],

    // Sent by the browser once per checkout, so a double click can't create two orders.
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

orderSchema.index(
  { customer: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = mongoose.model('Order', orderSchema);
module.exports.shippingAddressSchema = shippingAddressSchema;
