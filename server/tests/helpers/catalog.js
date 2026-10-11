const Shop = require('../../src/models/Shop');
const Category = require('../../src/models/Category');
const Product = require('../../src/models/Product');
const { createLoggedInUser } = require('./auth');

// Valid shop form data.
function shopBody(overrides = {}) {
  return {
    name: 'Lanka Batik House',
    phone: '0771234567',
    address: { addressLine1: '12 Temple Road', city: 'Kandy', district: 'kandy', postalCode: '20000' },
    ...overrides,
  };
}

// Creates a shop directly in the database for a seller.
function createShopFor(seller, status = 'approved') {
  return Shop.create({
    owner: seller._id,
    name: `Shop of ${seller.name}`,
    slug: `shop-${seller._id}`,
    status,
  });
}

// Creates a logged-in seller who already has a shop with the given status.
async function createSellerWithShop(app, status = 'approved') {
  const { user, agent } = await createLoggedInUser(app, 'seller');
  const shop = await createShopFor(user, status);
  return { user, agent, shop };
}

// Creates an active category.
function createCategory(overrides = {}) {
  return Category.create({
    name: { en: 'Clothing' },
    slug: `clothing-${Math.random().toString(36).slice(2, 8)}`,
    commissionPercent: 10,
    ...overrides,
  });
}

// An image that looks exactly like one this shop uploaded to Cloudinary.
function shopImage(shopId, name = 'photo1') {
  const publicId = `kotuwa/shops/${shopId}/${name}`;
  return { url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${publicId}.jpg`, publicId };
}

// Valid product form data. Prices are in cents.
function productBody(categoryId, shopId, overrides = {}) {
  return {
    category: String(categoryId),
    name: { en: 'Handloom Saree', si: 'අත්යන්ත්‍ර සාරිය' },
    description: { en: 'Pure cotton.' },
    images: [shopImage(shopId)],
    weightGrams: 500,
    variants: [
      { sku: 'SAREE-RED', barcode: '4790001', options: { color: 'Red' }, price: 450000, costPrice: 300000, stock: 10 },
      { sku: 'SAREE-BLUE', options: { color: 'Blue' }, price: 450000, costPrice: 300000, stock: 5 },
    ],
    ...overrides,
  };
}

// Creates a product straight in the database, listed in the store unless overrides say otherwise.
let skuCounter = 0;
function createListedProduct(shop, category, overrides = {}) {
  skuCounter += 1;
  return Product.create({
    shop: shop._id,
    category: category._id,
    name: { en: `Product ${skuCounter}` },
    slug: `product-${skuCounter}-${Math.random().toString(36).slice(2, 8)}`,
    images: [shopImage(shop._id, `p${skuCounter}`)],
    status: 'approved',
    shopIsApproved: shop.status === 'approved',
    variants: [{ sku: `SKU-${skuCounter}`, price: 100000, costPrice: 60000, stock: 5 }],
    ...overrides,
  });
}

module.exports = {
  shopBody,
  createShopFor,
  createSellerWithShop,
  createCategory,
  shopImage,
  productBody,
  createListedProduct,
};
