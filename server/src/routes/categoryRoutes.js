const express = require('express');
const categoryController = require('../controllers/categoryController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Public: the active category list (storefront menus, seller product form).
router.get('/', asyncHandler(categoryController.listActive));

module.exports = router;
