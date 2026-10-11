const mongoose = require('mongoose');

// Small schema pieces shared by several models.

// Text in English (required) plus optional Sinhala and Tamil.
function translatedText({ required = true, maxlength = 200 } = {}) {
  return new mongoose.Schema(
    {
      en: { type: String, trim: true, required, maxlength },
      si: { type: String, trim: true, maxlength },
      ta: { type: String, trim: true, maxlength },
    },
    { _id: false }
  );
}

// An image stored on Cloudinary. publicId is needed to delete it later.
const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

module.exports = { translatedText, imageSchema };
