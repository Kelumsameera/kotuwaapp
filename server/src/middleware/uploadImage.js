const multer = require('multer');
const { AppError, badRequest } = require('../utils/AppError');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Keeps the file in memory (never written to disk) and limits it to one small file.
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 5 },
});

// Checks the first bytes of the file. The browser-sent type can be faked; the bytes can't.
function looksLikeImage(buffer, mimeType) {
  if (!buffer || buffer.length < 12) return false;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

  if (mimeType === 'image/jpeg') return isJpeg;
  if (mimeType === 'image/png') return isPng;
  if (mimeType === 'image/webp') return isWebp;
  return false;
}

// Reads one image from the "image" form field and checks its size, type and content.
// The checked file is left on req.file for the controller.
function uploadImage(req, res, next) {
  memoryUpload.single('image')(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'FILE_TOO_LARGE', 'Images must be 2 MB or smaller.'));
      }
      return next(badRequest('UPLOAD_INVALID', 'Upload one image in the "image" field.'));
    }

    if (!req.file) return next(badRequest('UPLOAD_MISSING', 'Choose an image to upload.'));

    if (!ALLOWED_TYPES.includes(req.file.mimetype) || !looksLikeImage(req.file.buffer, req.file.mimetype)) {
      return next(badRequest('UPLOAD_NOT_IMAGE', 'Only JPG, PNG or WebP images are allowed.'));
    }

    next();
  });
}

module.exports = uploadImage;
