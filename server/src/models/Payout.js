const mongoose = require('mongoose');

const PAYOUT_STATUSES = ['requested', 'approved', 'rejected', 'paid'];

// A seller asking to be paid their available earnings (cents).
// requested → approved → paid, or requested/approved → rejected.
const payoutSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: PAYOUT_STATUSES, default: 'requested', index: true },
    // true while requested or approved. Only one open payout per shop (see the index below).
    isOpen: { type: Boolean, default: true },
    // The bank account at the moment of the request (later changes don't affect this payout).
    bankDetails: {
      bankName: String,
      branch: String,
      accountName: String,
      accountNumber: String,
    },
    earnings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Earning' }],
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    note: { type: String, trim: true, maxlength: 300 },
    // The bank transfer reference, filled in when marked paid.
    reference: { type: String, trim: true, maxlength: 100 },
    paidAt: Date,
  },
  { timestamps: true }
);

// A shop can have only one open payout at a time (stops double requests).
payoutSchema.index({ shop: 1 }, { unique: true, partialFilterExpression: { isOpen: true } });
payoutSchema.index({ shop: 1, createdAt: -1 });

module.exports = mongoose.model('Payout', payoutSchema);
module.exports.PAYOUT_STATUSES = PAYOUT_STATUSES;
