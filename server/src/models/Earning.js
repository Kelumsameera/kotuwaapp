const mongoose = require('mongoose');

const EARNING_STATUSES = ['pending', 'available', 'paid', 'reversed'];

// What a seller earns from one delivered sub-order (cents).
// "pending" until the return period after delivery has passed, then "available" for payouts.
// A returned order "reverses" the earning.
const earningSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    subOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SubOrder', required: true, unique: true },
    subOrderNumber: { type: String, required: true },
    gross: { type: Number, required: true },
    commission: { type: Number, required: true },
    net: { type: Number, required: true },
    status: { type: String, enum: EARNING_STATUSES, default: 'pending', index: true },
    releaseAt: { type: Date, required: true, index: true },
    availableAt: { type: Date },
    payout: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Earning', earningSchema);
module.exports.EARNING_STATUSES = EARNING_STATUSES;
