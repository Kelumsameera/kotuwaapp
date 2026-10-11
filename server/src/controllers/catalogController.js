const catalogService = require('../services/catalogService');
const cartService = require('../services/cartService');
const { serializePublicProduct, serializePublicShop } = require('../utils/serialize');

// GET /api/catalog/products
async function listProducts(req, res) {
  const { products, total, page, limit } = await catalogService.listProducts(req.query);
  res.json({
    products: products.map((product) => serializePublicProduct(product, { withDescription: false })),
    total,
    page,
    limit,
  });
}

// GET /api/catalog/products/:slug
async function getProduct(req, res) {
  const product = await catalogService.getProductBySlug(req.params.slug);
  res.json({ product: serializePublicProduct(product) });
}

// GET /api/catalog/shops/:slug
async function getShop(req, res) {
  const shop = await catalogService.getShopBySlug(req.params.slug);
  res.json({ shop: serializePublicShop(shop) });
}

// POST /api/catalog/cart-preview — shows a guest's browser cart with fresh prices.
async function previewCart(req, res) {
  const cart = await cartService.previewGuestCart(req.body.items);
  res.json({ cart });
}

module.exports = { listProducts, getProduct, getShop, previewCart };
