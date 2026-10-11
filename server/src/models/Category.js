const mongoose = require('mongoose');
const { translatedText } = require('./schemaParts');

// A product category. Admins set the commission % charged on online sales in it.
const categorySchema = new mongoose.Schema(
  {
    name: translatedText({ maxlength: 80 }),
    slug: { type: String, required: true, unique: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    commissionPercent: { type: Number, required: true, min: 0, max: 100, default: 0 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
