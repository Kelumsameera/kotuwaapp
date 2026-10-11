const AuditLog = require('../models/AuditLog');

// Records a sensitive action (who, what, when). Pass the request so we know who and from where.
async function logAudit(req, { action, targetModel, targetId, before, after }) {
  await AuditLog.create({
    actor: req.user ? req.user._id : undefined,
    actorRole: req.user ? req.user.role : undefined,
    action,
    targetModel,
    targetId,
    before,
    after,
    ip: req.ip,
  });
}

module.exports = { logAudit };
