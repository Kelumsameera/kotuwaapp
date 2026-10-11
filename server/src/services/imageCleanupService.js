const Product = require('../models/Product');
const Shop = require('../models/Shop');
const imageStorage = require('./imageStorage');

// Deletes images from Cloudinary only if nothing in the shop still uses them.
// A seller may put the same photo on several products (or as logo), so removing it
// from one place must not break the others. Archived products count as "using" an image,
// because old orders still show them.
async function deleteImagesNoLongerUsed(shopId, publicIds) {
  for (const publicId of new Set(publicIds)) {
    const [usedByProduct, usedByShop] = await Promise.all([
      Product.exists({ shop: shopId, 'images.publicId': publicId }),
      Shop.exists({ _id: shopId, $or: [{ 'logo.publicId': publicId }, { 'banner.publicId': publicId }] }),
    ]);
    if (!usedByProduct && !usedByShop) await imageStorage.deleteImage(publicId);
  }
}

module.exports = { deleteImagesNoLongerUsed };
