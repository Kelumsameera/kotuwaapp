const express = require('express');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { rolesWith } = require('../constants/permissions');
const { loginLimiter, emailActionLimiter, refreshLimiter } = require('../middleware/rateLimiters');
const v = require('../validators/authValidators');

const router = express.Router();

// Public routes (no login needed).
router.post('/register', emailActionLimiter, validate({ body: v.registerBody }), asyncHandler(authController.register));
router.post('/verify-email', emailActionLimiter, validate({ body: v.verifyEmailBody }), asyncHandler(authController.verifyEmail));
router.post('/resend-verification', emailActionLimiter, validate({ body: v.emailOnlyBody }), asyncHandler(authController.resendVerification));
router.post('/login', loginLimiter, validate({ body: v.loginBody }), asyncHandler(authController.login));
router.post('/refresh', refreshLimiter, asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));
router.post('/forgot-password', emailActionLimiter, validate({ body: v.emailOnlyBody }), asyncHandler(authController.forgotPassword));
router.post('/reset-password', emailActionLimiter, validate({ body: v.resetPasswordBody }), asyncHandler(authController.resetPassword));

// Logged-in routes.
router.post(
  '/change-password',
  authenticate,
  authorizeRoles(...rolesWith('profile:manage')),
  validate({ body: v.changePasswordBody }),
  asyncHandler(authController.changePassword)
);

module.exports = router;
