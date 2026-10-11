const express = require('express');
const locationController = require('../controllers/locationController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Public: anyone can read the district/city list (needed before login on the tracking page).
router.get('/districts', asyncHandler(locationController.listDistricts));

module.exports = router;
