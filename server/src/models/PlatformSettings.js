const mongoose = require('mongoose');

// Site-wide settings set by the admin. There is only ever one document (key "platform").
const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'platform', unique: true },
    // Orders from one shop at or above this amount ship free (cents). null = no free shipping.
    freeShippingThreshold: { type: Number, default: null, min: 0 },
    // Seller earnings are released this many days after delivery.
    returnPeriodDays: { type: Number, default: 7, min: 0, max: 60 },
    // Delivery methods sellers are allowed to use.
    deliveryMethods: {
      selfDelivery: { type: Boolean, default: true },
      courier: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

// Returns the settings, creating them with defaults the first time.
async function getPlatformSettings() {
  return PlatformSettings.findOneAndUpdate(
    { key: 'platform' },
    { $setOnInsert: { key: 'platform' } },
    { new: true, upsert: true }
  );
}

module.exports = PlatformSettings;
module.exports.getPlatformSettings = getPlatformSettings;
