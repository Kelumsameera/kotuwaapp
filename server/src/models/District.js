const mongoose = require('mongoose');

const translatedText = {
  en: { type: String, required: true },
  si: { type: String },
  ta: { type: String },
};

// A Sri Lanka district with its province and main cities (filled by the seed script).
const districtSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: translatedText,
  province: {
    key: { type: String, required: true },
    name: translatedText,
  },
  cities: [
    {
      _id: false,
      name: translatedText,
      postalCode: { type: String },
    },
  ],
});

module.exports = mongoose.model('District', districtSchema);
