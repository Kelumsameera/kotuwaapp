const Shop = require('../models/Shop');
const User = require('../models/User');
const Product = require('../models/Product');
const { uniqueSlug } = require('../utils/slug');
const { isShopImage } = require('./imageStorage');
const { deleteImagesNoLongerUsed } = require('./imageCleanupService');
const { logAudit } = require('./auditService');
const { notify } = require('./notifications/notify');
const { badRequest, conflict, forbidden, notFound } = require('../utils/AppError');

// Opens a new shop for a seller. It starts as "pending" until an admin approves it.
async function createShop(owner, { name, description, phone, address }) {
  if (await Shop.exists({ owner: owner._id })) {
    throw conflict('SHOP_EXISTS', 'You already have a shop.');
  }

  return Shop.create({
    owner: owner._id,
    name,
    slug: uniqueSlug(name, 'shop'),
    description,
    phone,
    address,
  });
}

// Checks that a logo/banner really was uploaded by this shop.
function checkShopImage(shop, image, field) {
  if (image && !isShopImage(shop._id, image)) {
    throw badRequest('INVALID_IMAGE', `The ${field} image is not one of your uploads.`);
  }
}

// Updates the seller's own shop. Suspended shops can't change anything.
// A rejected shop goes back to "pending" so the admin reviews the changes.
async function updateMyShop(shop, changes) {
  if (shop.status === 'suspended') {
    throw forbidden('SHOP_SUSPENDED', 'Your shop is suspended.');
  }

  checkShopImage(shop, changes.logo, 'logo');
  checkShopImage(shop, changes.banner, 'banner');

  const replacedImages = [];
  for (const field of ['logo', 'banner']) {
    if (changes[field] === undefined) continue;
    const oldImage = shop[field];
    if (oldImage?.publicId && oldImage.publicId !== changes[field]?.publicId) {
      replacedImages.push(oldImage.publicId);
    }
    shop[field] = changes[field] || undefined;
  }

  for (const field of ['name', 'description', 'phone', 'address', 'lowStockThreshold', 'freeShippingThreshold']) {
    if (changes[field] !== undefined) shop[field] = changes[field];
  }

  if (shop.status === 'rejected') {
    shop.status = 'pending';
    shop.statusReason = undefined;
  }

  await shop.save();
  await deleteImagesNoLongerUsed(shop._id, replacedImages);
  return shop;
}

// Escapes text for a safe regular-expression search.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Admin: one page of shops, optionally filtered by status or name.
async function listShops({ status, search, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.name = new RegExp(escapeRegex(search), 'i');

  const [shops, total] = await Promise.all([
    Shop.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Shop.countDocuments(filter),
  ]);
  return { shops, total, page, limit };
}

// Admin: approves, suspends or rejects a shop, logs it, and emails the owner.
async function changeShopStatus(req, shopId, { status, reason }) {
  const shop = await Shop.findById(shopId);
  if (!shop) throw notFound('SHOP_NOT_FOUND', 'Shop not found.');

  const before = { status: shop.status, statusReason: shop.statusReason };
  shop.status = status;
  shop.statusReason = status === 'approved' ? undefined : reason;
  await shop.save();

  // Products of a shop that is not approved disappear from the store at once.
  await Product.updateMany({ shop: shop._id }, { shopIsApproved: status === 'approved' });

  const actionNames = { approved: 'shop.approve', suspended: 'shop.suspend', rejected: 'shop.reject' };
  await logAudit(req, {
    action: actionNames[status],
    targetModel: 'Shop',
    targetId: shop._id,
    before,
    after: { status, statusReason: shop.statusReason },
  });

  const owner = await User.findById(shop.owner);
  if (owner) await notify(owner, 'shopStatusChanged', { shopName: shop.name, status, reason: shop.statusReason });

  return shop;
}

module.exports = { createShop, updateMyShop, listShops, changeShopStatus };
