const env = require('../config/env');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { AppError } = require('../utils/AppError');

const ROOT_FOLDER = 'kotuwa';

// The Cloudinary folder that holds one shop's images. Used to check image ownership.
function shopFolder(shopId) {
  return `${ROOT_FOLDER}/shops/${shopId}`;
}

// The folder for proof-of-delivery photos of one sub-order.
function proofFolder(subOrderId) {
  return `${ROOT_FOLDER}/proof/${subOrderId}`;
}

// Uploads an image (already checked by the upload middleware) into a folder.
// Returns { url, publicId }.
function uploadToFolder(folder, fileBuffer) {
  if (!isCloudinaryConfigured) {
    throw new AppError(503, 'UPLOADS_NOT_CONFIGURED', 'Image uploads are not set up yet.');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        // Cloudinary re-encodes the image, which also strips hidden data such as GPS location.
        transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(new AppError(502, 'UPLOAD_FAILED', 'Image upload failed. Please try again.'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(fileBuffer);
  });
}

// Uploads a product, logo or banner image into the shop's folder.
function uploadShopImage(shopId, fileBuffer) {
  return uploadToFolder(shopFolder(shopId), fileBuffer);
}

// Uploads a proof-of-delivery photo into the sub-order's folder.
function uploadProofImage(subOrderId, fileBuffer) {
  return uploadToFolder(proofFolder(subOrderId), fileBuffer);
}

// Deletes an image. Failures are only logged: a leftover image must never break a request.
async function deleteImage(publicId) {
  if (!isCloudinaryConfigured || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    console.error(`Could not delete image ${publicId}:`, error.message);
  }
}

// Returns true when an image really is in the given folder on our Cloudinary account.
function isImageInFolder(folderPath, image) {
  const folder = `${folderPath}/`;
  const urlPrefix = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
  return (
    typeof image?.publicId === 'string' &&
    typeof image?.url === 'string' &&
    image.publicId.startsWith(folder) &&
    !image.publicId.includes('..') &&
    image.url.startsWith(urlPrefix) &&
    image.url.includes(`/${image.publicId}.`)
  );
}

// True when an image belongs to this shop. Stops a seller from using someone else's image
// (or any outside URL) on their products.
function isShopImage(shopId, image) {
  return isImageInFolder(shopFolder(shopId), image);
}

// True when a photo was uploaded as proof for this sub-order.
function isProofImage(subOrderId, image) {
  return isImageInFolder(proofFolder(subOrderId), image);
}

module.exports = { uploadShopImage, uploadProofImage, deleteImage, isShopImage, isProofImage, shopFolder };
