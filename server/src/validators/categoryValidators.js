const { z, translatedText, objectId } = require('./common');

// Up to 2 decimal places, e.g. 7.5 %.
const commissionPercent = z
  .number()
  .min(0)
  .max(100)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Use at most 2 decimal places.');

const createCategoryBody = z
  .object({
    name: translatedText({ max: 80 }),
    parent: objectId.nullable().optional(),
    commissionPercent,
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();

const updateCategoryBody = z
  .object({
    name: translatedText({ max: 80 }).optional(),
    parent: objectId.nullable().optional(),
    commissionPercent: commissionPercent.optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();

const categoryIdParams = z.object({ id: objectId }).strict();

module.exports = { createCategoryBody, updateCategoryBody, categoryIdParams };
