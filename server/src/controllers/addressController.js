const addressService = require('../services/addressService');
const { serializeAddress } = require('../utils/serializeOrder');

// All these routes work only on the logged-in user's OWN address book (req.user).

// GET /api/users/me/addresses
async function listAddresses(req, res) {
  res.json({ addresses: req.user.addresses.map(serializeAddress) });
}

// POST /api/users/me/addresses
async function addAddress(req, res) {
  const addresses = await addressService.addAddress(req.user, req.body);
  res.status(201).json({ addresses: addresses.map(serializeAddress) });
}

// PATCH /api/users/me/addresses/:addressId
async function updateAddress(req, res) {
  const addresses = await addressService.updateAddress(req.user, req.params.addressId, req.body);
  res.json({ addresses: addresses.map(serializeAddress) });
}

// DELETE /api/users/me/addresses/:addressId
async function deleteAddress(req, res) {
  const addresses = await addressService.deleteAddress(req.user, req.params.addressId);
  res.json({ addresses: addresses.map(serializeAddress) });
}

module.exports = { listAddresses, addAddress, updateAddress, deleteAddress };
