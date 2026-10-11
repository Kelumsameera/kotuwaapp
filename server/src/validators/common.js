const { z } = require('zod');
const { LANGUAGES } = require('../constants/roles');

// Reusable building blocks for request validation.

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);

// Minimum 8 characters as required; maximum 72 because bcrypt ignores anything longer.
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.');

const personName = z.string().trim().min(2, 'Name is too short.').max(100);

// Sri Lankan phone numbers: 0771234567, 771234567 or +94771234567.
const phone = z
  .string()
  .trim()
  .regex(/^(?:\+94|0)?\d{9}$/, 'Enter a valid Sri Lankan phone number.');

const language = z.enum(LANGUAGES);

// A MongoDB id in a URL, e.g. /users/:id.
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.');

// A long random token from an email link.
const emailToken = z.string().regex(/^[a-f\d]{64}$/i, 'Invalid token.');

// ?page=1&limit=20 with sensible bounds.
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

// Turns "" into undefined so empty optional inputs are simply left out.
const emptyToUndefined = (schema) => z.preprocess((value) => (value === '' ? undefined : value), schema);

// Text in English (required) with optional Sinhala and Tamil, e.g. a product name.
function translatedText({ max = 200, required = true } = {}) {
  const optionalText = emptyToUndefined(z.string().trim().max(max).optional());
  const english = required ? z.string().trim().min(1, 'English text is required.').max(max) : optionalText;
  return z.object({ en: english, si: optionalText, ta: optionalText }).strict();
}

// Money in cents: a whole number, so Rs 1,250.50 is 125050.
const money = z.number().int('Money must be in cents (whole number).').min(0).max(10_000_000_000);

// An image previously uploaded through /api/seller/uploads.
const imageInput = z
  .object({
    url: z.string().url().max(500),
    publicId: z.string().min(1).max(300),
  })
  .strict();

module.exports = {
  z,
  email,
  password,
  personName,
  phone,
  language,
  objectId,
  emailToken,
  pagination,
  emptyToUndefined,
  translatedText,
  money,
  imageInput,
};
