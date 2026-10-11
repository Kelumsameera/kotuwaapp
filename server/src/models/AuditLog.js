const mongoose = require('mongoose');

// Who did what, and when, for sensitive actions (price changes, payouts, role changes, refunds, approvals).
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    action: { type: String, required: true, index: true },
    targetModel: { type: String },
    targetId: { type: mongoose.Schema.Types.ObjectId, index: true },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
