const { getPlatformSettings } = require('../models/PlatformSettings');
const { logAudit } = require('./auditService');

// The settings fields the admin may change.
const EDITABLE_FIELDS = ['freeShippingThreshold', 'returnPeriodDays', 'deliveryMethods'];

// Admin: changes site-wide settings and writes the change to the audit log.
async function updatePlatformSettings(req, changes) {
  const settings = await getPlatformSettings();
  const before = {};
  for (const field of EDITABLE_FIELDS) {
    if (changes[field] === undefined) continue;
    before[field] = settings.toObject()[field];
    settings[field] = changes[field];
  }
  await settings.save();

  await logAudit(req, { action: 'settings.change', targetModel: 'PlatformSettings', targetId: settings._id, before, after: changes });
  return settings;
}

// Turns the settings into plain JSON.
function serializeSettings(settings) {
  return {
    freeShippingThreshold: settings.freeShippingThreshold ?? null,
    returnPeriodDays: settings.returnPeriodDays,
    deliveryMethods: {
      selfDelivery: settings.deliveryMethods.selfDelivery,
      courier: settings.deliveryMethods.courier,
    },
  };
}

module.exports = { getPlatformSettings, updatePlatformSettings, serializeSettings };
