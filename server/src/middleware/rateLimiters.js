const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Builds a limiter that answers with our normal JSON error shape. Turned off in tests.
function createLimiter({ windowMs, max, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please try again later.' } },
  });
}

// For the whole API.
const globalLimiter = createLimiter({ windowMs: FIFTEEN_MINUTES, max: 600 });

// For login: counted per IP + email, so one attacker can't hammer one account.
const loginLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
});

// For register, forgot-password, resend-verification and other email-sending routes.
const emailActionLimiter = createLimiter({ windowMs: FIFTEEN_MINUTES, max: 5 });

// For refresh: browsers refresh about every 15 minutes, so this is generous.
const refreshLimiter = createLimiter({ windowMs: FIFTEEN_MINUTES, max: 60 });

// For image uploads: counted per logged-in user, so one seller can't fill our image storage.
const uploadLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 60,
  keyGenerator: (req) => `upload:${req.user?._id || req.ip}`,
});

// For placing orders: stops scripts from flooding sellers with fake COD orders.
const checkoutLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => `checkout:${req.user?._id || req.ip}`,
});

module.exports = { globalLimiter, loginLimiter, emailActionLimiter, refreshLimiter, uploadLimiter, checkoutLimiter };
