const { z, email, password, personName, phone, objectId, pagination } = require('./common');
const { ALL_ROLES, ADMIN_ASSIGNABLE_ROLES } = require('../constants/roles');

const listUsersQuery = z
  .object({
    role: z.enum(ALL_ROLES).optional(),
    search: z.string().trim().max(100).optional(),
    ...pagination,
  })
  .strict();

const userIdParams = z.object({ id: objectId }).strict();

const changeRoleBody = z.object({ role: z.enum(ADMIN_ASSIGNABLE_ROLES) }).strict();

const changeStatusBody = z.object({ isActive: z.boolean() }).strict();

const createRiderBody = z
  .object({
    name: personName,
    email,
    phone,
    password,
  })
  .strict();

module.exports = { listUsersQuery, userIdParams, changeRoleBody, changeStatusBody, createRiderBody };
