const { z, email, password, personName, phone, language, emailToken } = require('./common');
const { SELF_REGISTER_ROLES, ROLES } = require('../constants/roles');

// .strict() rejects any extra field, so nobody can sneak in role=super_admin or isEmailVerified=true.

const registerBody = z
  .object({
    name: personName,
    email,
    password,
    phone: phone.optional(),
    role: z.enum(SELF_REGISTER_ROLES).default(ROLES.CUSTOMER),
    preferredLanguage: language.default('en'),
  })
  .strict();

const loginBody = z
  .object({
    email,
    // Not checking length here: login only compares, and old passwords may differ in rules.
    password: z.string().min(1).max(200),
  })
  .strict();

const emailOnlyBody = z.object({ email }).strict();

const verifyEmailBody = z.object({ token: emailToken }).strict();

const resetPasswordBody = z.object({ token: emailToken, password }).strict();

const changePasswordBody = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: password,
  })
  .strict();

module.exports = {
  registerBody,
  loginBody,
  emailOnlyBody,
  verifyEmailBody,
  resetPasswordBody,
  changePasswordBody,
};
