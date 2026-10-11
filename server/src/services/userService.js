// Updates the logged-in user's own name and/or phone.
async function updateOwnProfile(user, { name, phone }) {
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  await user.save();
  return user;
}

// Saves the user's chosen language (used for the website and for emails).
async function updateOwnLanguage(user, language) {
  user.preferredLanguage = language;
  await user.save();
  return user;
}

module.exports = { updateOwnProfile, updateOwnLanguage };
