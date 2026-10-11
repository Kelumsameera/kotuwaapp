const express = require('express');
const deliveryController = require('../controllers/deliveryController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const validate = require('../middleware/validate');
const uploadImage = require('../middleware/uploadImage');
const { uploadLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('../utils/asyncHandler');
const { rolesWith } = require('../constants/permissions');
const v = require('../validators/deliveryValidators');

const router = express.Router();

// Riders only, and every query is limited to deliveries assigned to the logged-in rider.
router.use(authenticate);
const canView = authorizeRoles(...rolesWith('deliveries:viewAssigned'));
const canUpdate = authorizeRoles(...rolesWith('deliveries:update'));
const subOrder = { params: v.subOrderParams };

router.get('/deliveries', canView, validate({ query: v.riderListQuery }), asyncHandler(deliveryController.riderList));
router.get('/deliveries/:subOrderNumber', canView, validate(subOrder), asyncHandler(deliveryController.riderGet));
router.patch(
  '/deliveries/:subOrderNumber/status',
  canUpdate,
  validate({ ...subOrder, body: v.riderStatusBody }),
  asyncHandler(deliveryController.riderChangeStatus)
);
router.post(
  '/deliveries/:subOrderNumber/photo',
  canUpdate,
  uploadLimiter,
  validate(subOrder),
  uploadImage,
  asyncHandler(deliveryController.riderUploadPhoto)
);
router.post('/deliveries/:subOrderNumber/cash-collected', canUpdate, validate(subOrder), asyncHandler(deliveryController.riderMarkCashCollected));

module.exports = router;
