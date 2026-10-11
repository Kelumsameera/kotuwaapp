const { z, phone, objectId, pagination, money, emptyToUndefined } = require('./common');
const { DISTRICTS } = require('../constants/districts');
const { PAYMENT_METHODS, ALL_ORDER_STATUSES } = require('../constants/orderStatus');

const districtKeys = DISTRICTS.map((district) => district.key);
const optionalText = (max) => emptyToUndefined(z.string().trim().max(max).optional());

// A Sri Lanka delivery address. The province is filled in by the server from the district.
const addressFields = {
  fullName: z.string().trim().min(2).max(100),
  phone,
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: optionalText(200),
  city: z.string().trim().min(2).max(80),
  district: z.enum(districtKeys),
  postalCode: emptyToUndefined(z.string().trim().regex(/^\d{5}$/, 'Postal code has 5 digits.').optional()),
  isDefault: z.boolean().optional(),
};

const addAddressBody = z.object(addressFields).strict();

const updateAddressBody = z
  .object(Object.fromEntries(Object.entries(addressFields).map(([key, schema]) => [key, schema.optional()])))
  .strict();

const addressIdParams = z.object({ addressId: objectId }).strict();

const checkoutPreviewBody = z.object({ addressId: objectId }).strict();

const placeOrderBody = z
  .object({
    addressId: objectId,
    paymentMethod: z.enum(PAYMENT_METHODS),
    // The total the customer saw and agreed to (cents). If it changed, the order is refused.
    expectedTotal: money,
    // A random id made by the browser once per checkout, so a double click can't order twice.
    idempotencyKey: z.string().uuid(),
    note: optionalText(300),
  })
  .strict();

const orderNumberParams = z.object({ orderNumber: z.string().regex(/^KT-\d{6}-\d{6}$/, 'Invalid order number.') }).strict();

const subOrderNumberParams = z
  .object({ subOrderNumber: z.string().regex(/^KT-\d{6}-\d{6}-\d{1,3}$/, 'Invalid order number.') })
  .strict();

const listOrdersQuery = z.object({ ...pagination }).strict();

const sellerOrdersQuery = z
  .object({
    status: z.enum(ALL_ORDER_STATUSES).optional(),
    search: optionalText(40),
    ...pagination,
  })
  .strict();

const adminOrdersQuery = z.object({ search: optionalText(40), ...pagination }).strict();

// Admin platform settings. Every field optional; only sent ones change.
const settingsBody = z
  .object({
    freeShippingThreshold: money.nullable().optional(),
    returnPeriodDays: z.number().int().min(0).max(60).optional(),
    deliveryMethods: z.object({ selfDelivery: z.boolean(), courier: z.boolean() }).strict().optional(),
  })
  .strict();

// A full list of shipping rates (admin's or a shop's). district null = default for all others.
const shippingRatesBody = z
  .object({
    rates: z
      .array(
        z
          .object({
            district: z.enum(districtKeys).nullable(),
            baseFee: money,
            extraPerKg: money,
          })
          .strict()
      )
      .max(30)
      .refine(
        (rates) => new Set(rates.map((rate) => rate.district)).size === rates.length,
        'Each district can only have one rate.'
      ),
  })
  .strict();

module.exports = {
  addAddressBody,
  updateAddressBody,
  addressIdParams,
  checkoutPreviewBody,
  placeOrderBody,
  orderNumberParams,
  subOrderNumberParams,
  listOrdersQuery,
  sellerOrdersQuery,
  adminOrdersQuery,
  settingsBody,
  shippingRatesBody,
};
