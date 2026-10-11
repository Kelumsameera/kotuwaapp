const { badRequest } = require('../utils/AppError');

// Checks req.body, req.params and req.query against Zod schemas.
// Valid data replaces the original, so unknown fields are dropped before controllers see them.
function validate({ body, params, query } = {}) {
  return function checkRequest(req, res, next) {
    const parts = { body, params, query };

    for (const [part, schema] of Object.entries(parts)) {
      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(badRequest('VALIDATION_ERROR', 'Some fields are invalid.', details));
      }

      req[part] = result.data;
    }

    next();
  };
}

module.exports = validate;
