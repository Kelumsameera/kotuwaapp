const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { rolesWith } = require('../constants/permissions');
const addressController = require('../controllers/addressController');
const v = require('../validators/userValidators');
const orderRules = require('../validators/orderValidators');

const router = express.Router();

// Every route here works on the logged-in user's OWN account only.
router.use(authenticate, authorizeRoles(...rolesWith('profile:manage')));

router.get('/me', asyncHandler(userController.getMe));
router.patch('/me', validate({ body: v.updateProfileBody }), asyncHandler(userController.updateMe));
router.patch('/me/language', validate({ body: v.updateLanguageBody }), asyncHandler(userController.updateMyLanguage));

// Address book (used at checkout).
const addressId = { params: orderRules.addressIdParams };
router.get('/me/addresses', asyncHandler(addressController.listAddresses));
router.post('/me/addresses', validate({ body: orderRules.addAddressBody }), asyncHandler(addressController.addAddress));
router.patch(
  '/me/addresses/:addressId',
  validate({ ...addressId, body: orderRules.updateAddressBody }),
  asyncHandler(addressController.updateAddress)
);
router.delete('/me/addresses/:addressId', validate(addressId), asyncHandler(addressController.deleteAddress));

module.exports = router;
