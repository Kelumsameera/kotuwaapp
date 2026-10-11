const { DISTRICTS } = require('../constants/districts');
const { badRequest, notFound } = require('../utils/AppError');

const MAX_ADDRESSES = 10;

// Returns the province key for a district key, e.g. "kandy" → "central".
function provinceOfDistrict(districtKey) {
  return DISTRICTS.find((district) => district.key === districtKey)?.province;
}

// Finds one of the user's own addresses by id, or answers 404.
function findMyAddress(user, addressId) {
  const address = user.addresses.id(addressId);
  if (!address) throw notFound('ADDRESS_NOT_FOUND', 'Address not found.');
  return address;
}

// Makes exactly one address the default.
function makeDefault(user, addressId) {
  for (const address of user.addresses) address.isDefault = String(address._id) === String(addressId);
}

// Adds an address. The first one (or one marked isDefault) becomes the default.
async function addAddress(user, data) {
  if (user.addresses.length >= MAX_ADDRESSES) {
    throw badRequest('ADDRESS_LIMIT', `You can save up to ${MAX_ADDRESSES} addresses.`);
  }

  user.addresses.push({ ...data, province: provinceOfDistrict(data.district), isDefault: false });
  const added = user.addresses[user.addresses.length - 1];
  if (data.isDefault || user.addresses.length === 1) makeDefault(user, added._id);

  await user.save();
  return user.addresses;
}

// Changes one of the user's addresses.
async function updateAddress(user, addressId, data) {
  const address = findMyAddress(user, addressId);
  const { isDefault, ...fields } = data;

  Object.assign(address, fields);
  if (fields.district) address.province = provinceOfDistrict(fields.district);
  if (isDefault) makeDefault(user, address._id);

  await user.save();
  return user.addresses;
}

// Deletes an address. If it was the default, the first remaining one becomes the default.
async function deleteAddress(user, addressId) {
  const address = findMyAddress(user, addressId);
  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && user.addresses.length > 0) makeDefault(user, user.addresses[0]._id);

  await user.save();
  return user.addresses;
}

module.exports = { MAX_ADDRESSES, provinceOfDistrict, findMyAddress, addAddress, updateAddress, deleteAddress };
