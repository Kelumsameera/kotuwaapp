const Category = require('../models/Category');
const Product = require('../models/Product');
const { uniqueSlug } = require('../utils/slug');
const { logAudit } = require('./auditService');
const { badRequest, conflict, notFound } = require('../utils/AppError');

// Public: active categories in display order.
function listActiveCategories() {
  return Category.find({ isActive: true }).sort({ sortOrder: 1, 'name.en': 1 });
}

// Admin: every category, including hidden ones.
function listAllCategories() {
  return Category.find().sort({ sortOrder: 1, 'name.en': 1 });
}

// Checks a parent category. We keep two levels only (e.g. Fashion → Sarees), so
// the parent must itself be a top-level category, and a category can't be its own parent.
async function checkParent(parentId, categoryId) {
  if (!parentId) return;
  if (categoryId && String(parentId) === String(categoryId)) {
    throw badRequest('INVALID_PARENT', 'A category cannot be its own parent.');
  }

  const parent = await Category.findById(parentId);
  if (!parent) throw badRequest('INVALID_PARENT', 'Parent category not found.');
  if (parent.parent) throw badRequest('INVALID_PARENT', 'Only two category levels are allowed.');

  if (categoryId && (await Category.exists({ parent: categoryId }))) {
    throw badRequest('INVALID_PARENT', 'A category with sub-categories cannot be moved under another.');
  }
}

// Admin: creates a category.
async function createCategory(req, data) {
  await checkParent(data.parent);
  const category = await Category.create({ ...data, slug: uniqueSlug(data.name.en, 'category') });

  await logAudit(req, {
    action: 'category.create',
    targetModel: 'Category',
    targetId: category._id,
    after: { name: data.name.en, commissionPercent: category.commissionPercent },
  });
  return category;
}

// Admin: updates a category. Commission changes are written to the audit log.
async function updateCategory(req, categoryId, changes) {
  const category = await Category.findById(categoryId);
  if (!category) throw notFound('CATEGORY_NOT_FOUND', 'Category not found.');

  if (changes.parent !== undefined) await checkParent(changes.parent, categoryId);

  const oldCommission = category.commissionPercent;
  Object.assign(category, changes);
  await category.save();

  if (changes.commissionPercent !== undefined && changes.commissionPercent !== oldCommission) {
    await logAudit(req, {
      action: 'category.commission_change',
      targetModel: 'Category',
      targetId: category._id,
      before: { commissionPercent: oldCommission },
      after: { commissionPercent: category.commissionPercent },
    });
  }
  return category;
}

// Admin: deletes a category only if nothing uses it. Otherwise hide it with isActive=false.
async function deleteCategory(req, categoryId) {
  const category = await Category.findById(categoryId);
  if (!category) throw notFound('CATEGORY_NOT_FOUND', 'Category not found.');

  const [hasChildren, hasProducts] = await Promise.all([
    Category.exists({ parent: categoryId }),
    Product.exists({ category: categoryId }),
  ]);
  if (hasChildren || hasProducts) {
    throw conflict('CATEGORY_IN_USE', 'This category is in use. Hide it instead of deleting it.');
  }

  await category.deleteOne();
  await logAudit(req, {
    action: 'category.delete',
    targetModel: 'Category',
    targetId: category._id,
    before: { name: category.name.en },
  });
}

// Returns the category if it exists and is active (products can only use active ones).
async function findActiveCategory(categoryId) {
  const category = await Category.findOne({ _id: categoryId, isActive: true });
  if (!category) throw badRequest('INVALID_CATEGORY', 'Choose an active category.');
  return category;
}

module.exports = {
  listActiveCategories,
  listAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  findActiveCategory,
};
