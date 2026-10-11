const shopService = require('../services/shopService');
const imageStorage = require('../services/imageStorage');
const { serializeShop } = require('../utils/serialize');

// POST /api/seller/shop
async function createShop(req, res) {
  const shop = await shopService.createShop(req.user, req.body);
  res.status(201).json({ shop: serializeShop(shop) });
}

// GET /api/seller/shop
async function getMyShop(req, res) {
  res.json({ shop: serializeShop(req.shop) });
}

// PATCH /api/seller/shop
async function updateMyShop(req, res) {
  const shop = await shopService.updateMyShop(req, req.shop, req.body);
  res.json({ shop: serializeShop(shop) });
}

// POST /api/seller/uploads/images (multipart, field "image")
async function uploadImage(req, res) {
  const image = await imageStorage.uploadShopImage(req.shop._id, req.file.buffer);
  res.status(201).json({ image });
}

module.exports = { createShop, getMyShop, updateMyShop, uploadImage };
