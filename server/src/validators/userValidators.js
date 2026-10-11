const { z, personName, phone, language } = require('./common');

const updateProfileBody = z
  .object({
    name: personName.optional(),
    phone: phone.optional(),
  })
  .strict();

const updateLanguageBody = z.object({ language }).strict();

module.exports = { updateProfileBody, updateLanguageBody };
