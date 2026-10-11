const mongoose = require('mongoose');

// One row per refresh token ever issued. Only the sha256 hash is stored, never the token.
// "family" links a chain of rotated tokens so a stolen, reused token can kill the whole chain.
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByHash: { type: String },
    createdByIp: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

// MongoDB deletes expired rows automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
