const adminUserService = require('../services/adminUserService');
const { serializeUser } = require('../utils/serialize');

// GET /api/admin/users
async function listUsers(req, res) {
  const { users, total, page, limit } = await adminUserService.listUsers(req.query);
  res.json({ users: users.map(serializeUser), total, page, limit });
}

// PATCH /api/admin/users/:id/role
async function changeRole(req, res) {
  const user = await adminUserService.changeUserRole(req, req.params.id, req.body.role);
  res.json({ user: serializeUser(user) });
}

// PATCH /api/admin/users/:id/status
async function changeStatus(req, res) {
  const user = await adminUserService.changeUserStatus(req, req.params.id, req.body.isActive);
  res.json({ user: serializeUser(user) });
}

// POST /api/admin/riders
async function createRider(req, res) {
  const rider = await adminUserService.createRider(req, req.body);
  res.status(201).json({ user: serializeUser(rider) });
}

module.exports = { listUsers, changeRole, changeStatus, createRider };
