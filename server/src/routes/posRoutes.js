const express = require('express');
const posController = require('../controllers/posController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const validate = require('../middleware/validate');
const { loadMyShop, requireShopStatus } = require('../middleware/loadMyShop');
const asyncHandler = require('../utils/asyncHandler');
const { rolesWith } = require('../constants/permissions');
const v = require('../validators/posValidators');

const router = express.Router();

// Every POS route: logged in as the shop owner or one of its cashiers, working on THEIR shop only.
// A suspended shop can't use the POS.
router.use(authenticate, authorizeRoles(...rolesWith('pos:use')), loadMyShop, requireShopStatus('pending', 'approved', 'rejected'));

const ownerReports = authorizeRoles(...rolesWith('pos:reports'));
const ownerVoid = authorizeRoles(...rolesWith('pos:void'));
const saleId = { params: v.saleIdParams };

router.get('/session', asyncHandler(posController.session));
router.get('/lookup', validate({ query: v.lookupQuery }), asyncHandler(posController.lookup));
router.get('/search', validate({ query: v.searchQuery }), asyncHandler(posController.search));

router.post('/sales', validate({ body: v.completeSaleBody }), asyncHandler(posController.completeSale));
router.get('/sales', ownerReports, validate({ query: v.salesQuery }), asyncHandler(posController.listSales));
router.get('/sales/:id', validate(saleId), asyncHandler(posController.getSale));
router.post('/sales/:id/void', ownerVoid, validate({ ...saleId, body: v.voidBody }), asyncHandler(posController.voidSale));

router.get('/held', asyncHandler(posController.listHeld));
router.post('/held', validate({ body: v.holdBillBody }), asyncHandler(posController.holdBill));
router.delete('/held/:id', validate(saleId), asyncHandler(posController.deleteHeld));

router.get('/reports/my-day', validate({ query: v.dayQuery }), asyncHandler(posController.myDay));
router.get('/reports/daily', ownerReports, validate({ query: v.dayQuery }), asyncHandler(posController.dailyReport));
router.get('/reports/cashiers', ownerReports, validate({ query: v.rangeQuery }), asyncHandler(posController.cashierReport));

module.exports = router;
