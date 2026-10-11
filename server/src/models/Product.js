const mongoose = require('mongoose');
const { translatedText, imageSchema } = require('./schemaParts');

const PRODUCT_STATUSES = ['draft', 'pending', 'approved', 'rejected'];

// One sellable version of a product, e.g. "Red / XL". All money is in cents (Rs 1 = 100).
// `stock` is the ONLY stock number. Online orders and POS sales both change it,
// and only through stockService.
const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true, trim: true, maxlength: 64 },
  barcode: { type: String, trim: true, maxlength: 64 },
  options: {
    size: { type: String, trim: true, maxlength: 40 },
    color: { type: String, trim: true, maxlength: 40 },
  },
  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  costPrice: { type: Number, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
});

const productSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    name: translatedText({ maxlength: 150 }),
    description: translatedText({ required: false, maxlength: 5000 }),
    slug: { type: String, required: true, unique: true },
    images: { type: [imageSchema], default: [] },
    weightGrams: { type: Number, min: 0, default: 0 },

    status: { type: String, enum: PRODUCT_STATUSES, default: 'draft', index: true },
    statusReason: { type: String, trim: true },
    // The seller can hide a product without deleting it.
    isActive: { type: Boolean, default: true },
    // Deleted products are archived, not removed, so old orders and bills still make sense.
    archivedAt: { type: Date, default: null },

    variants: { type: [variantSchema], validate: [(list) => list.length > 0, 'At least one variant is required.'] },

    // Copies kept for fast store searches (set automatically, never by the seller):
    // the lowest variant price (for price filter/sort), and whether the shop is approved.
    minPrice: { type: Number, default: 0 },
    shopIsApproved: { type: Boolean, default: false },

    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  // optimisticConcurrency: a save fails if the product changed since it was loaded
  // (for example, stock sold meanwhile). stockService bumps __v on every stock change.
  { timestamps: true, optimisticConcurrency: true }
);

// Keeps minPrice in step with the variants every time a product is saved.
productSchema.pre('validate', function updateMinPrice() {
  if (this.variants && this.variants.length > 0) {
    this.minPrice = Math.min(...this.variants.map((variant) => variant.price));
  }
});

// The store only lists approved, active, non-archived products of approved shops.
productSchema.index({ status: 1, isActive: 1, shopIsApproved: 1, archivedAt: 1, category: 1, createdAt: -1 });
productSchema.index({ status: 1, isActive: 1, shopIsApproved: 1, archivedAt: 1, minPrice: 1 });

// SKUs are unique inside one shop (checked again in the service for a clear error).
productSchema.index({ shop: 1, 'variants.sku': 1 }, { unique: true });
productSchema.index({ shop: 1, 'variants.barcode': 1 });
productSchema.index({ 'name.en': 'text', 'name.si': 'text', 'name.ta': 'text' }, { default_language: 'none' });

module.exports = mongoose.model('Product', productSchema);
module.exports.PRODUCT_STATUSES = PRODUCT_STATUSES;
