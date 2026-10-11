const mongoose = require('mongoose');
const { translatedText, imageSchema } = require('./schemaParts');

const SHOP_STATUSES = ['pending', 'approved', 'suspended', 'rejected'];

// A seller's shop. Each seller owns exactly one. It can sell only after an admin approves it.
const shopSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true },
    description: translatedText({ required: false, maxlength: 2000 }),
    logo: imageSchema,
    banner: imageSchema,
    phone: { type: String, trim: true },
    address: {
      addressLine1: { type: String, trim: true },
      city: { type: String, trim: true },
      district: { type: String, trim: true },
      postalCode: { type: String, trim: true },
    },

    status: { type: String, enum: SHOP_STATUSES, default: 'pending', index: true },
    statusReason: { type: String, trim: true },

    // Which delivery methods this seller offers (the admin can also switch methods off site-wide).
    deliveryMethods: {
      selfDelivery: { type: Boolean, default: true },
      courier: { type: Boolean, default: true },
    },

    // Where payouts are sent. Only the owner and admins ever see this.
    bankDetails: {
      bankName: { type: String, trim: true },
      branch: { type: String, trim: true },
      accountName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
    },

    // This shop's free-shipping amount in cents. null = use the platform setting.
    freeShippingThreshold: { type: Number, default: null, min: 0 },

    // The most a cashier may take off a POS bill in total, as % of the bill (the owner has no limit).
    cashierMaxDiscountPercent: { type: Number, default: 10, min: 0, max: 100 },

    // Stock at or below this number shows a low-stock alert.
    lowStockThreshold: { type: Number, default: 5, min: 0 },

    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Shop', shopSchema);
module.exports.SHOP_STATUSES = SHOP_STATUSES;
