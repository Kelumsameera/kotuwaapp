const { z, translatedText, money, imageInput, objectId, pagination, emptyToUndefined } = require('./common');

const MAX_IMAGES = 8;
const MAX_VARIANTS = 50;

const optionText = emptyToUndefined(z.string().trim().max(40).optional());

// One variant. `_id` is sent when editing an existing variant.
// `stock` is only used for NEW variants; existing stock changes go through the stock route.
const variantInput = z
  .object({
    _id: objectId.optional(),
    sku: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/, 'SKU may use letters, numbers, . _ and - only.'),
    barcode: emptyToUndefined(z.string().trim().max(64).regex(/^[A-Za-z0-9-]+$/, 'Invalid barcode.').optional()),
    options: z.object({ size: optionText, color: optionText }).strict().optional(),
    price: money,
    compareAtPrice: money.optional(),
    costPrice: money.optional(),
    stock: z.number().int().min(0).max(1_000_000).optional(),
  })
  .strict();

const productFields = {
  category: objectId,
  name: translatedText({ max: 150 }),
  description: translatedText({ max: 5000, required: false }),
  images: z.array(imageInput).max(MAX_IMAGES, `At most ${MAX_IMAGES} images.`),
  weightGrams: z.number().int().min(0).max(100_000),
  variants: z.array(variantInput).min(1, 'Add at least one variant.').max(MAX_VARIANTS),
};

const createProductBody = z
  .object({
    ...productFields,
    description: productFields.description.optional(),
    images: productFields.images.default([]),
    weightGrams: productFields.weightGrams.default(0),
  })
  .strict();

// Every field is optional on update; only sent fields change.
const updateProductBody = z
  .object({
    category: productFields.category.optional(),
    name: productFields.name.optional(),
    description: productFields.description.optional(),
    images: productFields.images.optional(),
    weightGrams: productFields.weightGrams.optional(),
    variants: productFields.variants.optional(),
  })
  .strict();

const productIdParams = z.object({ id: objectId }).strict();
const variantParams = z.object({ id: objectId, variantId: objectId }).strict();

const adjustStockBody = z
  .object({
    change: z
      .number()
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((value) => value !== 0, 'Change cannot be 0.'),
    note: emptyToUndefined(z.string().trim().max(200).optional()),
  })
  .strict();

const visibilityBody = z.object({ isActive: z.boolean() }).strict();

const listProductsQuery = z
  .object({
    status: z.enum(['draft', 'pending', 'approved', 'rejected']).optional(),
    search: z.string().trim().max(100).optional(),
    ...pagination,
  })
  .strict();

// Admin: approve or reject a product. Rejecting needs a reason the seller will see.
const reviewProductBody = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(300).optional(),
  })
  .strict()
  .refine((body) => body.decision === 'approve' || (body.reason && body.reason.length >= 3), {
    message: 'Please give a reason.',
    path: ['reason'],
  });

module.exports = {
  createProductBody,
  updateProductBody,
  productIdParams,
  variantParams,
  adjustStockBody,
  visibilityBody,
  listProductsQuery,
  reviewProductBody,
};
