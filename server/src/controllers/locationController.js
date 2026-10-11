const locationService = require('../services/locationService');

// GET /api/locations/districts (public, used by address dropdowns)
async function listDistricts(req, res) {
  const districts = await locationService.listDistricts();
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ districts });
}

module.exports = { listDistricts };
