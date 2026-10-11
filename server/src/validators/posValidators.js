const { z, objectId, money, pagination, emptyToUndefined } = require('./common');

// The screen sends only ids, quantities and discounts (cents). Prices come from the database.
const billLine = z
  .object({
    productId: objectId,
    variantId: objectId,
    quantity: z.number().int().min(1).max(999),
    itemDiscount: money.default(0),
  })
  .strict();

const billLines = z.array(billLine).min(1, 'The bill is empty.').max(200);

const completeSaleBody = z
  .object({
    items: billLines,
    billDiscount: money.default(0),
    // The total on the cashier's screen; if a price changed meanwhile, the sale is refused.
    expectedTotal: money,
    payment: z.discriminatedUnion('method', [
      z.object({ method: z.literal('cash'), cashReceived: money.optional() }).strict(),
      z.object({ method: z.literal('card'), cardReference: emptyToUndefined(z.string().trim().max(60).optional()) }).strict(),
    ]),
    heldSaleId: objectId.optional(),
  })
  .strict();

const holdBillBody = z
  .object({
    items: billLines,
    billDiscount: money.default(0),
    label: emptyToUndefined(z.string().trim().max(60).optional()),
  })
  .strict();

const lookupQuery = z.object({ code: z.string().trim().min(1).max(64) }).strict();

const searchQuery = z.object({ q: z.string().trim().min(1).max(100) }).strict();

const saleIdParams = z.object({ id: objectId }).strict();

const voidBody = z.object({ reason: z.string().trim().min(3, 'Please give a reason.').max(300) }).strict();

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');

const dayQuery = z.object({ date: dateText.optional() }).strict();

const rangeQuery = z
  .object({ from: dateText, to: dateText })
  .strict()
  .refine((range) => range.from <= range.to, { message: '"from" must be before "to".', path: ['to'] });

const salesQuery = z.object({ date: dateText.optional(), cashier: objectId.optional(), ...pagination }).strict();

module.exports = { completeSaleBody, holdBillBody, lookupQuery, searchQuery, saleIdParams, voidBody, dayQuery, rangeQuery, salesQuery };
