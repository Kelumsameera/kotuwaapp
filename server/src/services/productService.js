const Product = require('../models/Product');
const Shop = require('../models/Shop');
const User = require('../models/User');
const stockService = require('./stockService');
const { findActiveCategory } = require('./categoryService');
const { isShopImage } = require('./imageStorage');
const { deleteImagesNoLongerUsed } = require('./imageCleanupService');
const { logAudit } = require('./auditService');
const { notify } = require('./notifications/notify');
const { runInTransaction } = require('../utils/transaction');
const { uniqueSlug } = require('../utils/slug');
const { badRequest, conflict, notFound } = require('../utils/AppError');

// Changing any of these on an approved product sends it back for admin review.
// Price and stock changes do not.
const REVIEWED_FIELDS = ['name', 'description', 'images', 'category'];

// A product edit is retried this many times if stock changed while it was being saved.
const MAX_SAVE_ATTEMPTS = 3;

// Escapes text for a safe regular-expression search.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Loads one of the seller's own (not archived) products, or answers 404.
// Another shop's product also gives 404, so ids can't be probed.
async function findMyProduct(shop, productId) {
  const product = await Product.findOne({ _id: productId, shop: shop._id, archivedAt: null });
  if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Product not found.');
  return product;
}

// Makes sure every image was uploaded by this shop.
function checkImages(shop, images = []) {
  const foreignImage = images.find((image) => !isShopImage(shop._id, image));
  if (foreignImage) throw badRequest('INVALID_IMAGE', 'Some images are not your uploads.');
}

// Returns the first value that appears twice in a list, or undefined.
function findDuplicate(values) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
}

// SKUs (and barcodes) must be unique inside the shop, because POS search relies on them.
async function checkCodesAreFree(shopId, variants, ignoreProductId) {
  for (const field of ['sku', 'barcode']) {
    const codes = variants.map((variant) => variant[field]).filter(Boolean);
    const duplicate = findDuplicate(codes);
    if (duplicate) throw conflict(`DUPLICATE_${field.toUpperCase()}`, `"${duplicate}" is used twice.`);

    if (codes.length === 0) continue;
    const filter = { shop: shopId, [`variants.${field}`]: { $in: codes } };
    if (ignoreProductId) filter._id = { $ne: ignoreProductId };

    const other = await Product.findOne(filter, { variants: 1 });
    if (other) {
      const taken = other.variants.map((variant) => variant[field]).find((code) => codes.includes(code));
      throw conflict(`${field.toUpperCase()}_TAKEN`, `"${taken}" is already used by another product.`);
    }
  }
}

// Seller: one page of their own products.
async function listMyProducts(shop, { status, search, page, limit }) {
  const filter = { shop: shop._id, archivedAt: null };
  if (status) filter.status = status;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ 'name.en': pattern }, { 'name.si': pattern }, { 'name.ta': pattern }, { 'variants.sku': pattern }];
  }

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  return { products, total, page, limit };
}

// Seller: creates a product as a draft, with its starting stock recorded in the history.
async function createProduct(user, shop, data) {
  await findActiveCategory(data.category);
  checkImages(shop, data.images);
  await checkCodesAreFree(shop._id, data.variants);

  return runInTransaction(async (session) => {
    const [product] = await Product.create(
      [
        {
          ...data,
          shop: shop._id,
          slug: uniqueSlug(data.name.en, 'product'),
          status: 'draft',
          shopIsApproved: shop.status === 'approved',
        },
      ],
      { session }
    );
    for (const variant of product.variants) {
      await stockService.recordInitialStock(product, variant, user._id, session);
    }
    return product;
  });
}

// Builds the new variant list from the edit form.
// Existing variants (sent with _id) keep their CURRENT stock: stock only changes through stockService.
// New variants (no _id) start with the stock given in the form.
function mergeVariants(product, incomingVariants) {
  const existingById = new Map(product.variants.map((variant) => [String(variant._id), variant]));
  const newVariantIndexes = [];

  const merged = incomingVariants.map((incoming, index) => {
    const editable = {
      sku: incoming.sku,
      barcode: incoming.barcode,
      options: incoming.options,
      price: incoming.price,
      compareAtPrice: incoming.compareAtPrice,
      costPrice: incoming.costPrice,
    };

    if (!incoming._id) {
      newVariantIndexes.push(index);
      return { ...editable, stock: incoming.stock || 0 };
    }

    const existing = existingById.get(incoming._id);
    if (!existing) throw badRequest('UNKNOWN_VARIANT', 'A variant in the form does not belong to this product.');
    return { ...editable, _id: existing._id, stock: existing.stock };
  });

  return { merged, newVariantIndexes };
}

// Lists variants whose selling price changed, for the audit log.
function findPriceChanges(oldVariants, newVariants) {
  const oldById = new Map(oldVariants.map((variant) => [String(variant._id), variant]));
  return newVariants
    .filter((variant) => variant._id && oldById.has(String(variant._id)))
    .filter((variant) => oldById.get(String(variant._id)).price !== variant.price)
    .map((variant) => ({ sku: variant.sku, before: oldById.get(String(variant._id)).price, after: variant.price }));
}

