const Product = require('../models/Product');
const Shop = require('../models/Shop');
const Category = require('../models/Category');
const { notFound } = require('../utils/AppError');

// The rule for "can shoppers see this product?" — used everywhere in the store.
const LISTED = { status: 'approved', isActive: true, archivedAt: null, shopIsApproved: true };

// Shop fields shown next to products.
const SHOP_FIELDS = 'name slug logo ratingAverage ratingCount address.district';

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { minPrice: 1, createdAt: -1 },
  price_desc: { minPrice: -1, createdAt: -1 },
  rating: { ratingAverage: -1, ratingCount: -1 },
};

// Escapes text for a safe regular-expression search.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Finds a category by slug and returns its id plus its sub-categories' ids.
async function categoryAndChildrenIds(slug) {
  const category = await Category.findOne({ slug, isActive: true });
  if (!category) return null;
  const children = await Category.find({ parent: category._id, isActive: true }, { _id: 1 });
  return [category._id, ...children.map((child) => child._id)];
}

// Store search: one page of listed products with filters and sorting.
async function listProducts({ search, category, shop, minPrice, maxPrice, sort, page, limit }) {
  const filter = { ...LISTED };

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ 'name.en': pattern }, { 'name.si': pattern }, { 'name.ta': pattern }];
  }
  if (category) {
    const categoryIds = await categoryAndChildrenIds(category);
    if (!categoryIds) return { products: [], total: 0, page, limit };
    filter.category = { $in: categoryIds };
  }
  if (shop) {
    const shopDoc = await Shop.findOne({ slug: shop, status: 'approved' }, { _id: 1 });
    if (!shopDoc) return { products: [], total: 0, page, limit };
    filter.shop = shopDoc._id;
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.minPrice = {};
    if (minPrice !== undefined) filter.minPrice.$gte = minPrice;
    if (maxPrice !== undefined) filter.minPrice.$lte = maxPrice;
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('shop', SHOP_FIELDS)
      .sort(SORTS[sort] || SORTS.newest)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);
  return { products, total, page, limit };
}

// One listed product by its slug, with shop and category details.
async function getProductBySlug(slug) {
  const product = await Product.findOne({ ...LISTED, slug })
    .populate('shop', SHOP_FIELDS)
    .populate('category', 'name slug parent');
  if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Product not found.');
  return product;
}

// One approved shop by its slug.
async function getShopBySlug(slug) {
  const shop = await Shop.findOne({ slug, status: 'approved' });
  if (!shop) throw notFound('SHOP_NOT_FOUND', 'Shop not found.');
  return shop;
}

// Loads listed products by id (used by the cart and wishlist).
function findListedProductsByIds(productIds) {
  return Product.find({ ...LISTED, _id: { $in: productIds } }).populate('shop', SHOP_FIELDS);
}

module.exports = { LISTED, listProducts, getProductBySlug, getShopBySlug, findListedProductsByIds };
