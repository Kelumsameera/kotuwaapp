const shopService = require('../services/shopService');
const productService = require('../services/productService');
const { serializeShop, serializeProduct } = require('../utils/serialize');

// GET /api/admin/shops
async function listShops(req, res) {
  const { shops, total, page, limit } = await shopService.listShops(req.query);
  res.json({ shops: shops.map(serializeShop), total, page, limit });
}

// PATCH /api/admin/shops/:id/status
async function changeShopStatus(req, res) {
  const shop = await shopService.changeShopStatus(req, req.params.id, req.body);
  res.json({ shop: serializeShop(shop) });
}

// GET /api/admin/products
async function listProducts(req, res) {
  const { products, total, page, limit } = await productService.listProductsForAdmin(req.query);
  res.json({
    products: products.map((product) => ({
      ...serializeProduct(product, { includeCost: false }),
      shopName: product.shop?.name || '',
    })),
    total,
    page,
    limit,
  });
}

// PATCH /api/admin/products/:id/review
async function reviewProduct(req, res) {
  const product = await productService.reviewProduct(req, req.params.id, req.body);
  res.json({ product: serializeProduct(product) });
}

module.exports = { listShops, changeShopStatus, listProducts, reviewProduct };
