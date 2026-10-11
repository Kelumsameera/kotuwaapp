const express = require('express');

const router = express.Router();

// Health check for uptime monitors.
router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/admin', require('./adminRoutes'));
router.use('/locations', require('./locationRoutes'));
router.use('/categories', require('./categoryRoutes'));
router.use('/seller', require('./sellerRoutes'));

const { catalogRouter, cartRouter, wishlistRouter } = require('./storeRoutes');
router.use('/catalog', catalogRouter);
router.use('/cart', cartRouter);
router.use('/wishlist', wishlistRouter);

const { checkoutRouter, ordersRouter } = require('./orderRoutes');
router.use('/checkout', checkoutRouter);
router.use('/orders', ordersRouter);
router.use('/rider', require('./riderRoutes'));
router.use('/pos', require('./posRoutes'));
router.use('/track', require('./trackRoutes'));

// Public: courier names for dropdowns.
router.get('/couriers', require('../utils/asyncHandler')(require('../controllers/deliveryController').listCouriers));

module.exports = router;
