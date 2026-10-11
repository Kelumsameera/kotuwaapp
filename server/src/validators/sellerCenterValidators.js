const { z, email, password, personName, phone, objectId, pagination, emptyToUndefined } = require('./common');

const createCashierBody = z.object({ name: personName, email, phone, password }).strict();

const staffIdParams = z.object({ id: objectId }).strict();

const staffStatusBody = z.object({ isActive: z.boolean() }).strict();

const staffPasswordBody = z.object({ password }).strict();

const earningsQuery = z
  .object({
    status: z.enum(['pending', 'available', 'paid', 'reversed']).optional(),
    ...pagination,
  })
  .strict();

const payoutsQuery = z.object({ ...pagination }).strict();

// Admin: list payouts.
const adminPayoutsQuery = z
  .object({
    status: z.enum(['requested', 'approved', 'rejected', 'paid']).optional(),
    ...pagination,
  })
  .strict();

const payoutIdParams = z.object({ id: objectId }).strict();

// Admin: approve / reject (reason required) / mark paid (bank reference required).
const reviewPayoutBody = z
  .object({
    action: z.enum(['approve', 'reject', 'mark_paid']),
    note: emptyToUndefined(z.string().trim().max(300).optional()),
    reference: emptyToUndefined(z.string().trim().max(100).optional()),
  })
  .strict();

// Bank details for payouts (part of the shop settings).
const bankDetails = z
  .object({
    bankName: z.string().trim().min(2).max(60),
    branch: emptyToUndefined(z.string().trim().max(60).optional()),
    accountName: z.string().trim().min(2).max(100),
    accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Account number has 6–20 digits.'),
  })
  .strict();

module.exports = {
  createCashierBody,
  staffIdParams,
  staffStatusBody,
  staffPasswordBody,
  earningsQuery,
  payoutsQuery,
  adminPayoutsQuery,
  payoutIdParams,
  reviewPayoutBody,
  bankDetails,
};
