const express = require('express');
const deliveryController = require('../controllers/deliveryController');
const validate = require('../middleware/validate');
const { trackingLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('../utils/asyncHandler');
const v = require('../validators/deliveryValidators');

const router = express.Router();

// Public: anyone with the order number AND the delivery phone number can see the timeline.
// Strictly rate limited so order numbers and phones can't be guessed.
router.get('/', trackingLimiter, validate({ query: v.trackQuery }), asyncHandler(deliveryController.publicTrack));

module.exports = router;
