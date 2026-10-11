const mongoose = require('mongoose');
const { ALL_ROLES, LANGUAGES, ROLES } = require('../constants/roles');

// A Sri Lanka delivery address saved on the user's account.
const addressSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  addressLine1: { type: String, required: true, trim: true },
  addressLine2: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  district: { type: String, required: true, trim: true },
  province: { type: String, required: true, trim: true },
  postalCode: { type: String, trim: true },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },

    // select: false means the hash is never loaded unless a query asks for it.
    passwordHash: { type: String, required: true, select: false },
    passwordChangedAt: { type: Date },
    // Stored inside every access token. Bumping it (password or role change) makes old tokens invalid.
    tokenVersion: { type: Number, default: 0 },

    role: { type: String, enum: ALL_ROLES, default: ROLES.CUSTOMER },
    preferredLanguage: { type: String, enum: LANGUAGES, default: 'en' },
    isActive: { type: Boolean, default: true },

    // For seller_cashier accounts: the shop they work for.
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },

    isEmailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    failedLoginCount: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },

    addresses: [addressSchema],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

// Returns true while the account is locked after too many failed logins.
userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

module.exports = mongoose.model('User', userSchema);
