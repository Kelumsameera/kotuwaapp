const { z, objectId, pagination, emptyToUndefined } = require('./common');

const slug = z.string().trim().max(100).regex(/^[a-z0-9-]+$/, 'Invalid link.');
const priceFilter = emptyToUndefined(z.coerce.number().int().min(0).max(10_000_000_000).optional());

// GET /api/catalog/products — prices in cents.
const listProductsQuery = z
  .object({
    search: emptyToUndefined(z.string().trim().max(100).optional()),
    category: emptyToUndefined(slug.optional()),
    shop: emptyToUndefined(slug.optional()),
    minPrice: priceFilter,
    maxPrice: priceFilter,
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating']).default('newest'),
    page: pagination.page,
    limit: z.coerce.number().int().min(1).max(48).default(24),
  })
  .strict();

const slugParams = z.object({ slug }).strict();

const quantity = z.number().int().min(1).max(99);

const cartItem = z.object({ productId: objectId, variantId: objectId, quantity }).strict();

const addToCartBody = cartItem;

const setQuantityBody = z.object({ quantity }).strict();

const variantIdParams = z.object({ variantId: objectId }).strict();

// A guest's browser cart sent at login, or for a preview.
const guestItemsBody = z.object({ items: z.array(cartItem).max(50) }).strict();

const productIdParams = z.object({ productId: objectId }).strict();

module.exports = {
  listProductsQuery,
  slugParams,
  addToCartBody,
  setQuantityBody,
  variantIdParams,
  guestItemsBody,
  productIdParams,
};
