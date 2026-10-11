const { z, objectId, pagination, imageInput, emptyToUndefined } = require('./common');
const { ALL_ORDER_STATUSES } = require('../constants/orderStatus');

const optionalText = (max) => emptyToUndefined(z.string().trim().max(max).optional());
const subOrderNumber = z.string().regex(/^KT-\d{6}-\d{6}-\d{1,3}$/, 'Invalid order number.');

const subOrderParams = z.object({ subOrderNumber }).strict();

// Seller or admin changing a status. Extra fields are only used by the steps that need them.
const staffStatusBody = z
  .object({
    status: z.enum(ALL_ORDER_STATUSES),
    note: optionalText(300),
    method: z.enum(['self', 'courier']).optional(),
    courierName: optionalText(60),
    trackingNumber: emptyToUndefined(z.string().trim().max(60).regex(/^[A-Za-z0-9-]+$/, 'Invalid tracking number.').optional()),
    // Only https links, so a "Track with courier" link can never run a script.
    trackingUrl: emptyToUndefined(z.string().trim().url().max(300).startsWith('https://', 'Use an https:// link.').optional()),
    failReason: optionalText(200),
    cashCollected: z.boolean().optional(),
    photo: imageInput.optional(),
    signature: z.string().max(120_000).optional(),
  })
  .strict();

// Rider changing a status (no courier fields: riders don't choose how it ships).
const riderStatusBody = z
  .object({
    status: z.enum(['out_for_delivery', 'delivered', 'delivery_failed']),
    note: optionalText(300),
    failReason: optionalText(200),
    cashCollected: z.boolean().optional(),
    photo: imageInput.optional(),
    signature: z.string().max(120_000).optional(),
  })
  .strict();

// Customer: cancel, or ask to return.
const customerStatusBody = z
  .object({
    status: z.enum(['cancelled', 'return_requested']),
    note: optionalText(300),
  })
  .strict();

const assignRiderBody = z.object({ riderId: objectId.nullable() }).strict();

const riderListQuery = z.object({ scope: z.enum(['active', 'done']).default('active'), ...pagination }).strict();

const adminDeliveriesQuery = z
  .object({
    status: z.enum(ALL_ORDER_STATUSES).optional(),
    rider: objectId.optional(),
    delayed: z.enum(['true', 'false']).optional(),
    ...pagination,
  })
  .strict();

const reportQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).strict();

// Public tracking form.
const trackQuery = z
  .object({
    orderNumber: z.string().trim().toUpperCase().regex(/^KT-\d{6}-\d{6}$/, 'Invalid order number.'),
    phone: z.string().trim().min(9).max(20),
  })
  .strict();

module.exports = {
  subOrderParams,
  staffStatusBody,
  riderStatusBody,
  customerStatusBody,
  assignRiderBody,
  riderListQuery,
  adminDeliveriesQuery,
  reportQuery,
  trackQuery,
};
