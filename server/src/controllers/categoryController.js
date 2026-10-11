const categoryService = require('../services/categoryService');
const { serializeCategory } = require('../utils/serialize');

// GET /api/categories (public)
async function listActive(req, res) {
  const categories = await categoryService.listActiveCategories();
  res.json({ categories: categories.map(serializeCategory) });
}

// GET /api/admin/categories
async function listAll(req, res) {
  const categories = await categoryService.listAllCategories();
  res.json({ categories: categories.map(serializeCategory) });
}

// POST /api/admin/categories
async function create(req, res) {
  const category = await categoryService.createCategory(req, req.body);
  res.status(201).json({ category: serializeCategory(category) });
}

// PATCH /api/admin/categories/:id
async function update(req, res) {
  const category = await categoryService.updateCategory(req, req.params.id, req.body);
  res.json({ category: serializeCategory(category) });
}

// DELETE /api/admin/categories/:id
async function remove(req, res) {
  await categoryService.deleteCategory(req, req.params.id);
  res.status(204).end();
}

module.exports = { listActive, listAll, create, update, remove };
