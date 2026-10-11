const productService = require('../services/productService');
const stockService = require('../services/stockService');
const { serializeProduct } = require('../utils/serialize');
const { roleCan } = require('../constants/permissions');

// The shop owner sees cost prices; nobody else on these routes does.
function serializeForViewer(req, product) {
  return serializeProduct(product, { includeCost: roleCan(req.user.role, 'products:viewCost') });
}

// GET /api/seller/products
async function listProducts(req, res) {
  const { products, total, page, limit } = await productService.listMyProducts(req.shop, req.query);
  res.json({ products: products.map((product) => serializeForViewer(req, product)), total, page, limit });
}

// GET /api/seller/products/:id
async function getProduct(req, res) {
  const product = await productService.findMyProduct(req.shop, req.params.id);
  res.json({ product: serializeForViewer(req, product) });
}

// POST /api/seller/products
async function createProduct(req, res) {
  const product = await productService.createProduct(req.user, req.shop, req.body);
  res.status(201).json({ product: serializeForViewer(req, product) });
}

// PATCH /api/seller/products/:id
async function updateProduct(req, res) {
  const product = await productService.updateProduct(req, req.shop, req.params.id, req.body);
  res.json({ product: serializeForViewer(req, product) });
}

// POST /api/seller/products/:id/submit
async function submitProduct(req, res) {
  const product = await productService.submitForReview(req.shop, req.params.id);
  res.json({ product: serializeForViewer(req, product) });
}

// PATCH /api/seller/products/:id/visibility
async function setVisibility(req, res) {
  const product = await productService.setVisibility(req.shop, req.params.id, req.body.isActive);
  res.json({ product: serializeForViewer(req, product) });
}

// DELETE /api/seller/products/:id
async function archiveProduct(req, res) {
  await productService.archiveProduct(req.shop, req.params.id);
  res.status(204).end();
}

// POST /api/seller/products/:id/variants/:variantId/stock
async function adjustStock(req, res) {
  const result = await stockService.adjustStockManually({
    shop: req.shop,
    productId: req.params.id,
    variantId: req.params.variantId,
    change: req.body.change,
    note: req.body.note,
    by: req.user._id,
  });
  res.json(result);
}

// GET /api/seller/products/:id/stock-history
async function stockHistory(req, res) {
  await productService.findMyProduct(req.shop, req.params.id);
  const movements = await stockService.listMovements(req.shop._id, req.params.id);
  res.json({
    movements: movements.map((movement) => ({
      id: String(movement._id),
      variantId: String(movement.variantId),
      change: movement.change,
      stockAfter: movement.stockAfter,
      reason: movement.reason,
      note: movement.note || '',
      createdAt: movement.createdAt,
    })),
  });
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  submitProduct,
  setVisibility,
  archiveProduct,
  adjustStock,
  stockHistory,
};
