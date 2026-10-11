const { z, phone, translatedText, imageInput, emptyToUndefined, objectId, pagination, money } = require('./common');
const { DISTRICTS } = require('../constants/districts');

const districtKeys = DISTRICTS.map((district) => district.key);

const shopAddress = z
  .object({
    addressLine1: z.string().trim().min(3).max(200),
    city: z.string().trim().min(2).max(80),
    district: z.enum(districtKeys),
    postalCode: emptyToUndefined(z.string().trim().regex(/^\d{5}$/, 'Postal code has 5 digits.').optional()),
  })
  .strict();

const shopName = z.string().trim().min(2, 'Shop name is too short.').max(80);

const createShopBody = z
  .object({
    name: shopName,
    description: translatedText({ max: 2000, required: false }).optional(),
    phone,
    address: shopAddress,
  })
  .strict();

const updateShopBody = z
  .object({
    name: shopName.optional(),
    description: translatedText({ max: 2000, required: false }).optional(),
    phone: phone.optional(),
    address: shopAddress.optional(),
    // null removes the image.
    logo: imageInput.nullable().optional(),
    banner: imageInput.nullable().optional(),
    lowStockThreshold: z.number().int().min(0).max(10_000).optional(),
    // Cents. null = use the platform's free-shipping amount.
    freeShippingThreshold: money.nullable().optional(),
  })
  .strict();

// Admin: list shops.
const listShopsQuery = z
  .object({
    status: z.enum(['pending', 'approved', 'suspended', 'rejected']).optional(),
    search: z.string().trim().max(100).optional(),
    ...pagination,
  })
  .strict();

const shopIdParams = z.object({ id: objectId }).strict();

// Admin: approve, suspend or reject a shop. Suspending or rejecting needs a reason.
const changeShopStatusBody = z
  .object({
    status: z.enum(['approved', 'suspended', 'rejected']),
    reason: z.string().trim().max(300).optional(),
  })
  .strict()
  .refine((body) => body.status === 'approved' || (body.reason && body.reason.length >= 3), {
    message: 'Please give a reason.',
    path: ['reason'],
  });

module.exports = { createShopBody, updateShopBody, listShopsQuery, shopIdParams, changeShopStatusBody };
