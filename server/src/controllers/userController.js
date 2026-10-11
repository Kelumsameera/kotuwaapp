const userService = require('../services/userService');
const { serializeUser } = require('../utils/serialize');

// GET /api/users/me
async function getMe(req, res) {
  res.json({ user: serializeUser(req.user) });
}

// PATCH /api/users/me
async function updateMe(req, res) {
  const user = await userService.updateOwnProfile(req.user, req.body);
  res.json({ user: serializeUser(user) });
}

// PATCH /api/users/me/language
async function updateMyLanguage(req, res) {
  const user = await userService.updateOwnLanguage(req.user, req.body.language);
  res.json({ user: serializeUser(user) });
}

module.exports = { getMe, updateMe, updateMyLanguage };