// One attempt at saving a product edit. Throws VersionError if stock changed meanwhile.
async function applyProductUpdate(req, shop, productId, changes) {
  const product = await findMyProduct(shop, productId);

  if (changes.category) await findActiveCategory(changes.category);
  if (changes.images) checkImages(shop, changes.images);
  if (changes.variants) await checkCodesAreFree(shop._id, changes.variants, product._id);

  const before = product.toObject();
  const reviewedFieldsChanged = REVIEWED_FIELDS.some(
    (field) => changes[field] !== undefined && JSON.stringify(changes[field]) !== JSON.stringify(before[field] ?? null)
  );

  let newVariantIndexes = [];
  let priceChanges = [];
  if (changes.variants) {
    const result = mergeVariants(product, changes.variants);
    newVariantIndexes = result.newVariantIndexes;
    priceChanges = findPriceChanges(before.variants, result.merged);
    product.variants = result.merged;
  }

  for (const field of ['category', 'name', 'description', 'images', 'weightGrams']) {
    if (changes[field] !== undefined) product[field] = changes[field];
  }

  if (reviewedFieldsChanged && product.status === 'approved') {
    product.status = 'pending';
    product.statusReason = undefined;
  }

  await runInTransaction(async (session) => {
    await product.save({ session });
    for (const index of newVariantIndexes) {
      await stockService.recordInitialStock(product, product.variants[index], req.user._id, session);
    }
  });

  // After saving: remove images the seller took off, and log price changes.
  const keptImageIds = new Set(product.images.map((image) => image.publicId));
  const removedImageIds = before.images.map((image) => image.publicId).filter((id) => !keptImageIds.has(id));
  await deleteImagesNoLongerUsed(shop._id, removedImageIds);

  if (priceChanges.length > 0) {
    await logAudit(req, {
      action: 'product.price_change',
      targetModel: 'Product',
      targetId: product._id,
      before: priceChanges.map(({ sku, before: price }) => ({ sku, price })),
      after: priceChanges.map(({ sku, after: price }) => ({ sku, price })),
    });
  }

  return product;
}

// Seller: edits a product. If stock was sold while saving, the edit is re-applied
// on the fresh product so the stock number is never overwritten.
async function updateProduct(req, shop, productId, changes) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await applyProductUpdate(req, shop, productId, changes);
    } catch (error) {
      if (error.name !== 'VersionError') throw error;
      if (attempt >= MAX_SAVE_ATTEMPTS) {
        throw conflict('PRODUCT_BUSY', 'This product is changing right now. Please try again.');
      }
    }
  }
}

// Seller: sends a draft or rejected product to the admin for review.
async function submitForReview(shop, productId) {
  const product = await findMyProduct(shop, productId);

  if (!['draft', 'rejected'].includes(product.status)) {
    throw conflict('ALREADY_SUBMITTED', 'This product is already submitted or approved.');
  }
  if (product.images.length === 0) {
    throw badRequest('IMAGES_REQUIRED', 'Add at least one image before submitting.');
  }
  await findActiveCategory(product.category);

  const updated = await Product.findOneAndUpdate(
    { _id: product._id, status: product.status },
    { status: 'pending', $unset: { statusReason: 1 } },
    { new: true }
  );
  if (!updated) throw conflict('PRODUCT_BUSY', 'This product changed. Please try again.');
  return updated;
}

// Seller: shows or hides a product in the store without deleting it.
async function setVisibility(shop, productId, isActive) {
  const product = await Product.findOneAndUpdate(
    { _id: productId, shop: shop._id, archivedAt: null },
    { isActive },
    { new: true }
  );
  if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Product not found.');
  return product;
}

// Seller: "deletes" a product. It is archived so old orders and POS bills still show it.
async function archiveProduct(shop, productId) {
  const product = await Product.findOneAndUpdate(
    { _id: productId, shop: shop._id, archivedAt: null },
    { archivedAt: new Date(), isActive: false },
    { new: true }
  );
  if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Product not found.');
}

// Admin: one page of products (default: those waiting for review), with shop names.
async function listProductsForAdmin({ status, search, page, limit }) {
  const filter = { archivedAt: null };
  if (status) filter.status = status;
  if (search) filter['name.en'] = new RegExp(escapeRegex(search), 'i');

  const [products, total] = await Promise.all([
    Product.find(filter).populate('shop', 'name status').sort({ updatedAt: 1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  return { products, total, page, limit };
}

// Admin: approves or rejects a pending product, logs it, and emails the seller.
async function reviewProduct(req, productId, { decision, reason }) {
  const status = decision === 'approve' ? 'approved' : 'rejected';
  const update = status === 'approved' ? { status, $unset: { statusReason: 1 } } : { status, statusReason: reason };

  const product = await Product.findOneAndUpdate({ _id: productId, status: 'pending', archivedAt: null }, update, {
    new: true,
  });
  if (!product) {
    if (await Product.exists({ _id: productId })) throw conflict('NOT_PENDING', 'This product is not waiting for review.');
    throw notFound('PRODUCT_NOT_FOUND', 'Product not found.');
  }

  await logAudit(req, {
    action: status === 'approved' ? 'product.approve' : 'product.reject',
    targetModel: 'Product',
    targetId: product._id,
    before: { status: 'pending' },
    after: { status, statusReason: product.statusReason },
  });

  const shop = await Shop.findById(product.shop);
  const owner = shop && (await User.findById(shop.owner));
  if (owner) {
    const productName = product.name[owner.preferredLanguage] || product.name.en;
    await notify(owner, 'productStatusChanged', { productName, status, reason: product.statusReason });
  }

  return product;
}

module.exports = {
  findMyProduct,
  listMyProducts,
  createProduct,
  updateProduct,
  submitForReview,
  setVisibility,
  archiveProduct,
  listProductsForAdmin,
  reviewProduct,
};
