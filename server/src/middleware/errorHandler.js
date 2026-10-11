const env = require('../config/env');

// Answers 404 for any /api route that does not exist.
function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
}

// Converts known database errors into friendly API errors.
function translateKnownError(error) {
  if (error.isExpected) return error;

  if (error.name === 'CastError') {
    return { statusCode: 404, code: 'NOT_FOUND', message: 'Not found.' };
  }
  if (error.name === 'ValidationError') {
    return { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Some fields are invalid.' };
  }
  if (error.code === 11000) {
    return { statusCode: 409, code: 'DUPLICATE', message: 'This value is already in use.' };
  }
  if (error.type === 'entity.too.large') {
    return { statusCode: 413, code: 'TOO_LARGE', message: 'Request is too large.' };
  }
  if (error.type === 'entity.parse.failed') {
    return { statusCode: 400, code: 'BAD_JSON', message: 'Request body is not valid JSON.' };
  }

  return null;
}

// The one place where every error becomes a JSON response.
// Unexpected errors are logged, and in production their details are hidden.
function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const known = translateKnownError(error);

  if (known) {
    return res.status(known.statusCode).json({
      error: { code: known.code, message: known.message, details: known.details },
    });
  }

  if (!env.isTest) console.error(error);

  res.status(500).json({
    error: {
      code: 'SERVER_ERROR',
      message: env.isProduction ? 'Something went wrong. Please try again.' : error.message,
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
