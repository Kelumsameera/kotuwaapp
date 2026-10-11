const District = require('../models/District');

// Returns all districts with their province and cities, sorted by English name.
function listDistricts() {
  return District.find({}, { _id: 0, __v: 0 }).sort({ 'name.en': 1 }).lean();
}

module.exports = { listDistricts };
